const fs = require('fs/promises');
const path = require('path');

const {
    AndroidConfig,
    CodeGenerator,
    createRunOncePlugin,
    withAndroidManifest,
    withAppBuildGradle,
    withDangerousMod,
    withProjectBuildGradle,
} = require('expo/config-plugins');

const PLUGIN_NAME = 'with-detox';
const PLUGIN_VERSION = '1.0.0';

function mergeGradleContents(contents, options) {
    return CodeGenerator.mergeContents({
        src: contents,
        comment: '//',
        ...options,
    }).contents;
}

function assertGroovyMod(config, fileName) {
    if (config.modResults.language !== 'groovy') {
        throw new Error(`${PLUGIN_NAME} only supports Groovy ${fileName} files`);
    }
}

function withDetoxRepository(config) {
    return withProjectBuildGradle(config, config => {
        assertGroovyMod(config, 'build.gradle');
        config.modResults.contents = mergeGradleContents(config.modResults.contents, {
            tag: 'detox-maven-repository',
            anchor: /^allprojects \{$/,
            offset: 2,
            newSrc: `    maven {
      url "$rootDir/../node_modules/detox/Detox-android"
    }`,
        });
        return config;
    });
}

function withDetoxAppBuildGradle(config) {
    return withAppBuildGradle(config, config => {
        assertGroovyMod(config, 'app/build.gradle');

        let contents = config.modResults.contents;
        contents = mergeGradleContents(contents, {
            tag: 'detox-instrumentation',
            anchor: /^\s*defaultConfig \{$/,
            offset: 1,
            newSrc: `        testBuildType System.getProperty('testBuildType', 'debug')
        testInstrumentationRunner 'androidx.test.runner.AndroidJUnitRunner'`,
        });
        contents = mergeGradleContents(contents, {
            tag: 'detox-native-library-packaging',
            anchor: /^\s*jniLibs \{$/,
            offset: 1,
            newSrc: `            pickFirsts += ['**/libfbjni.so', '**/libc++_shared.so']`,
        });
        contents = mergeGradleContents(contents, {
            tag: 'detox-test-dependencies',
            anchor: /^dependencies \{$/,
            offset: 1,
            newSrc: `    androidTestImplementation('com.wix:detox:+')
    androidTestImplementation 'junit:junit:4.13.2'`,
        });

        config.modResults.contents = contents;
        return config;
    });
}

function withDetoxManifest(config) {
    return withAndroidManifest(config, config => {
        const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
        application.$['android:usesCleartextTraffic'] = 'true';

        const activity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
        activity.$['android:importantForAutofill'] = 'noExcludeDescendants';

        return config;
    });
}

function createDetoxTest(androidPackage) {
    return `package ${androidPackage};

import com.wix.detox.Detox;
import com.wix.detox.config.DetoxConfig;

import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.LargeTest;
import androidx.test.rule.ActivityTestRule;

@RunWith(AndroidJUnit4.class)
@LargeTest
public class DetoxTest {
    @Rule
    public ActivityTestRule<MainActivity> mActivityRule = new ActivityTestRule<>(MainActivity.class, false, false);

    @Test
    public void runDetoxTests() {
        DetoxConfig detoxConfig = new DetoxConfig();
        detoxConfig.idlePolicyConfig.masterTimeoutSec = 90;
        detoxConfig.idlePolicyConfig.idleResourceTimeoutSec = 60;
        detoxConfig.rnContextLoadTimeoutSec = 180;

        Detox.runTests(mActivityRule, detoxConfig);
    }
}
`;
}

function withDetoxTest(config) {
    return withDangerousMod(config, ['android', async config => {
        const androidPackage = config.android?.package;
        if (!androidPackage) {
            throw new Error(`${PLUGIN_NAME} requires expo.android.package`);
        }

        const testDirectory = path.join(
            config.modRequest.projectRoot,
            'android',
            'app',
            'src',
            'androidTest',
            'java',
            ...androidPackage.split('.'),
        );
        await fs.mkdir(testDirectory, { recursive: true });
        await fs.writeFile(path.join(testDirectory, 'DetoxTest.java'), createDetoxTest(androidPackage));

        return config;
    }]);
}

function withDetox(config) {
    config = withDetoxRepository(config);
    config = withDetoxAppBuildGradle(config);
    config = withDetoxManifest(config);
    config = withDetoxTest(config);
    return config;
}

module.exports = createRunOncePlugin(withDetox, PLUGIN_NAME, PLUGIN_VERSION);
