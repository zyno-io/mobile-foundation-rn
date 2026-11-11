const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { main, parseCommandLine } = require('../../bin/lib/cli');
const { createRunner, formatCommand } = require('../../bin/lib/util');
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
    const run = (argv: string[]) => {
        const out: string[] = [];
        const err: string[] = [];
        const code = main(argv, { out: (l: string) => out.push(l), err: (l: string) => err.push(l) });
        return { code, out: out.join('\n'), err: err.join('\n') };
    };

    it('prints usage for --help and no args', () => {
        expect(run(['--help']).out).toContain('Usage: mfrn <command>');
        expect(run([]).code).toBe(0);
        expect(run(['update-match', '--help']).out).toContain('Usage: mfrn update-match');
    });

    it('fails on unknown commands and flags with usage', () => {
        const unknown = run(['nope']);
        expect(unknown.code).toBe(2);
        expect(unknown.err).toContain('unknown command "nope"');
        expect(unknown.err).toContain('Usage: mfrn <command>');
        expect(run(['update-match', '--bogus']).code).toBe(2);
        expect(run(['update-deps', 'extra']).code).toBe(2);
        expect(run(['update-deps', '--', 'x']).code).toBe(2);
    });

    it('requires package.json in --cwd', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mfrn-test-'));
        tmp.push(dir);
        const result = run(['update-match', '--cwd', dir]);
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
    it('echoes commands and does not spawn in dry-run', () => {
        const log = jest.fn();
        const spawnSync = jest.fn();
        const runner = createRunner({ dryRun: true, log, spawnSync });
        runner.run('yarn', ['add', 'a b']);
        expect(log).toHaveBeenCalledWith("$ yarn add 'a b'");
        expect(spawnSync).not.toHaveBeenCalled();
    });

    it('aborts on non-zero exit and merges env without echoing it', () => {
        const log = jest.fn();
        const spawnSync = jest.fn().mockReturnValue({ status: 3, stdout: '' });
        const runner = createRunner({ log, spawnSync, baseEnv: { A: '1' } });
        expect(() => runner.run('x', ['y'], { env: { SECRET: 's' } })).toThrow('command failed (exit 3): x y');
        expect(spawnSync.mock.calls[0][2].env).toEqual({ A: '1', SECRET: 's' });
        expect(JSON.stringify(log.mock.calls)).not.toContain('SECRET');
    });
});

describe('update-deps', () => {
    const pm = { name: 'yarn', lockfile: 'yarn.lock', install: ['yarn'] };
    const plan = (extra: any = {}) =>
        updateDeps.buildUpdateDepsPlan({
            pm,
            ncuCli: '/f/ncu.js',
            expoCli: '/p/expo.js',
            patchPackageCli: '/p/pp.js',
            hasExpo: true,
            hasPatches: true,
            ...extra,
        });

    it('plans commands with the resolved node binaries, not npx', () => {
        const steps = plan({ trusted: ['@acme*', '@other*'], reject: ['react', 'foo'], cooldown: '5d' });
        const cmds = steps.filter((s: any) => s.cmd).map((s: any) => [s.cmd, ...s.args]);
        const node = process.execPath;
        expect(cmds).toEqual([
            [node, '/f/ncu.js', '-u', '--cooldown', '5d', '--reject', 'react,foo'],
            [node, '/f/ncu.js', '-u', '@acme*', '--reject', 'react,foo'],
            [node, '/f/ncu.js', '-u', '@other*', '--reject', 'react,foo'],
            ['yarn'],
            [node, '/p/expo.js', 'install', '--fix'],
            ['yarn'],
            [node, '/p/pp.js', '--error-on-fail'],
        ]);
        expect(JSON.stringify(cmds)).not.toContain('npx');
        expect(steps.map((s: any) => s.type)).toEqual([
            'preflight', 'backup', 'cmd', 'cmd', 'cmd', 'remove-lockfile', 'touch-lockfile', 'cmd', 'cmd', 'cmd', 'patch-check', 'summary',
        ]);
    });

    it('omits expo, patches, preflight and lockfile touch when not applicable (npm)', () => {
        const steps = plan({ pm: { name: 'npm', lockfile: 'package-lock.json', install: ['npm', 'install'] }, hasExpo: false, hasPatches: false });
        const types = steps.map((s: any) => s.type);
        expect(types).not.toContain('preflight');
        expect(types).not.toContain('touch-lockfile');
        expect(types).not.toContain('patch-check');
        expect(steps.filter((s: any) => s.cmd && s.cmd === 'npm')).toHaveLength(2);
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
        expect(updateDeps.parsePatchName('react-native-screens+4.26.2.patch')).toMatchObject({ name: 'react-native-screens', version: '4.26.2', tail: '' });
        expect(updateDeps.parsePatchName('@scope+pkg+1.0.0-beta.1.patch')).toMatchObject({ name: '@scope/pkg', version: '1.0.0-beta.1', prefix: '@scope+pkg' });
        expect(updateDeps.parsePatchName('pkg+1.2.3+001+fix.patch')).toMatchObject({ name: 'pkg', tail: '+001+fix' });
        expect(updateDeps.parsePatchName('a++b+1.0.0.patch').skip).toMatch('nested');
        expect(updateDeps.parsePatchName('weird.patch').skip).toMatch('version');
        expect(updateDeps.parsePatchName('@scope+1.0.0.patch').skip).toBeDefined();
    });

    describe('patches on disk', () => {
        const project = () => {
            const dir = mkProject({
                'patches/foo+1.0.0.patch': 'p',
                'patches/@s+bar+2.0.0+001+x.patch': 'p',
                'patches/same+1.0.0.patch': 'p',
                'patches/nested++pkg+1.0.0.patch': 'p',
                'patches/gone+1.0.0.patch': 'p',
                'node_modules/foo/package.json': '{"version":"1.1.0"}',
                'node_modules/@s/bar/package.json': '{"version":"2.1.0"}',
                'node_modules/same/package.json': '{"version":"1.0.0"}',
            });
            return dir;
        };

        it('detects mismatches and notes', () => {
            const { mismatches, notes } = updateDeps.checkPatches(project());
            expect(mismatches.map((m: any) => m.renamedTo)).toEqual(['@s+bar+2.1.0+001+x.patch', 'foo+1.1.0.patch']);
            expect(notes.join('\n')).toContain('nested++pkg+1.0.0.patch');
            expect(notes.join('\n')).toContain('gone is not installed');
        });

        it('renames with fs when untracked and git mv when tracked', () => {
            const dir = project();
            const { mismatches } = updateDeps.checkPatches(dir);
            const run = jest.fn();
            const runner = { log: jest.fn(), run };
            const spawnSync = jest.fn((cmd: string, args: string[]) => ({ status: args[2] === 'patches/foo+1.0.0.patch' ? 0 : 1 }));
            updateDeps.renamePatches({ projectRoot: dir, mismatches, runner, spawnSync });
            expect(run).toHaveBeenCalledWith('git', ['mv', 'patches/foo+1.0.0.patch', 'patches/foo+1.1.0.patch'], { cwd: dir });
            expect(fs.existsSync(path.join(dir, 'patches/@s+bar+2.1.0+001+x.patch'))).toBe(true);
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
        const setup = (failOn?: string) => {
            const dir = mkProject({ 'yarn.lock': 'original lock' });
            fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"app","dependencies":{"a":"^1.0.0"}}');
            const log = jest.fn();
            const run = jest.fn((cmd: string, args: string[]) => {
                if (args[0] === '/f/ncu.js' && args.includes('--cooldown')) {
                    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"app","dependencies":{"a":"^2.0.0"}}');
                }
                if (failOn && args.includes(failOn)) throw new Error('boom');
                return { status: 0, stdout: '' };
            });
            const runner = { dryRun: false, log, run };
            const steps = updateDeps.buildUpdateDepsPlan({ pm, ncuCli: '/f/ncu.js', hasExpo: false, hasPatches: false });
            return { dir, log, run, runner, steps };
        };

        it('runs the preflight first, aborting before any file change', () => {
            const { dir, run, runner, steps } = setup();
            run.mockImplementationOnce(() => ({ status: 0, stdout: '{"acme":{"npmAlwaysAuth":true,"npmRegistryServer":"https://registry.example.com"}}' }));
            run.mockImplementationOnce(() => ({ status: 1, stdout: '' }));
            expect(() => updateDeps.executeUpdateDeps({ projectRoot: dir, pm, plan: steps, options: {}, runner })).toThrow(
                /scope @acme \(https:\/\/registry.example.com\).*nothing was modified.*yarn npm login --scope acme/,
            );
            expect(run.mock.calls[1]).toEqual(['yarn', ['npm', 'whoami', '--scope', 'acme'], expect.anything()]);
            expect(fs.readFileSync(path.join(dir, 'yarn.lock'), 'utf8')).toBe('original lock');
            expect(run).toHaveBeenCalledTimes(2);
        });

        it('restores package.json and the lockfile on failure', () => {
            const { dir, runner, steps } = setup('--fix');
            const withExpo = updateDeps.buildUpdateDepsPlan({ pm, ncuCli: '/f/ncu.js', expoCli: '--fix', hasExpo: true, hasPatches: false });
            const failing = withExpo.map((s: any) => (s.cmd === process.execPath && s.args[0] === '--fix' ? { ...s, args: ['--fix'] } : s));
            expect(() => updateDeps.executeUpdateDeps({ projectRoot: dir, pm, plan: failing, options: {}, runner })).toThrow('boom');
            expect(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).toContain('^1.0.0');
            expect(fs.readFileSync(path.join(dir, 'yarn.lock'), 'utf8')).toBe('original lock');
            expect(steps.length).toBeGreaterThan(0);
        });

        it('recreates an empty lockfile on success and reports majors', () => {
            const { dir, log, runner, steps } = setup();
            expect(updateDeps.executeUpdateDeps({ projectRoot: dir, pm, plan: steps, options: {}, runner })).toBe(0);
            expect(fs.readFileSync(path.join(dir, 'yarn.lock'), 'utf8')).toBe('');
            expect(log.mock.calls.map((c: any[]) => c[0]).join('\n')).toContain('a: ^1.0.0 -> ^2.0.0');
        });

        it('exits non-zero without restoring when patch-package fails', () => {
            const { dir, runner } = setup();
            const steps = updateDeps.buildUpdateDepsPlan({ pm, ncuCli: '/f/ncu.js', patchPackageCli: '/p/pp.js', hasExpo: false, hasPatches: true });
            const original = runner.run;
            runner.run = jest.fn((cmd: string, args: string[], o: any) => (args[0] === '/p/pp.js' ? { status: 1, stdout: '' } : original(cmd, args, o)));
            expect(updateDeps.executeUpdateDeps({ projectRoot: dir, pm, plan: steps, options: { renamePatches: true }, runner })).toBe(1);
            expect(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).toContain('^2.0.0');
        });

        it('changes nothing in dry-run', () => {
            const dir = mkProject({ 'yarn.lock': 'original lock' });
            const log = jest.fn();
            const runner = createRunner({ dryRun: true, log, spawnSync: jest.fn() });
            const steps = updateDeps.buildUpdateDepsPlan({ pm, ncuCli: '/f/ncu.js', hasExpo: false, hasPatches: false });
            expect(updateDeps.executeUpdateDeps({ projectRoot: dir, pm, plan: steps, options: {}, runner })).toBe(0);
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
        expect(() => build({ pluginOptions: options({ matchGitUrl: undefined }) })).toThrow('no match git URL');
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
        expect(resolve(root)).toEqual({
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
        const exec = (root: string, { env = {}, spawn = { status: 0 }, listing = 'SHA1: AA:BB\n SHA256: CC:DD' }: any = {}) => {
            const log = jest.fn();
            const run = jest.fn((cmd: string, args: string[]) => ({ status: 0, stdout: args[0] === '-list' ? listing : '' }));
            const runner = { dryRun: false, log, run };
            keystore.run({
                values: {},
                projectRoot: root,
                runner,
                env,
                loadConfig: () => ({ exp, pluginOptions: {} }),
                spawnSync: () => spawn,
            });
            return { log, run, output: log.mock.calls.map((c: any[]) => c[0]).join('\n') };
        };

        it('prints a generated password once and passes it by env only', () => {
            const root = mkProject();
            const { run, output } = exec(root, { listing: 'SHA1: AA:BB:CC\n SHA256: DD:EE:FF' });
            const password = run.mock.calls[0][2].env.APK_KS_PASSWORD;
            expect(password).toHaveLength(32);
            expect(JSON.stringify(run.mock.calls.map((c: any[]) => c[1]))).not.toContain(password);
            expect(output.split(password).length - 1).toBe(1);
            expect(output).toContain('SHA-1:   AA:BB:CC');
            expect(output).toContain('upload key');
            expect(fs.existsSync(path.join(root, 'resources/native/android'))).toBe(true);
        });

        it('uses a provided password and never prints it', () => {
            const { output, run } = exec(mkProject(), { env: { APK_KS_PASSWORD: 'from-env-secret' } });
            expect(run.mock.calls[0][2].env.APK_KS_PASSWORD).toBe('from-env-secret');
            expect(output).not.toContain('from-env-secret');
        });

        it('errors when keytool is missing', () => {
            expect(() => exec(mkProject(), { spawn: { error: new Error('ENOENT') } })).toThrow('JDK is required');
        });

        it('dry-run only echoes', () => {
            const root = mkProject();
            const log = jest.fn();
            const spawnSync = jest.fn();
            const runner = createRunner({ dryRun: true, log, spawnSync });
            keystore.run({ values: {}, projectRoot: root, runner, env: {}, loadConfig: () => ({ exp, pluginOptions: {} }), spawnSync: () => ({ status: 0 }) });
            expect(spawnSync).not.toHaveBeenCalled();
            expect(fs.existsSync(path.join(root, 'resources'))).toBe(false);
            expect(log.mock.calls.map((c: any[]) => c[0]).join('\n')).toContain('$ keytool -genkeypair -v');
        });
    });
});

describe('formatCommand', () => {
    it('quotes unsafe arguments', () => {
        expect(formatCommand('npx', ['a*', 'b c', "it's"])).toBe("npx 'a*' 'b c' 'it'\\''s'");
    });
});
