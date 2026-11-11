// expo is an optional peer dependency: the CLI must work when it cannot be resolved.
jest.mock('expo/config-plugins', () => {
    throw new Error("Cannot find module 'expo/config-plugins'");
});

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

describe('CLI without expo installed', () => {
    const lines: string[] = [];
    const errors: string[] = [];
    let root: string;

    beforeAll(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'mfrn-noexpo-'));
        fs.writeFileSync(path.join(root, 'package.json'), '{"name":"app","packageManager":"yarn@4.1.0"}');
        fs.writeFileSync(path.join(root, 'yarn.lock'), '__metadata:\n');
    });
    afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

    const run = (argv: string[]) =>
        require('../../bin/lib/cli').main(argv, { out: (l: string) => lines.push(l), err: (l: string) => errors.push(l), env: {} });

    it('cannot load the plugin modules, but the CLI does not need them', () => {
        expect(() => require('../../plugin/fastlane')).toThrow('expo/config-plugins');
        expect(() => require('../../plugin/release-signing')).toThrow('expo/config-plugins');
        expect(() => require('../../plugin/fastlane-options')).not.toThrow();
        expect(() => require('../../plugin/release-signing-options')).not.toThrow();
    });

    it('prints help for the CLI and every command', async () => {
        expect(await run(['--help'])).toBe(0);
        for (const command of ['update-deps', 'update-match', 'generate-android-keystore']) {
            expect(await run([command, '--help'])).toBe(0);
        }
        expect(errors).toEqual([]);
        expect(lines.join('\n')).toContain('Usage: mfrn update-deps');
    });

    it('plans update-deps without expo', async () => {
        lines.length = 0;
        expect(await run(['update-deps', '--dry-run', '--cwd', root])).toBe(0);
        const text = lines.join('\n');
        expect(text).toContain('npm-check-updates');
        expect(text).toContain('would delete yarn.lock');
        expect(errors).toEqual([]);
    });

    it('fails update-match and keystore with a clean message, not a stack', async () => {
        for (const command of ['update-match', 'generate-android-keystore']) {
            errors.length = 0;
            expect(await run([command, '--cwd', root])).toBe(1);
            expect(errors.join('\n')).toMatch(/^mfrn: /);
            expect(errors.join('\n')).not.toContain('    at ');
        }
    });
});
