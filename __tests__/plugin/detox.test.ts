const { withDetox } = require('../../plugin/detox');

const APP_BUILD_GRADLE = `android {
    defaultConfig {
        applicationId 'app.example.test'
    }
    signingConfigs {
        release {
            storeFile file('release.keystore')
        }
    }
    buildTypes {
        debug {
            minifyEnabled false
        }
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            signingConfig signingConfigs.release
        }
    }
    packagingOptions {
        jniLibs {
            useLegacyPackaging false
        }
    }
}

dependencies {
    implementation('com.facebook.react:react-android')
}
`;

const applyAppBuildGradleMod = async (contents: string) => {
    const config = withDetox({
        name: 'PluginTest',
        slug: 'plugin-test',
        android: { package: 'app.example.test' },
    });
    const result = await config.mods.android.appBuildGradle({
        ...config,
        modRequest: {
            introspect: false,
            platform: 'android',
            platformProjectRoot: `${process.cwd()}/android`,
            projectRoot: process.cwd(),
        },
        modResults: { language: 'groovy', contents },
    });
    return result.modResults.contents;
};

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

describe('Detox config plugin release shrinking', () => {
    it('loads Detox keep rules while preserving release optimization and signing', async () => {
        const contents = await applyAppBuildGradleMod(APP_BUILD_GRADLE);

        expect(contents).toContain('android/detox/proguard-rules-app.pro');
        expect(contents).toContain('plugin/detox-proguard-rules.pro');
        expect(contents).toContain(
            "System.getProperty('testBuildType', 'debug') == 'release'",
        );
        expect(contents).toContain("require.resolve('detox/package.json')");
        // The additional rules configure the build type, never the signing
        // config's earlier release block, and leave the app's own rules intact.
        const originalReleaseConfiguration = APP_BUILD_GRADLE.slice(
            APP_BUILD_GRADLE.indexOf('    signingConfigs {'),
            APP_BUILD_GRADLE.indexOf('    packagingOptions {'),
        );
        expect(contents).toContain(originalReleaseConfiguration);
        expect(contents).toContain('android.buildTypes.release {');
    });

    it('is idempotent when Expo reapplies the Gradle mod', async () => {
        const first = await applyAppBuildGradleMod(APP_BUILD_GRADLE);
        const second = await applyAppBuildGradleMod(first);

        expect(second).toBe(first);
    });
});
