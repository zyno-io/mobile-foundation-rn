const fs = require("node:fs/promises");
const path = require("node:path");

const {
    AndroidConfig,
    CodeGenerator,
    createRunOncePlugin,
    withAndroidManifest,
    withAppBuildGradle,
    withDangerousMod,
    withProjectBuildGradle,
} = require("expo/config-plugins");

const PACKAGE = require("../package.json");
const PLUGIN_NAME = `${PACKAGE.name}/detox`;
const ANDROID_PACKAGE_PATTERN =
    /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/;

const mergeGradleContents = (contents, options) =>
    CodeGenerator.mergeContents({
        src: contents,
        comment: "//",
        ...options,
    }).contents;

const assertGroovyMod = (config, fileName) => {
    if (config.modResults.language !== "groovy") {
        throw new Error(`${PLUGIN_NAME} only supports Groovy ${fileName} files`);
    }
};

const assertPositiveInteger = (value, optionName) => {
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(
            `${PLUGIN_NAME} requires ${optionName} to be a positive integer`,
        );
    }
};

const normalizeOptions = (options = {}) => {
    if (
        options === null ||
        typeof options !== "object" ||
        Array.isArray(options)
    ) {
        throw new Error(`${PLUGIN_NAME} requires an options object`);
    }

    const normalized = {
        androidPackage: options.androidPackage,
        allowCleartextTraffic: options.allowCleartextTraffic ?? true,
        disableAutofill: options.disableAutofill ?? true,
        masterTimeoutSec: options.masterTimeoutSec ?? 90,
        idleResourceTimeoutSec: options.idleResourceTimeoutSec ?? 60,
        rnContextLoadTimeoutSec: options.rnContextLoadTimeoutSec ?? 180,
    };

    for (const optionName of ["allowCleartextTraffic", "disableAutofill"]) {
        if (typeof normalized[optionName] !== "boolean") {
            throw new Error(
                `${PLUGIN_NAME} requires ${optionName} to be a boolean`,
            );
        }
    }

    for (const optionName of [
        "masterTimeoutSec",
        "idleResourceTimeoutSec",
        "rnContextLoadTimeoutSec",
    ]) {
        assertPositiveInteger(normalized[optionName], optionName);
    }

    return normalized;
};

const withDetoxRepository = (config) =>
    withProjectBuildGradle(config, (modConfig) => {
        assertGroovyMod(modConfig, "build.gradle");
        modConfig.modResults.contents = mergeGradleContents(
            modConfig.modResults.contents,
            {
                tag: "detox-maven-repository",
                anchor: /^allprojects \{$/,
                offset: 2,
                newSrc: `    maven {
      def detoxPackageDirectory = ["node", "--print", "require('path').dirname(require.resolve('detox/package.json'))"].execute(null, rootDir).text.trim()
      url(new File(detoxPackageDirectory, "Detox-android"))
    }`,
            },
        );
        return modConfig;
    });

const withDetoxAppBuildGradle = (config) =>
    withAppBuildGradle(config, (modConfig) => {
        assertGroovyMod(modConfig, "app/build.gradle");

        let contents = modConfig.modResults.contents;
        contents = mergeGradleContents(contents, {
            tag: "detox-instrumentation",
            anchor: /^\s*defaultConfig \{$/,
            offset: 1,
            newSrc: `        testBuildType System.getProperty('testBuildType', 'debug')
        testInstrumentationRunner 'androidx.test.runner.AndroidJUnitRunner'`,
        });
        contents = mergeGradleContents(contents, {
            tag: "detox-native-library-packaging",
            anchor: /^\s*jniLibs \{$/,
            offset: 1,
            newSrc: `            pickFirsts += ['**/libfbjni.so', '**/libc++_shared.so']`,
        });
        contents = mergeGradleContents(contents, {
            tag: "detox-test-dependencies",
            anchor: /^dependencies \{$/,
            offset: 1,
            newSrc: `    androidTestImplementation('com.wix:detox:+') { transitive = true }
    androidTestImplementation 'junit:junit:4.13.2'`,
        });

        modConfig.modResults.contents = contents;
        return modConfig;
    });

const withDetoxManifest = (config, options) =>
    withAndroidManifest(config, (modConfig) => {
        const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
            modConfig.modResults,
        );
        if (options.allowCleartextTraffic) {
            application.$["android:usesCleartextTraffic"] = "true";
        }

        if (options.disableAutofill) {
            const activity = AndroidConfig.Manifest.getMainActivityOrThrow(
                modConfig.modResults,
            );
            activity.$["android:importantForAutofill"] =
                "noExcludeDescendants";
        }

        return modConfig;
    });

const createDetoxTest = (androidPackage, options) => `package ${androidPackage};

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
        detoxConfig.idlePolicyConfig.masterTimeoutSec = ${options.masterTimeoutSec};
        detoxConfig.idlePolicyConfig.idleResourceTimeoutSec = ${options.idleResourceTimeoutSec};
        detoxConfig.rnContextLoadTimeoutSec = ${options.rnContextLoadTimeoutSec};

        Detox.runTests(mActivityRule, detoxConfig);
    }
}
`;

const withDetoxTest = (config, options) =>
    withDangerousMod(config, [
        "android",
        async (modConfig) => {
            const androidPackage =
                options.androidPackage ?? modConfig.android?.package;
            if (
                typeof androidPackage !== "string" ||
                !ANDROID_PACKAGE_PATTERN.test(androidPackage)
            ) {
                throw new Error(
                    `${PLUGIN_NAME} requires androidPackage or expo.android.package to be a valid Java package name`,
                );
            }

            const testDirectory = path.join(
                modConfig.modRequest.platformProjectRoot,
                "app",
                "src",
                "androidTest",
                "java",
                ...androidPackage.split("."),
            );
            await fs.mkdir(testDirectory, { recursive: true });
            await fs.writeFile(
                path.join(testDirectory, "DetoxTest.java"),
                createDetoxTest(androidPackage, options),
            );

            return modConfig;
        },
    ]);

const withDetox = (config, rawOptions = {}) => {
    const options = normalizeOptions(rawOptions);
    config = withDetoxRepository(config);
    config = withDetoxAppBuildGradle(config);
    config = withDetoxManifest(config, options);
    config = withDetoxTest(config, options);
    return config;
};

module.exports = createRunOncePlugin(
    withDetox,
    PLUGIN_NAME,
    PACKAGE.version,
);
module.exports.createDetoxTest = createDetoxTest;
module.exports.withDetox = withDetox;
