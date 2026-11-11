const fs = require('node:fs');
const { EventEmitter } = require('node:events');
const os = require('node:os');
const path = require('node:path');

const { main, parseCommandLine } = require('../../bin/lib/cli');
const { createRunner, formatCommand, withSignalGuard } = require('../../bin/lib/util');
const { findFoundationPluginOptions } = require('../../bin/lib/config');
const updateDeps = require('../../bin/lib/update-deps');
const updateMatch = require('../../bin/lib/update-match');
const keystore = require('../../bin/lib/keystore');

const tmp: string[] = [];
const mkProject = (files: Record<string, string> = {}) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mfrn-test-'));
    tmp.push(dir);
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"app"}');
    for (const [name, contents] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
        fs.writeFileSync(path.join(dir, name), contents);
    }
    return dir;
};
afterAll(() => tmp.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

describe('arg parsing', () => {
    const run = async (argv: string[]) => {
        const out: string[] = [];
        const err: string[] = [];
        const code = await main(argv, { out: (l: string) => out.push(l), err: (l: string) => err.push(l) });
        return { code, out: out.join('\n'), err: err.join('\n') };
    };

    it('prints usage for --help and no args', async () => {
        expect((await run(['--help'])).out).toContain('Usage: mfrn <command>');
        expect((await run([])).code).toBe(0);
        expect((await run(['update-match', '--help'])).out).toContain('Usage: mfrn update-match');
    });

    it('fails on unknown commands and flags with usage', async () => {
        const unknown = await run(['nope']);
        expect(unknown.code).toBe(2);
        expect(unknown.err).toContain('unknown command "nope"');
        expect(unknown.err).toContain('Usage: mfrn <command>');
        expect((await run(['update-match', '--bogus'])).code).toBe(2);
        expect((await run(['update-deps', 'extra'])).code).toBe(2);
        expect((await run(['update-deps', '--', 'x'])).code).toBe(2);
    });

    it('requires package.json in --cwd', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mfrn-test-'));
        tmp.push(dir);
        const result = await run(['update-match', '--cwd', dir]);
        expect(result.code).toBe(1);
        expect(result.err).toContain('no package.json');
    });

    it('splits positionals and passthrough args', () => {
        const parsed = parseCommandLine(['update-match', 'appstore', '--readonly', '--', '--verbose', 'x']);
        expect(parsed.positionals).toEqual(['appstore']);
        expect(parsed.values.readonly).toBe(true);
        expect(parsed.passthrough).toEqual(['--verbose', 'x']);
    });

    it('parses repeatable update-deps flags', () => {
        const parsed = parseCommandLine(['update-deps', '--trusted', 'a*', '--trusted', 'b*', '--reject', 'x', '--no-rename-patches', '--dry-run']);
        expect(parsed.values.trusted).toEqual(['a*', 'b*']);
        expect(parsed.values.reject).toEqual(['x']);
        expect(parsed.values['no-rename-patches']).toBe(true);
        expect(parsed.values.cooldown).toBe('3d');
    });
});

describe('runner', () => {
    // A fake child process: emits close on the next microtask unless `hold` is set.
    const fakeSpawn = (result: any = { code: 0 }, { hold = false } = {}) => {
        const children: any[] = [];
        const spawn = jest.fn((cmd: string, args: string[], opts: any) => {
            const child: any = new EventEmitter();
            child.stdout = new EventEmitter();
            child.stdout.setEncoding = () => {};
            child.kill = jest.fn((sig: string) => child.emit('close', null, sig));
            children.push(child);
            if (!hold) {
                Promise.resolve().then(() => {
                    if (result.stdout) child.stdout.emit('data', result.stdout);
                    child.emit('close', result.code ?? null, result.signal ?? null);
                });
            }
            return child;
        });
        return { spawn, children };
    };

    it('echoes commands and does not spawn in dry-run', async () => {
        const log = jest.fn();
        const { spawn } = fakeSpawn();
        const runner = createRunner({ dryRun: true, log, spawn });
        await runner.run('yarn', ['add', 'a b']);
        expect(log).toHaveBeenCalledWith("$ yarn add 'a b'");
        expect(spawn).not.toHaveBeenCalled();
    });

    it('aborts on non-zero exit and merges env without echoing it', async () => {
        const log = jest.fn();
        const { spawn } = fakeSpawn({ code: 3 });
        const runner = createRunner({ log, spawn, baseEnv: { A: '1' } });
        await expect(runner.run('x', ['y'], { env: { SECRET: 's' } })).rejects.toThrow('command failed (exit 3): x y');
        expect(spawn.mock.calls[0][2].env).toEqual({ A: '1', SECRET: 's' });
        expect(JSON.stringify(log.mock.calls)).not.toContain('SECRET');
    });

    it('captures stdout and tolerates failures with allowFail', async () => {
        const { spawn } = fakeSpawn({ code: 1, stdout: 'out' });
        const runner = createRunner({ log: jest.fn(), spawn });
        await expect(runner.run('x', [], { capture: true, allowFail: true })).resolves.toEqual({ status: 1, stdout: 'out' });
    });

    it('turns a signal-killed child into an interrupt error with 128+n', async () => {
        const { spawn } = fakeSpawn({ signal: 'SIGINT' });
        const runner = createRunner({ log: jest.fn(), spawn });
        await expect(runner.run('x')).rejects.toMatchObject({ exitCode: 130 });
    });

    it('kills the running child on interrupt() and refuses later commands', async () => {
        const { spawn, children } = fakeSpawn({}, { hold: true });
        const runner = createRunner({ log: jest.fn(), spawn });
        const pending = runner.run('slow');
        await Promise.resolve();
        runner.interrupt('SIGTERM');
        await expect(pending).rejects.toMatchObject({ exitCode: 143 });
        expect(children[0].kill).toHaveBeenCalledWith('SIGTERM');
        await expect(runner.run('next')).rejects.toThrow('interrupted (SIGTERM)');
    });

    it('registers and removes signal listeners around a guarded block', async () => {
        const proc = new EventEmitter();
        const runner = { interrupt: jest.fn() };
        await withSignalGuard(runner, async () => {
            expect(proc.listenerCount('SIGINT')).toBe(1);
            proc.emit('SIGHUP');
        }, proc);
        expect(runner.interrupt).toHaveBeenCalledWith('SIGHUP');
        for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) expect(proc.listenerCount(sig)).toBe(0);
    });
});

describe('update-deps', () => {
    const pm = { name: 'yarn', lockfile: 'yarn.lock', install: ['yarn'] };
    const baseInput = (extra: any = {}) => ({
        ncuCli: '/f/ncu.js',
        expoCli: '/p/expo.js',
        patchPackageCli: '/p/pp.js',
        hasExpo: true,
        hasPatches: true,
        ...extra,
    });
    const plan = (extra: any = {}) => updateDeps.buildUpdateDepsPlan({ pm, ...baseInput(), ...extra });
    const cmdsOf = (steps: any[]) => steps.filter((s: any) => s.cmd).map((s: any) => [s.cmd, ...s.args]);

    it('plans commands with the resolved node binaries, not npx', () => {
        const steps = plan({ trusted: ['@acme*', '@other*'], reject: ['react', 'foo'], cooldown: '5d' });
        const node = process.execPath;
        expect(cmdsOf(steps)).toEqual([
            [node, '/f/ncu.js', '-u', '--cooldown', '5d', '--reject', 'react,foo'],
            [node, '/f/ncu.js', '-u', '@acme*', '--reject', 'react,foo'],
            [node, '/f/ncu.js', '-u', '@other*', '--reject', 'react,foo'],
            ['yarn'],
            [node, '/p/expo.js', 'install', '--fix'],
            ['yarn'],
            [node, '/p/pp.js', '--error-on-fail'],
        ]);
        expect(JSON.stringify(cmdsOf(steps))).not.toContain('npx');
        expect(steps.map((s: any) => s.type)).toEqual([
            'backup', 'cmd', 'cmd', 'cmd', 'remove-lockfile', 'touch-lockfile', 'cmd', 'cmd', 'cmd', 'patch-check', 'summary',
        ]);
    });

    it('omits expo, patches and lockfile touch when not applicable (npm)', () => {
        const steps = plan({ pm: { name: 'npm', lockfile: 'package-lock.json', install: ['npm', 'install'] }, hasExpo: false, hasPatches: false });
        const types = steps.map((s: any) => s.type);
        expect(types).not.toContain('touch-lockfile');
        expect(types).not.toContain('patch-check');
        expect(steps.filter((s: any) => s.cmd === 'npm')).toHaveLength(2);
    });

    describe('yarn age gate', () => {
        it('converts durations to minutes', () => {
            expect(updateDeps.toMinutes('3d', 'd')).toBe(4320);
            expect(updateDeps.toMinutes('3', 'd')).toBe(4320);
            expect(updateDeps.toMinutes(1440, 'm')).toBe(1440);
            expect(updateDeps.toMinutes('12h', 'd')).toBe(720);
            expect(updateDeps.toMinutes('soon', 'd')).toBeNull();
        });

        it('matches preapproved patterns', () => {
            expect(updateDeps.isPreapproved('@acme*', ['@acme*'])).toBe(true);
            expect(updateDeps.isPreapproved('@acme/*', ['@acme/*'])).toBe(true);
            expect(updateDeps.isPreapproved('@acme/pkg', ['@acme/*'])).toBe(true);
            expect(updateDeps.isPreapproved('@acme*', ['@other/*'])).toBe(false);
            expect(updateDeps.isPreapproved('x', ['*'])).toBe(true);
        });

        it('gives unapproved trusted patterns the gate and raises a short main cooldown', () => {
            const steps = plan({
                cooldown: '1h',
                trusted: ['@acme*', '@free*'],
                gate: { minutes: 1440, preapproved: ['@free*'] },
            });
            const node = process.execPath;
            expect(cmdsOf(steps).slice(0, 3)).toEqual([
                [node, '/f/ncu.js', '-u', '--cooldown', '1440m'],
                [node, '/f/ncu.js', '-u', '@acme*', '--cooldown', '1440m'],
                [node, '/f/ncu.js', '-u', '@free*'],
            ]);
            expect(steps.warnings).toHaveLength(2);
            expect(steps.warnings.join('\n')).toContain('npmPreapprovedPackages');
        });

        it('splits a trusted pattern per package when only some packages are preapproved', () => {
            const steps = plan({
                trusted: ['@acme*'],
                gate: { minutes: 1440, preapproved: ['@acme-io/*', '@acme-platform/*'] },
                packageNames: ['@acme-io/core', '@acme-platform/ui', '@acme-labs/x', 'react'],
            });
            const node = process.execPath;
            expect(cmdsOf(steps).slice(1, 3)).toEqual([
                [node, '/f/ncu.js', '-u', '@acme-io/core,@acme-platform/ui'],
                [node, '/f/ncu.js', '-u', '@acme-labs/x', '--cooldown', '1440m'],
            ]);
            expect(steps.warnings).toEqual([expect.stringContaining('@acme-labs/x (trusted @acme*)')]);
        });

        it('runs a fully preapproved trusted pattern by package with no cooldown and no warning', () => {
            const steps = plan({
                trusted: ['@acme*'],
                gate: { minutes: 1440, preapproved: ['@acme-io/*'] },
                packageNames: ['@acme-io/core', 'react'],
            });
            expect(cmdsOf(steps)[1]).toEqual([process.execPath, '/f/ncu.js', '-u', '@acme-io/core']);
            expect(steps.warnings).toEqual([]);
        });

        it('skips the trusted pass when no dependency matches', () => {
            const steps = plan({ trusted: ['@acme*'], gate: { minutes: 1440, preapproved: [] }, packageNames: ['react'] });
            expect(cmdsOf(steps).filter((c: string[]) => c.includes('@acme*'))).toEqual([]);
        });

        it('collects dependency names across dependency fields', () => {
            expect(
                updateDeps.dependencyNames({ dependencies: { a: '1' }, devDependencies: { b: '1', a: '1' }, optionalDependencies: { c: '1' } }),
            ).toEqual(['a', 'b', 'c']);
        });

        it('leaves cooldowns alone without a gate or with a longer main cooldown', () => {
            expect(plan({ gate: { minutes: 0, preapproved: [] } }).warnings).toEqual([]);
            const steps = plan({ cooldown: '3d', trusted: ['@free*'], gate: { minutes: 1440, preapproved: ['@free*'] } });
            expect(cmdsOf(steps)[0]).toContain('3d');
            expect(steps.warnings).toEqual([]);
        });

        it('reads the gate and preapproved list from yarn in the preflight', async () => {
            const dir = mkProject({ 'yarn.lock': 'lock', 'package.json': '{"name":"app","dependencies":{"@acme/core":"1.0.0"}}' });
            const answers: Record<string, string> = {
                nodeLinker: '"node-modules"',
                npmScopes: '{}',
                npmMinimalAgeGate: '1440',
                npmPreapprovedPackages: '["@free*"]',
            };
            const run = jest.fn(async (cmd: string, args: string[]) =>
                cmd === 'yarn' ? { status: 0, stdout: answers[args[2]] ?? '' } : { status: 0, stdout: '' });
            const log = jest.fn();
            await updateDeps.executeUpdateDeps({
                projectRoot: dir, pm,
                planInput: baseInput({ hasExpo: false, hasPatches: false, trusted: ['@acme*'] }),
                options: {}, runner: { dryRun: false, log, run }, proc: new EventEmitter(),
            });
            const ncu = run.mock.calls.filter((c: any[]) => c[0] === process.execPath).map((c: any[]) => c[1]);
            expect(ncu[1]).toEqual(['/f/ncu.js', '-u', '@acme/core', '--cooldown', '1440m']);
            expect(log.mock.calls.map((c: any[]) => c[0]).join('\n')).toContain('warning: @acme/core (trusted @acme*)');
        });
    });

    it('detects the package manager', () => {
        const yarn = mkProject({ 'yarn.lock': '__metadata:\n' });
        expect(updateDeps.detectPackageManager(yarn, { packageManager: 'yarn@4.1.0' }).name).toBe('yarn');
        expect(updateDeps.detectPackageManager(yarn, {}).name).toBe('yarn');
        expect(updateDeps.detectPackageManager(mkProject({ 'package-lock.json': '{}' }), {}).name).toBe('npm');
        expect(() => updateDeps.detectPackageManager(yarn, { packageManager: 'yarn@1.22.0' })).toThrow('yarn classic');
        expect(() => updateDeps.detectPackageManager(mkProject({ 'yarn.lock': '# yarn lockfile v1\n' }), {})).toThrow('yarn classic');
        expect(() => updateDeps.detectPackageManager(mkProject(), { packageManager: 'pnpm@9.0.0' })).toThrow('unsupported package manager "pnpm"');
        expect(() => updateDeps.detectPackageManager(mkProject(), {})).toThrow('could not detect');
    });

    it('rejects Yarn Plug\'n\'Play before anything else', () => {
        const pnp = mkProject({ 'yarn.lock': '__metadata:\n', '.pnp.cjs': '' });
        expect(() => updateDeps.detectPackageManager(pnp, { packageManager: 'yarn@4.1.0' })).toThrow('Plug\'n\'Play');
        const rc = mkProject({ 'yarn.lock': '__metadata:\n', '.yarnrc.yml': 'nodeLinker: pnp\n' });
        expect(() => updateDeps.detectPackageManager(rc, { packageManager: 'yarn@4.1.0' })).toThrow('node-modules');
        const ok = mkProject({ 'yarn.lock': '__metadata:\n', '.yarnrc.yml': 'nodeLinker: node-modules\n' });
        expect(updateDeps.detectPackageManager(ok, { packageManager: 'yarn@4.1.0' }).name).toBe('yarn');
    });

    it('parses yarn scopes that require auth', () => {
        const stdout = JSON.stringify({
            acme: { npmRegistryServer: 'https://registry.example.com/', npmAlwaysAuth: true },
            '@open': { npmAlwaysAuth: false },
            other: { npmRegistryServer: 'https://x.example.com' },
            lonely: { npmAlwaysAuth: true },
        });
        expect(updateDeps.parseAuthScopes(stdout)).toEqual([
            { scope: 'acme', registry: 'https://registry.example.com/' },
            { scope: 'lonely', registry: '(default registry)' },
        ]);
        expect(updateDeps.parseAuthScopes('')).toEqual([]);
        expect(updateDeps.parseAuthScopes('undefined')).toEqual([]);
        expect(updateDeps.parseAuthScopes('YN0000: noise\n{"a":{"npmAlwaysAuth":true}}')).toHaveLength(1);
    });

    it('parses patch file names', () => {
        expect(updateDeps.parsePatchName('react-native-screens+4.26.2.patch')).toMatchObject({ name: 'react-native-screens', version: '4.26.2', tail: '', suffix: '' });
        expect(updateDeps.parsePatchName('@scope+pkg+1.0.0-beta.1.patch')).toMatchObject({ name: '@scope/pkg', version: '1.0.0-beta.1', prefix: '@scope+pkg' });
        expect(updateDeps.parsePatchName('pkg+1.2.3+001+fix.patch')).toMatchObject({ name: 'pkg', tail: '+001+fix' });
        expect(updateDeps.parsePatchName('pkg+1.2.3.dev.patch')).toMatchObject({ name: 'pkg', version: '1.2.3', suffix: '.dev' });
        expect(updateDeps.parsePatchName('a++b+1.0.0.patch').skip).toMatch('nested');
        expect(updateDeps.parsePatchName('weird.patch').skip).toMatch('version');
        expect(updateDeps.parsePatchName('@scope+1.0.0.patch').skip).toBeDefined();
    });

    describe('patches on disk', () => {
        const project = () =>
            mkProject({
                'patches/foo+1.0.0.patch': 'p',
                'patches/@s+bar+2.0.0+001+x.patch': 'p',
                'patches/dev+1.0.0.dev.patch': 'p',
                'patches/same+1.0.0.patch': 'p',
                'patches/nested++pkg+1.0.0.patch': 'p',
                'patches/gone+1.0.0.patch': 'p',
                'node_modules/foo/package.json': '{"version":"1.1.0"}',
                'node_modules/@s/bar/package.json': '{"version":"2.1.0"}',
                'node_modules/dev/package.json': '{"version":"1.2.0"}',
                'node_modules/same/package.json': '{"version":"1.0.0"}',
            });

        it('detects mismatches (keeping .dev) and notes', () => {
            const { mismatches, notes } = updateDeps.checkPatches(project());
            expect(mismatches.map((m: any) => m.renamedTo)).toEqual(['@s+bar+2.1.0+001+x.patch', 'dev+1.2.0.dev.patch', 'foo+1.1.0.patch']);
            expect(notes.join('\n')).toContain('nested++pkg+1.0.0.patch');
            expect(notes.join('\n')).toContain('gone is not installed');
        });

        it('renames with fs when untracked and git mv when tracked', async () => {
            const dir = project();
            const { mismatches } = updateDeps.checkPatches(dir);
            const run = jest.fn();
            const runner = { log: jest.fn(), run };
            const spawnSync = jest.fn((cmd: string, args: string[]) => ({ status: args[2] === 'patches/foo+1.0.0.patch' ? 0 : 1 }));
            await updateDeps.renamePatches({ projectRoot: dir, mismatches, runner, spawnSync });
            expect(run).toHaveBeenCalledWith('git', ['mv', 'patches/foo+1.0.0.patch', 'patches/foo+1.1.0.patch'], { cwd: dir });
            expect(fs.existsSync(path.join(dir, 'patches/@s+bar+2.1.0+001+x.patch'))).toBe(true);
            expect(fs.existsSync(path.join(dir, 'patches/dev+1.2.0.dev.patch'))).toBe(true);
            expect(fs.existsSync(path.join(dir, 'patches/@s+bar+2.0.0+001+x.patch'))).toBe(false);
        });
    });

    it('summarizes major changes', () => {
        const { changed, majors } = updateDeps.diffMajors(
            { dependencies: { expo: '~57.0.1', a: '^1.2.0', b: '^2.0.0' }, devDependencies: { c: '1.0.0' } },
            { dependencies: { expo: '~58.0.2', a: '^1.3.0', b: '^2.0.0' }, devDependencies: { c: '2.0.0' } },
        );
        expect(changed).toBe(3);
        expect(majors.map((m: any) => m.name)).toEqual(['expo', 'c']);
        expect(updateDeps.parseMajor('workspace:*')).toBeNull();
    });

    describe('execution', () => {
        const yarnAnswer = (args: string[]) => ({ status: 0, stdout: args[0] === 'config' ? ({ nodeLinker: '"node-modules"', npmScopes: '{}' } as any)[args[2]] ?? '' : '' });
        const setup = (opts: { failOn?: (args: string[]) => boolean; planInput?: any } = {}) => {
            const dir = mkProject({ 'yarn.lock': 'original lock' });
            fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"app","dependencies":{"a":"^1.0.0"}}');
            const log = jest.fn();
            const run = jest.fn(async (cmd: string, args: string[]) => {
                if (cmd === 'yarn' && args[0] === 'config') return yarnAnswer(args);
                if (args[0] === '/f/ncu.js' && args.includes('--cooldown')) {
                    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"app","dependencies":{"a":"^2.0.0"}}');
                }
                if (opts.failOn?.(args)) throw new Error('boom');
                return { status: 0, stdout: '' };
            });
            const runner: any = { dryRun: false, log, run };
            const planInput = baseInput({ hasExpo: false, hasPatches: false, ...opts.planInput });
            const exec = (extra: any = {}) =>
                updateDeps.executeUpdateDeps({ projectRoot: dir, pm, planInput, options: { renamePatches: true }, runner, proc: new EventEmitter(), ...extra });
            return { dir, log, run, runner, exec, text: () => log.mock.calls.map((c: any[]) => c[0]).join('\n') };
        };

        it('runs the preflight first, aborting before any file change', async () => {
            const { dir, run, exec } = setup();
            run.mockImplementation(async (cmd: string, args: string[]) => {
                if (args[0] === 'config') return yarnAnswer(args).stdout === '' ? { status: 0, stdout: '' } : { status: 0, stdout: args[2] === 'npmScopes' ? '{"acme":{"npmAlwaysAuth":true,"npmRegistryServer":"https://registry.example.com"}}' : '"node-modules"' };
                if (args[0] === 'npm') return { status: 1, stdout: '' };
                return { status: 0, stdout: '' };
            });
            await expect(exec()).rejects.toThrow(
                /scope @acme \(https:\/\/registry.example.com\).*nothing was modified.*yarn npm login --scope acme/,
            );
            expect(run.mock.calls.some((c: any[]) => c[1][0] === 'npm' && c[1][3] === 'acme')).toBe(true);
            expect(run.mock.calls.every((c: any[]) => c[0] === 'yarn')).toBe(true);
            expect(fs.readFileSync(path.join(dir, 'yarn.lock'), 'utf8')).toBe('original lock');
        });

        it('aborts when yarn reports a non-node-modules linker', async () => {
            const { run, exec } = setup();
            run.mockImplementation(async (cmd: string, args: string[]) => ({ status: 0, stdout: args[2] === 'nodeLinker' ? '"pnp"' : '' }));
            await expect(exec()).rejects.toThrow('Plug\'n\'Play');
        });

        it('restores package.json and the lockfile on failure', async () => {
            const { dir, exec, text } = setup({ failOn: (args) => args[1] === 'install', planInput: { hasExpo: true } });
            await expect(exec()).rejects.toThrow('boom');
            expect(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).toContain('^1.0.0');
            expect(fs.readFileSync(path.join(dir, 'yarn.lock'), 'utf8')).toBe('original lock');
            expect(text()).toMatch(/Backed up package.json and yarn.lock to .*mfrn-update-deps-/);
            expect(text()).toContain('Restored package.json and yarn.lock from the backup');
        });

        it('restores and exits 130 when interrupted mid-command, then removes the listeners', async () => {
            const proc = new EventEmitter();
            const { dir, run, exec } = setup();
            const base = run.getMockImplementation();
            run.mockImplementation(async (cmd: string, args: string[]) => {
                if (cmd === 'yarn' && args[0] !== 'config') {
                    proc.emit('SIGINT');
                    throw Object.assign(new Error('interrupted (SIGINT)'), { exitCode: 130 });
                }
                return base!(cmd, args);
            });
            const interrupt = jest.fn();
            await expect(exec({ proc, runner: { dryRun: false, log: jest.fn(), run, interrupt } })).rejects.toMatchObject({ exitCode: 130 });
            expect(interrupt).toHaveBeenCalledWith('SIGINT');
            expect(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).toContain('^1.0.0');
            expect(fs.readFileSync(path.join(dir, 'yarn.lock'), 'utf8')).toBe('original lock');
            expect(proc.listenerCount('SIGINT')).toBe(0);
        });

        it('recreates an empty lockfile on success and reports majors', async () => {
            const { dir, exec, text } = setup();
            expect(await exec()).toBe(0);
            expect(fs.readFileSync(path.join(dir, 'yarn.lock'), 'utf8')).toBe('');
            expect(text()).toContain('a: ^1.0.0 -> ^2.0.0');
        });

        it('exits non-zero without restoring when patch-package fails, keeping the backup', async () => {
            const { dir, run, exec, text } = setup({ planInput: { hasPatches: true } });
            const base = run.getMockImplementation();
            run.mockImplementation(async (cmd: string, args: string[], o: any) => (args[0] === '/p/pp.js' ? { status: 1, stdout: '' } : base!(cmd, args, o)));
            expect(await exec()).toBe(1);
            expect(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).toContain('^2.0.0');
            expect(text()).toContain('backup is kept at');
        });

        it('changes nothing in dry-run', async () => {
            const dir = mkProject({ 'yarn.lock': 'original lock' });
            const log = jest.fn();
            const spawn = jest.fn();
            const runner = createRunner({ dryRun: true, log, spawn });
            expect(await updateDeps.executeUpdateDeps({ projectRoot: dir, pm, planInput: baseInput({ hasExpo: false, hasPatches: false }), options: {}, runner })).toBe(0);
            expect(spawn).not.toHaveBeenCalled();
            expect(fs.readFileSync(path.join(dir, 'yarn.lock'), 'utf8')).toBe('original lock');
            expect(log.mock.calls.map((c: any[]) => c[0]).join('\n')).toContain('would delete yarn.lock');
        });
    });
});

describe('update-match', () => {
    const exp = { ios: { appleTeamId: 'ABCDE12345' } };
    const options = (ios: any = {}) => ({
        fastlane: {
            ios: {
                matchGitUrl: 'git@git.example.com:team/certs.git',
                extensionTargets: ['Alerts'],
                matchAppIdentifiers: { appstore: ['com.example.app', 'com.example.app-alpha'], development: ['com.example.app-alpha'] },
                ...ios,
            },
        },
    });
    const build = (extra: any = {}) =>
        updateMatch.buildUpdateMatchPlan({ exp, pluginOptions: options(), env: { FASTLANE_USER: 'a@example.com' }, projectRoot: mkProject(), ...extra });

    it('expands identifiers with extension targets', () => {
        expect(updateMatch.expandIdentifiers(['a.b', 'c.d'], ['X', 'Y'])).toEqual(['a.b', 'a.b.X', 'a.b.Y', 'c.d', 'c.d.X', 'c.d.Y']);
        expect(updateMatch.expandIdentifiers(['a.b'])).toEqual(['a.b']);
    });

    it('builds commands in plugin type order', () => {
        const plan = build({ readonly: true, passthrough: ['--verbose'] });
        expect(plan.commands.map((c: any) => [c.cmd, ...c.args])).toEqual([
            ['bundle', 'exec', 'fastlane', 'match', 'development', '-a', 'com.example.app-alpha,com.example.app-alpha.Alerts', '--git_url', 'git@git.example.com:team/certs.git', '--team_id', 'ABCDE12345', '--readonly', '--verbose'],
            ['bundle', 'exec', 'fastlane', 'match', 'appstore', '-a', 'com.example.app,com.example.app.Alerts,com.example.app-alpha,com.example.app-alpha.Alerts', '--git_url', 'git@git.example.com:team/certs.git', '--team_id', 'ABCDE12345', '--readonly', '--verbose'],
        ]);
        expect(plan.warnings).toEqual([]);
    });

    it('filters by type and validates it', () => {
        expect(build({ types: ['appstore'] }).commands).toHaveLength(1);
        expect(() => build({ types: ['bogus'] })).toThrow('unknown match type "bogus"');
        expect(() => build({ types: ['adhoc'] })).toThrow('no fastlane.ios.matchAppIdentifiers');
    });

    it('prefers the option team id and env git url, and warns without FASTLANE_USER', () => {
        const plan = build({
            pluginOptions: options({ matchGitUrl: undefined, appleTeamId: 'ZZZZZ99999' }),
            env: { MATCH_GIT_URL: 'x' },
        });
        expect(plan.commands[0].args).not.toContain('--git_url');
        expect(plan.commands[0].args).toContain('ZZZZZ99999');
        expect(plan.warnings[0]).toContain('FASTLANE_USER');
    });

    it('uses ios/ as cwd when present', () => {
        const root = mkProject({ 'ios/Podfile': '' });
        expect(build({ projectRoot: root }).cwd).toBe(path.join(root, 'ios'));
        const bare = mkProject();
        expect(build({ projectRoot: bare }).cwd).toBe(bare);
    });

    it('errors when disabled, unconfigured or without a git url', () => {
        expect(() => build({ pluginOptions: { fastlane: false } })).toThrow('fastlane is disabled');
        expect(() => build({ pluginOptions: { fastlane: { ios: false } } })).toThrow('fastlane.ios is disabled');
        expect(() => build({ pluginOptions: {} })).toThrow('no fastlane.ios.matchAppIdentifiers');
    });

    it('warns instead of failing without a git url, unless another source provides one', () => {
        const noUrl = (extra: any = {}) => build({ pluginOptions: options({ matchGitUrl: undefined }), ...extra });
        expect(noUrl().warnings.join('\n')).toContain('no match git URL found');
        expect(noUrl({ env: { FASTLANE_USER: 'a', MATCH_GIT_URL: 'x' } }).warnings).toEqual([]);
        expect(noUrl({ passthrough: ['--git_url', 'x'] }).warnings).toEqual([]);
        expect(noUrl({ passthrough: ['--git_url=x'] }).warnings).toEqual([]);
        expect(noUrl({ passthrough: ['git_url:x'] }).warnings).toEqual([]);
        const withFile = (name: string, contents: string) => {
            const root = mkProject({ [`ios/fastlane/${name}`]: contents });
            return noUrl({ projectRoot: root }).warnings;
        };
        expect(withFile('Matchfile', 'git_url("git@example.com:a/b.git")\n')).toEqual([]);
        expect(withFile('Matchfile', '# git_url is unset: pass one\n')).toHaveLength(1);
        expect(withFile('.env.default', 'MATCH_GIT_URL=git@example.com:a/b.git\n')).toEqual([]);
        expect(withFile('.env', 'OTHER=1\n')).toHaveLength(1);
    });

    it('reuses the plugin validation', () => {
        expect(() => build({ pluginOptions: options({ matchAppIdentifiers: { appstore: ['bad id'] } }) })).toThrow('valid bundle identifiers');
    });

    it('finds the plugin entry in string and tuple forms', () => {
        const name = '@zyno-io/mobile-foundation-rn';
        expect(findFoundationPluginOptions({ plugins: ['x', [name, { a: 1 }]] })).toEqual({ a: 1 });
        expect(findFoundationPluginOptions({ plugins: [name] })).toEqual({});
        expect(findFoundationPluginOptions({})).toEqual({});
    });
});

describe('generate-android-keystore', () => {
    const resolve = (root: string, extra: any = {}) =>
        keystore.resolveKeystoreOptions({ projectRoot: root, exp: { name: 'My App' }, pluginOptions: {}, ...extra });

    it('resolves defaults', () => {
        const root = mkProject();
        expect(resolve(root)).toMatchObject({
            out: path.join(root, 'resources/native/android/signer.jks'),
            alias: 'key0',
            dname: 'CN=My App',
            passwordEnv: 'APK_KS_PASSWORD',
        });
    });

    it('prefers flags, then releaseSigning options', () => {
        const root = mkProject();
        const pluginOptions = { releaseSigning: { keystorePath: 'sign/a.jks', keyAlias: 'opt', passwordEnv: 'MY_PW' } };
        expect(resolve(root, { pluginOptions })).toMatchObject({ out: path.join(root, 'sign/a.jks'), alias: 'opt', passwordEnv: 'MY_PW' });
        expect(resolve(root, { pluginOptions, flags: { out: 'b.jks', alias: 'flag', dname: 'CN=X' } })).toMatchObject({
            out: path.join(root, 'b.jks'),
            alias: 'flag',
            dname: 'CN=X',
        });
        expect(resolve(root, { pluginOptions: { releaseSigning: false } }).alias).toBe('key0');
    });

    it('rejects paths inside android/, existing files without --force, and missing names', () => {
        const root = mkProject({ 'resources/native/android/signer.jks': 'x' });
        expect(() => resolve(root, { flags: { out: 'android/app/signer.jks' } })).toThrow('outside the generated android/');
        expect(() => resolve(root)).toThrow('already exists; pass --force');
        expect(resolve(root, { flags: { force: true } }).out).toContain('signer.jks');
        expect(() => resolve(mkProject(), { exp: {} })).toThrow('--dname');
        expect(() => resolve(mkProject(), { flags: { alias: "a'b" } })).toThrow('alias');
    });

    it('escapes DN special characters', () => {
        expect(keystore.escapeDnValue('Acme, Inc. + Co')).toBe('Acme\\, Inc. \\+ Co');
    });

    it('never puts the password in planned argv', () => {
        const plan = keystore.buildKeystorePlan({ out: '/x/signer.jks', alias: 'key0', dname: 'CN=A', passwordEnv: 'APK_KS_PASSWORD' });
        for (const step of [plan.generate, plan.list]) {
            expect(step.args).toContain('-storepass:env');
            expect(step.args[step.args.indexOf('-storepass:env') + 1]).toBe('APK_KS_PASSWORD');
        }
        expect(plan.generate.args).toEqual([
            '-genkeypair', '-v', '-storetype', 'PKCS12', '-keystore', '/x/signer.jks', '-alias', 'key0',
            '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000', '-dname', 'CN=A',
            '-storepass:env', 'APK_KS_PASSWORD', '-keypass:env', 'APK_KS_PASSWORD',
        ]);
    });

    it('generates a url-safe random password', () => {
        const a = keystore.generatePassword();
        expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
        expect(keystore.generatePassword()).not.toBe(a);
    });

    it('parses fingerprints from keytool -list -v output', () => {
        const output = [
            'Alias name: key0',
            'Certificate fingerprints:',
            '\t SHA1: aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD',
            '\t SHA256: 00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF',
            'Signature algorithm name: SHA384withRSA',
        ].join('\n');
        expect(keystore.parseFingerprints(output)).toEqual({
            sha1: 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD',
            sha256: '00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF',
        });
        expect(keystore.parseFingerprints('nothing')).toEqual({ sha1: null, sha256: null });
    });

    describe('run', () => {
        const exp = { name: 'My App' };
        const exec = async (root: string, { env = {}, spawn = { status: 0 }, values = {}, pluginOptions = {}, failGenerate = false, listing = 'SHA1: AA:BB\n SHA256: CC:DD' }: any = {}) => {
            const log = jest.fn();
            const order: string[] = [];
            const run = jest.fn(async (cmd: string, args: string[]) => {
                if (args[0] === '-genkeypair') {
                    order.push('generate');
                    const target = args[args.indexOf('-keystore') + 1];
                    fs.writeFileSync(target, 'new keystore');
                    if (failGenerate) throw new Error('keytool failed');
                } else {
                    order.push('list');
                }
                return { status: 0, stdout: args[0] === '-list' ? listing : '' };
            });
            log.mockImplementation((line: string) => { if (line.includes('Keystore password')) order.push('password'); });
            const runner = { dryRun: false, log, run };
            let error: any;
            try {
                await keystore.run({ values, projectRoot: root, runner, env, loadConfig: () => ({ exp, pluginOptions }), spawnSync: () => spawn });
            } catch (e) {
                error = e;
            }
            return { log, run, order, error, output: log.mock.calls.map((c: any[]) => c[0]).join('\n') };
        };

        it('prints a generated password once, before listing, and passes it by env only', async () => {
            const root = mkProject();
            const { run, output, order } = await exec(root);
            const password = run.mock.calls[0][2].env.APK_KS_PASSWORD;
            expect(password).toHaveLength(32);
            expect(JSON.stringify(run.mock.calls.map((c: any[]) => c[1]))).not.toContain(password);
            expect(output.split(password).length - 1).toBe(1);
            expect(order).toEqual(['generate', 'password', 'list']);
            expect(output).toContain('SHA-1:   AA:BB');
            expect(output).toContain('upload key');
            expect(output).toContain('releaseSigning picks it up');
            expect(fs.readFileSync(path.join(root, 'resources/native/android/signer.jks'), 'utf8')).toBe('new keystore');
            expect(fs.existsSync(path.join(root, 'resources/native/android/signer.jks.new'))).toBe(false);
        });

        it('uses a provided password and never prints it', async () => {
            const { output, run } = await exec(mkProject(), { env: { APK_KS_PASSWORD: 'from-env-secret' } });
            expect(run.mock.calls[0][2].env.APK_KS_PASSWORD).toBe('from-env-secret');
            expect(output).not.toContain('from-env-secret');
        });

        it('rejects a password shorter than 6 characters up front', async () => {
            const { error, run } = await exec(mkProject(), { env: { APK_KS_PASSWORD: 'short' } });
            expect(error.message).toContain('at least 6 characters');
            expect(run).not.toHaveBeenCalled();
        });

        it('keeps the old keystore and removes the temp file when keytool fails under --force', async () => {
            const root = mkProject({ 'resources/native/android/signer.jks': 'old keystore' });
            const { error } = await exec(root, { values: { force: true }, failGenerate: true });
            expect(error.message).toBe('keytool failed');
            expect(fs.readFileSync(path.join(root, 'resources/native/android/signer.jks'), 'utf8')).toBe('old keystore');
            expect(fs.existsSync(path.join(root, 'resources/native/android/signer.jks.new'))).toBe(false);
        });

        it('replaces the old keystore on success under --force', async () => {
            const root = mkProject({ 'resources/native/android/signer.jks': 'old keystore' });
            await exec(root, { values: { force: true } });
            expect(fs.readFileSync(path.join(root, 'resources/native/android/signer.jks'), 'utf8')).toBe('new keystore');
        });

        it('warns when releaseSigning would not use the keystore', async () => {
            const mismatch = await exec(mkProject(), { values: { out: 'keys/up.jks', alias: 'upload' } });
            expect(mismatch.output).not.toContain('picks it up');
            expect(mismatch.output).toContain('releaseSigning expects resources/native/android/signer.jks with alias key0');
            expect(mismatch.output).toContain('releaseSigning.keystorePath to "keys/up.jks" and releaseSigning.keyAlias to "upload"');
            const disabled = await exec(mkProject(), { pluginOptions: { releaseSigning: false } });
            expect(disabled.output).toContain('releaseSigning is false');
            const custom = await exec(mkProject(), { pluginOptions: { releaseSigning: { keystorePath: 'k/a.jks', keyAlias: 'x' } }, values: { out: 'k/a.jks', alias: 'x' } });
            expect(custom.output).toContain('picks it up');
        });

        it('errors when keytool is missing', async () => {
            const { error } = await exec(mkProject(), { spawn: { error: new Error('ENOENT') } });
            expect(error.message).toContain('JDK is required');
        });

        it('dry-run only echoes', async () => {
            const root = mkProject();
            const log = jest.fn();
            const spawn = jest.fn();
            const runner = createRunner({ dryRun: true, log, spawn });
            await keystore.run({ values: {}, projectRoot: root, runner, env: {}, loadConfig: () => ({ exp, pluginOptions: {} }), spawnSync: () => ({ status: 0 }) });
            expect(spawn).not.toHaveBeenCalled();
            expect(fs.existsSync(path.join(root, 'resources'))).toBe(false);
            expect(log.mock.calls.map((c: any[]) => c[0]).join('\n')).toContain('$ keytool -genkeypair -v');
        });
    });
});

describe('config loading errors', () => {
    const errorsFor = async (project: string, env: any = {}) => {
        const err: string[] = [];
        const code = await main(['update-match', '--cwd', project], { out: () => {}, err: (l: string) => err.push(l), env });
        return { code, err: err.join('\n') };
    };

    it('turns a throwing app config into an mfrn error without a stack', async () => {
        const root = mkProject({ 'node_modules/expo/config.js': "exports.getConfig = () => { throw new Error('bad app.config'); };" });
        const { code, err } = await errorsFor(root);
        expect(code).toBe(1);
        expect(err).toBe('mfrn: could not load the Expo config: bad app.config');
        expect((await errorsFor(root, { MFRN_DEBUG: '1' })).err).toContain('    at ');
    });

    it('explains a missing expo install', async () => {
        const { code, err } = await errorsFor(mkProject());
        expect(code).toBe(1);
        expect(err).toContain('mfrn: could not resolve expo/config');
    });

    it('wraps plugin option validation errors', async () => {
        const root = mkProject({
            'node_modules/expo/config.js': "exports.getConfig = () => ({ exp: { plugins: [['@zyno-io/mobile-foundation-rn', { fastlane: { ios: { bogus: 1 } } }]] } });",
        });
        const { code, err } = await errorsFor(root);
        expect(code).toBe(1);
        expect(err).toContain('does not support fastlane.ios.bogus');
        expect(err).not.toContain('    at ');
    });
});

describe('formatCommand', () => {
    it('quotes unsafe arguments', () => {
        expect(formatCommand('npx', ['a*', 'b c', "it's"])).toBe("npx 'a*' 'b c' 'it'\\''s'");
    });
});
