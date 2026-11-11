const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { patchSentryAppBuildGradle, patchXcodeEnv, withSentryAutoUpload } = require('../../plugin/sentry');
// The Sentry package has no exports map and jest only maps the bare specifier.
const { modifyAppBuildGradle } = require('@sentry/react-native/plugin/build/withSentryAndroid');

const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'app-build.gradle'), 'utf8');
const TAG = 'mobile-foundation-sentry-auto-upload';
const OVERRIDE = 'project.ext.shouldSentryAutoUploadGeneral';
const SENTRY_LINE = 'project.ext.shouldSentryAutoUploadGeneral = { -> return false }';
const XCODE_ENV = '# .xcode.env\nexport NODE_BINARY=$(command -v node)\n';

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe('patchSentryAppBuildGradle', () => {
    it('inserts the block before dependencies { and is idempotent', () => {
        const once = patchSentryAppBuildGradle(FIXTURE, true);
        expect(once).toContain(`@generated begin ${TAG}`);
        expect(once.indexOf(OVERRIDE)).toBeLessThan(once.indexOf('\ndependencies {'));
        expect(once).toContain("System.getenv('SENTRY_DISABLE_AUTO_UPLOAD') == 'false'");
        expect(patchSentryAppBuildGradle(once, true)).toBe(once);
    });

    it('removes only its own block when disabled', () => {
        const once = patchSentryAppBuildGradle(FIXTURE, true);
        expect(patchSentryAppBuildGradle(once, false)).toBe(FIXTURE);
    });

    it('throws when the dependencies anchor is missing', () => {
        expect(() => patchSentryAppBuildGradle('android {}\n', true)).toThrow(
            /could not find the top-level "dependencies \{" block in android\/app\/build\.gradle; review the updated Expo template/,
        );
    });
});

describe('compatibility with the Sentry Expo plugin', () => {
    it('foundation then Sentry(false): foundation line survives', () => {
        const foundation = patchSentryAppBuildGradle(FIXTURE, true);
        const result = modifyAppBuildGradle(foundation, false);
        expect(result).toContain(`@generated begin ${TAG}`);
        expect(result).toContain(OVERRIDE);
        expect(result).toContain('sentry.gradle.kts');
    });

    it('foundation then Sentry(true): Sentry adds no extra line once apply from exists, and foundation wins on first add', () => {
        // Fresh add: Sentry inserts its own override next to `apply from`; foundation's later assignment wins.
        const fresh = modifyAppBuildGradle(patchSentryAppBuildGradle(FIXTURE, true), true);
        expect(fresh.indexOf(SENTRY_LINE)).toBeGreaterThan(-1);
        expect(fresh.lastIndexOf(OVERRIDE)).toBeGreaterThan(fresh.indexOf(SENTRY_LINE));
        expect(fresh.slice(fresh.lastIndexOf(OVERRIDE))).toContain("System.getenv('SENTRY_DISABLE_AUTO_UPLOAD')");

        // Existing apply from (the prebuild --no-clean case): Sentry sees the override and adds nothing.
        const withApply = modifyAppBuildGradle(FIXTURE, false);
        const result = modifyAppBuildGradle(patchSentryAppBuildGradle(withApply, true), true);
        expect(result).not.toContain(SENTRY_LINE);
        expect(count(result, OVERRIDE)).toBe(1);
    });

    it('Sentry first then foundation: block lands after apply from', () => {
        const sentry = modifyAppBuildGradle(FIXTURE, false);
        const result = patchSentryAppBuildGradle(sentry, true);
        expect(result.indexOf('sentry.gradle.kts')).toBeGreaterThan(-1);
        expect(result.indexOf(OVERRIDE)).toBeGreaterThan(result.indexOf('sentry.gradle.kts'));
    });

    it('rerunning both changes nothing', () => {
        for (const sentryDisable of [true, false]) {
            const first = patchSentryAppBuildGradle(modifyAppBuildGradle(FIXTURE, sentryDisable), true);
            const second = patchSentryAppBuildGradle(modifyAppBuildGradle(first, sentryDisable), true);
            expect(second).toBe(first);
        }
    });
});

describe('patchXcodeEnv', () => {
    it('appends the block, is idempotent, and replaces the legacy line', () => {
        const once = patchXcodeEnv(XCODE_ENV, true);
        expect(once).toContain(`@generated begin ${TAG}`);
        expect(once).toContain('export NODE_BINARY');
        expect(patchXcodeEnv(once, true)).toBe(once);

        const legacy = patchXcodeEnv(`${XCODE_ENV}export SENTRY_DISABLE_AUTO_UPLOAD=true\n`, true);
        expect(legacy).toBe(once);
        expect(count(legacy, 'export SENTRY_DISABLE_AUTO_UPLOAD=true')).toBe(1);
    });

    it('with false removes only its own block and keeps a legacy line', () => {
        const once = patchXcodeEnv(XCODE_ENV, true);
        expect(patchXcodeEnv(once, false).trimEnd()).toBe(XCODE_ENV.trimEnd());
        const legacy = `${XCODE_ENV}export SENTRY_DISABLE_AUTO_UPLOAD=true\n`;
        expect(patchXcodeEnv(legacy, false)).toBe(legacy);
    });

    it('evaluates with the expected shell semantics', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xcode-env-'));
        try {
            fs.writeFileSync(path.join(dir, '.xcode.env'), patchXcodeEnv(XCODE_ENV, true));
            const run = (value?: string) => {
                const env: Record<string, string> = { PATH: process.env.PATH ?? '' };
                if (value !== undefined) env.SENTRY_DISABLE_AUTO_UPLOAD = value;
                return execFileSync('sh', ['-c', '. ./.xcode.env; printf %s "$SENTRY_DISABLE_AUTO_UPLOAD"'], {
                    cwd: dir,
                    env,
                    encoding: 'utf8',
                });
            };
            expect(run()).toBe('true');
            expect(run('true')).toBe('true');
            expect(run('false')).toBe('false');
            expect(run('1')).toBe('true');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('withSentryAutoUpload', () => {
    let root: string;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'sentry-'));
        fs.mkdirSync(path.join(root, 'ios'));
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    const runIos = (disable?: boolean) => {
        const config = withSentryAutoUpload({ name: 'T', slug: 't' }, disable);
        return config.mods.ios.dangerous({
            ...config,
            modRequest: { projectRoot: root, platformProjectRoot: path.join(root, 'ios') },
            modResults: undefined,
        });
    };

    it('a missing .xcode.env throws when disabling and is a no-op otherwise', async () => {
        await expect(runIos(true)).rejects.toThrow('could not find ios/.xcode.env');
        await expect(runIos(false)).resolves.toBeDefined();
    });

    it('writes the block into .xcode.env', async () => {
        fs.writeFileSync(path.join(root, 'ios/.xcode.env'), XCODE_ENV);
        await runIos(undefined);
        expect(fs.readFileSync(path.join(root, 'ios/.xcode.env'), 'utf8')).toContain(`@generated begin ${TAG}`);
    });

    it('rejects a non-boolean option', () => {
        expect(() => withSentryAutoUpload({ name: 'T', slug: 't' }, 'yes')).toThrow(
            '@zyno-io/mobile-foundation-rn requires disableSentryAutoUpload to be a boolean',
        );
    });
});
