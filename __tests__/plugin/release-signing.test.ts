const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    createReleaseSigningConfig,
    normalizeReleaseSigningOptions,
    patchReleaseSigning,
    withReleaseSigning,
} = require('../../plugin/release-signing');

const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'app-build.gradle'), 'utf8');
const PLUGIN = '@zyno-io/mobile-foundation-rn/release-signing';
const TAG = 'mobile-foundation-release-signing';

const opts = (raw?: any) => normalizeReleaseSigningOptions(raw === undefined ? true : raw);

describe('patchReleaseSigning', () => {
    it("injects the 'local' config after signingConfigs { and points release at it (matches the app-local block it replaces)", () => {
        const { contents } = patchReleaseSigning(FIXTURE, opts());
        expect(contents).toContain(`// @generated begin ${TAG} - expo prebuild (DO NOT MODIFY) sync-11d467d045eb6b47a709a7eb69e7b7a3d263d7d3`);
        expect(contents).toContain('    signingConfigs {\n// @generated begin');
        expect(contents).toContain('            } else if (!System.getenv(\'CI\')) {');
        expect(contents).toMatch(/release \{\n[^{}]*signingConfig signingConfigs\.release\n/);
        expect(contents).not.toContain('signingConfig signingConfigs.debug\n            // Caution');
    });

    it("renders 'always' and 'never' fallbacks and custom alias/env", () => {
        const always = createReleaseSigningConfig(opts({ debugKeystoreFallback: 'always' }));
        expect(always).toContain('} else {');
        expect(always).toContain("fall back to the debug keystore");
        const never = createReleaseSigningConfig(opts({ debugKeystoreFallback: 'never' }));
        expect(never).not.toContain('debug.keystore');
        expect(never).not.toContain('else');
        const custom = createReleaseSigningConfig(opts({ keyAlias: 'my alias', passwordEnv: 'MY_PW' }));
        expect(custom).toContain("keyAlias 'my alias'");
        expect(custom).toContain("System.getenv('MY_PW')");
        expect(custom).not.toContain('APK_KS_PASSWORD');
    });

    it('is idempotent', () => {
        const once = patchReleaseSigning(FIXTURE, opts()).contents;
        expect(patchReleaseSigning(once, opts()).contents).toBe(once);
    });

    it('throws in explicit mode on a foreign release config and skips in automatic mode', () => {
        const legacy = FIXTURE.replace('    signingConfigs {\n', '    signingConfigs {\n        // @generated begin app-release-signing - x\n        release {\n            storeFile file(\'x\')\n        }\n        // @generated end app-release-signing\n');
        expect(() => patchReleaseSigning(legacy, opts(true))).toThrow(/did not generate/);
        const result = patchReleaseSigning(legacy, normalizeReleaseSigningOptions(undefined));
        expect(result.skipped).toBe(true);
        expect(result.contents).toBe(legacy);
    });

    it('throws when anchors are missing', () => {
        expect(() => patchReleaseSigning(FIXTURE.replace('    signingConfigs {', '    signingConfigz {'), opts())).toThrow(
            /could not find the "signingConfigs \{" block in android\/app\/build\.gradle; review the updated Expo template/,
        );
        expect(() => patchReleaseSigning(FIXTURE.replaceAll('signingConfig signingConfigs.debug', '// none'), opts())).toThrow(
            /release build type's "signingConfig signingConfigs\.<name>" line/,
        );
    });

    it('undo path removes the block and reverts to debug', () => {
        const injected = patchReleaseSigning(FIXTURE, opts()).contents;
        expect(patchReleaseSigning(injected, null).contents).toBe(FIXTURE);
    });

    it('undo path returns input unchanged when there is no block, and keeps release when another exists', () => {
        expect(patchReleaseSigning(FIXTURE, null)).toEqual({ contents: FIXTURE, skipped: false });
        const injected = patchReleaseSigning(FIXTURE, opts()).contents;
        // Add a second, foreign release block outside the generated region.
        const foreign = injected.replace(
            '        debug {\n            storeFile',
            "        release {\n            storeFile file('x')\n        }\n        debug {\n            storeFile",
        );
        const result = patchReleaseSigning(foreign, null).contents;
        expect(result).not.toContain(TAG);
        expect(result).toContain('signingConfig signingConfigs.release');
    });
});

describe('normalizeReleaseSigningOptions', () => {
    it('returns null for false and defaults otherwise', () => {
        expect(normalizeReleaseSigningOptions(false)).toBeNull();
        expect(normalizeReleaseSigningOptions(undefined)).toEqual({
            explicit: false,
            keystorePath: 'resources/native/android/signer.jks',
            keyAlias: 'key0',
            passwordEnv: 'APK_KS_PASSWORD',
            debugKeystoreFallback: 'local',
        });
        expect(normalizeReleaseSigningOptions(true).explicit).toBe(true);
        expect(normalizeReleaseSigningOptions({}).explicit).toBe(true);
    });

    it.each([
        [{ debugKeystoreFallback: 'sometimes' }],
        [{ keyAlias: "a'b" }],
        [{ passwordEnv: '1BAD' }],
        [{ unknown: 1 }],
        [{ keystorePath: '' }],
        ['yes'],
    ])('rejects invalid options %j', (raw) => {
        expect(() => normalizeReleaseSigningOptions(raw)).toThrow(PLUGIN);
    });
});

describe('withReleaseSigning mods', () => {
    let root: string;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-signing-'));
        fs.mkdirSync(path.join(root, 'android'));
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    const modRequest = () => ({
        introspect: false,
        platform: 'android',
        projectRoot: root,
        platformProjectRoot: path.join(root, 'android'),
    });
    const runDangerous = (raw: any) => {
        const config = withReleaseSigning({ name: 'T', slug: 't' }, raw);
        return config.mods.android.dangerous({ ...config, modRequest: modRequest(), modResults: undefined });
    };
    const runGradle = async (raw: any, language = 'groovy', contents = FIXTURE) => {
        const config = withReleaseSigning({ name: 'T', slug: 't' }, raw);
        const result = await config.mods.android.appBuildGradle({
            ...config,
            modRequest: modRequest(),
            modResults: { language, contents },
        });
        return result.modResults.contents as string;
    };
    const writeKeystore = () => {
        fs.mkdirSync(path.join(root, 'resources/native/android'), { recursive: true });
        fs.writeFileSync(path.join(root, 'resources/native/android/signer.jks'), 'jks');
    };

    it('(a) automatic without a keystore leaves Gradle unchanged and copies nothing', async () => {
        await runDangerous(undefined);
        expect(await runGradle(undefined)).toBe(FIXTURE);
        expect(fs.existsSync(path.join(root, 'android/signer.jks'))).toBe(false);
    });

    it('(b) automatic with a keystore injects and copies', async () => {
        writeKeystore();
        await runDangerous(undefined);
        expect(await runGradle(undefined)).toContain(TAG);
        expect(fs.readFileSync(path.join(root, 'android/signer.jks'), 'utf8')).toBe('jks');
    });

    it('(c) true with no keystore throws', async () => {
        await expect(runDangerous(true)).rejects.toThrow('could not find the release keystore at resources/native/android/signer.jks');
        await expect(runGradle(true)).rejects.toThrow('could not find the release keystore');
    });

    it('(d) keystorePath inside android/ throws', async () => {
        await expect(runDangerous({ keystorePath: 'android/signer.jks' })).rejects.toThrow(
            'requires keystorePath to be outside the generated android/ directory',
        );
    });

    it('(e) false with a non-Groovy file does not throw', async () => {
        await expect(runGradle(false, 'kt', 'plugins {}')).resolves.toBe('plugins {}');
    });

    it('(e2) injection with a non-Groovy file throws', async () => {
        writeKeystore();
        await expect(runGradle(undefined, 'kt', 'plugins {}')).rejects.toThrow('only supports Groovy');
    });

    it('(f) invalid options throw at plugin evaluation', () => {
        for (const raw of [{ debugKeystoreFallback: 'x' }, { keyAlias: "a'b" }, { passwordEnv: 'a-b' }, { nope: true }]) {
            expect(() => withReleaseSigning({ name: 'T', slug: 't' }, raw)).toThrow(PLUGIN);
        }
    });

    it('(g) automatic with a conflicting release config warns and leaves the config alone', async () => {
        writeKeystore();
        const conflicting = FIXTURE.replace('    signingConfigs {\n', "    signingConfigs {\n        release {\n            storeFile file('x')\n        }\n");
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            expect(await runGradle(undefined, 'groovy', conflicting)).toBe(conflicting);
            expect(warn).toHaveBeenCalled();
        } finally {
            warn.mockRestore();
        }
    });
});
