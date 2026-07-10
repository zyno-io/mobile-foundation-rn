const { withDetox } = require('../../plugin/detox');

const createManifest = () => ({
    manifest: {
        $: {
            'xmlns:android': 'http://schemas.android.com/apk/res/android',
        },
        application: [
            {
                $: { 'android:name': '.MainApplication' },
                activity: [
                    {
                        $: {
                            'android:name': '.MainActivity',
                            'android:exported': 'true',
                        },
                        'intent-filter': [
                            {
                                action: [
                                    {
                                        $: {
                                            'android:name':
                                                'android.intent.action.MAIN',
                                        },
                                    },
                                ],
                                category: [
                                    {
                                        $: {
                                            'android:name':
                                                'android.intent.category.LAUNCHER',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    },
});

const applyManifestMod = async (options = {}) => {
    const config = withDetox(
        {
            name: 'PluginTest',
            slug: 'plugin-test',
            android: { package: 'app.example.test' },
        },
        options,
    );

    const result = await config.mods.android.manifest({
        ...config,
        modRequest: {
            introspect: false,
            platform: 'android',
            platformProjectRoot: `${process.cwd()}/android`,
            projectRoot: process.cwd(),
        },
        modResults: createManifest(),
    });

    return result.modResults.manifest.application[0];
};

describe('Detox config plugin manifest settings', () => {
    it('does not enable cleartext traffic by default', async () => {
        const application = await applyManifestMod();

        expect(application.$['android:usesCleartextTraffic']).toBeUndefined();
        expect(
            application.activity[0].$['android:importantForAutofill'],
        ).toBe('noExcludeDescendants');
    });

    it('enables cleartext traffic when explicitly requested', async () => {
        const application = await applyManifestMod({
            allowCleartextTraffic: true,
        });

        expect(application.$['android:usesCleartextTraffic']).toBe('true');
    });

    it('leaves autofill unchanged when explicitly requested', async () => {
        const application = await applyManifestMod({
            disableAutofill: false,
        });

        expect(
            application.activity[0].$['android:importantForAutofill'],
        ).toBeUndefined();
    });
});
