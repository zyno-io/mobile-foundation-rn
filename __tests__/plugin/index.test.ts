const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const withMobileFoundation = require('../../plugin');
const { FOUNDATION_GRADLE_PROPERTY_DEFAULTS } = require('../../plugin');

const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'app-build.gradle'), 'utf8');
const TEMPLATE_PROPERTIES = [
    { type: 'property', key: 'android.enableMinifyInReleaseBuilds', value: 'true' },
    { type: 'property', key: 'org.gradle.parallel', value: 'true' },
];

const runGradleProperties = async (options?: any) => {
    const config = withMobileFoundation({ name: 'T', slug: 't' }, options);
    const result = await config.mods.android.gradleProperties({
        ...config,
        modRequest: { introspect: false },
        modResults: TEMPLATE_PROPERTIES.map((p) => ({ ...p })),
    });
    return Object.fromEntries(result.modResults.map((p: any) => [p.key, p.value]));
};

describe('combined plugin', () => {
    it('exports the defaults', () => {
        expect(FOUNDATION_GRADLE_PROPERTY_DEFAULTS).toEqual({ 'android.enableMinifyInReleaseBuilds': false });
    });

    it('turns R8 off by default', async () => {
        expect(await runGradleProperties()).toMatchObject({ 'android.enableMinifyInReleaseBuilds': 'false' });
        expect(await runGradleProperties({})).toMatchObject({ 'android.enableMinifyInReleaseBuilds': 'false' });
    });

    it('lets user values win and keeps other properties', async () => {
        const props = await runGradleProperties({
            androidBuildProperties: { gradleProperties: { 'android.enableMinifyInReleaseBuilds': true, 'org.gradle.jvmargs': '-Xmx1g' } },
        });
        expect(props).toMatchObject({
            'android.enableMinifyInReleaseBuilds': 'true',
            'org.gradle.jvmargs': '-Xmx1g',
            'org.gradle.parallel': 'true',
        });
    });

    it('leaves R8 to expo-build-properties when the app configures minify there', async () => {
        for (const key of ['enableMinifyInReleaseBuilds', 'enableProguardInReleaseBuilds']) {
            const base = { name: 'T', slug: 't', plugins: [['expo-build-properties', { android: { [key]: true } }]] };
            expect(withMobileFoundation(base).mods?.android?.gradleProperties).toBeUndefined();

            const config = withMobileFoundation(base, { androidBuildProperties: { gradleProperties: { 'org.gradle.jvmargs': '-Xmx1g' } } });
            const result = await config.mods.android.gradleProperties({
                ...config,
                modRequest: { introspect: false },
                modResults: TEMPLATE_PROPERTIES.map((p) => ({ ...p })),
            });
            expect(Object.fromEntries(result.modResults.map((p: any) => [p.key, p.value]))).toMatchObject({
                'android.enableMinifyInReleaseBuilds': 'true',
                'org.gradle.jvmargs': '-Xmx1g',
            });
        }
    });

    it('keeps the R8 default when expo-build-properties does not configure minify', async () => {
        const config = withMobileFoundation({
            name: 'T',
            slug: 't',
            plugins: ['expo-build-properties', ['expo-build-properties', { android: { extraMavenRepos: [] } }]],
        });
        const result = await config.mods.android.gradleProperties({
            ...config,
            modRequest: { introspect: false },
            modResults: TEMPLATE_PROPERTIES.map((p) => ({ ...p })),
        });
        expect(Object.fromEntries(result.modResults.map((p: any) => [p.key, p.value]))).toMatchObject({
            'android.enableMinifyInReleaseBuilds': 'false',
        });
    });

    it('still throws the existing message for a null androidBuildProperties', () => {
        expect(() => withMobileFoundation({ name: 'T', slug: 't' }, { androidBuildProperties: null })).toThrow(
            '@zyno-io/mobile-foundation-rn/android-build-properties requires an options object',
        );
    });

    it('works with everything disabled', async () => {
        const config = withMobileFoundation(
            { name: 'T', slug: 't' },
            { releaseSigning: false, disableSentryAutoUpload: false, fastlane: false },
        );
        expect(config.mods.android.dangerous).toBeUndefined();
        expect(config.mods.ios?.dangerous).toBeDefined(); // sentry removal still registered
        const result = await config.mods.android.appBuildGradle({
            ...config,
            modRequest: { introspect: false, projectRoot: os.tmpdir() },
            modResults: { language: 'groovy', contents: FIXTURE },
        });
        expect(result.modResults.contents).toBe(FIXTURE);
    });

    it('adds the Sentry block and no signing in the combined appBuildGradle mod without a keystore', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'index-'));
        try {
            const config = withMobileFoundation({ name: 'T', slug: 't' });
            const result = await config.mods.android.appBuildGradle({
                ...config,
                modRequest: { introspect: false, projectRoot: root, platformProjectRoot: path.join(root, 'android') },
                modResults: { language: 'groovy', contents: FIXTURE },
            });
            const contents = result.modResults.contents as string;
            expect(contents).toContain('@generated begin mobile-foundation-sentry-auto-upload');
            expect(contents).not.toContain('mobile-foundation-release-signing');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
