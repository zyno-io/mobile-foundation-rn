const {
    AndroidConfig,
    withAppBuildGradle,
    withDangerousMod,
    withStringsXml,
} = require("expo/config-plugins");

const {
    withAndroidBuildProperties,
} = require("./android-build-properties");
const { withDetox } = require("./detox");
const { withFastlane } = require("./fastlane");
const { withReleaseSigning } = require("./release-signing");
const { withSentryAutoUpload } = require("./sentry");
const { isPlainObject } = require("./utils");

const ANDROID_NAMESPACE_PATTERN =
    /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/;

const withAndroidNamespace = (config, androidNamespace) => {
    if (!ANDROID_NAMESPACE_PATTERN.test(androidNamespace)) {
        throw new Error(
            "@zyno-io/mobile-foundation-rn requires androidNamespace to be a valid Java package name",
        );
    }

    config = withAppBuildGradle(config, (modConfig) => {
        if (modConfig.modResults.language !== "groovy") {
            throw new Error(
                "@zyno-io/mobile-foundation-rn only supports Android namespaces in Groovy build.gradle files",
            );
        }

        const namespacePattern =
            /(\bnamespace\s*(?:=\s*)?)(["'])([^"']+)\2/;

        if (!namespacePattern.test(modConfig.modResults.contents)) {
            throw new Error(
                "@zyno-io/mobile-foundation-rn could not find namespace in android/app/build.gradle",
            );
        }

        modConfig.modResults.contents = modConfig.modResults.contents.replace(
            namespacePattern,
            `$1'${androidNamespace}'`,
        );

        return modConfig;
    });

    return withDangerousMod(config, [
        "android",
        async (modConfig) => {
            const namespaceConfig = {
                ...modConfig,
                android: {
                    ...modConfig.android,
                    package: androidNamespace,
                },
            };

            await AndroidConfig.Package.renamePackageOnDisk(
                namespaceConfig,
                modConfig.modRequest.projectRoot,
            );

            return modConfig;
        },
    ]);
};

const withAndroidAppName = (config, androidAppName) => {
    if (
        typeof androidAppName !== "string" ||
        androidAppName.trim().length === 0
    ) {
        throw new Error(
            "@zyno-io/mobile-foundation-rn requires androidAppName to be a non-empty string",
        );
    }

    return withStringsXml(config, (modConfig) => {
        modConfig.modResults = AndroidConfig.Strings.setStringItem(
            [{ $: { name: "app_name" }, _: androidAppName }],
            modConfig.modResults,
        );

        return modConfig;
    });
};

// Applied beneath the user's gradleProperties in the combined plugin only.
const FOUNDATION_GRADLE_PROPERTY_DEFAULTS = {
    "android.enableMinifyInReleaseBuilds": false,
};

// expo-build-properties writes the same gradle property. When the app configures minify there,
// a foundation default could override it (depending on plugin order) and, combined with
// shrinkResources, break release builds, so the app's expo-build-properties setting wins.
const EXPO_BUILD_PROPERTIES_MINIFY_KEYS = [
    "enableMinifyInReleaseBuilds",
    "enableProguardInReleaseBuilds",
];

const configuresMinifyViaExpoBuildProperties = (config) =>
    (config.plugins ?? []).some((entry) => {
        if (!Array.isArray(entry) || entry[0] !== "expo-build-properties") {
            return false;
        }
        const android = entry[1]?.android;
        return (
            isPlainObject(android) &&
            EXPO_BUILD_PROPERTIES_MINIFY_KEYS.some(
                (key) => android[key] !== undefined,
            )
        );
    });

const getFoundationGradlePropertyDefaults = (config) =>
    configuresMinifyViaExpoBuildProperties(config)
        ? {}
        : { ...FOUNDATION_GRADLE_PROPERTY_DEFAULTS };

const withFoundationBuildProperties = (config, androidBuildProperties) => {
    if (
        androidBuildProperties !== undefined &&
        !isPlainObject(androidBuildProperties)
    ) {
        // Let the build-properties plugin raise its own error.
        return withAndroidBuildProperties(config, androidBuildProperties);
    }

    const defaults = getFoundationGradlePropertyDefaults(config);
    const abp = androidBuildProperties ?? {};
    const gp = abp.gradleProperties;
    return withAndroidBuildProperties(config, {
        ...abp,
        gradleProperties:
            gp === undefined
                ? defaults
                : isPlainObject(gp)
                  ? { ...defaults, ...gp }
                  : gp,
    });
};

const withMobileFoundation = (config, options = {}) => {
    const {
        androidAppName,
        androidBuildProperties,
        androidNamespace,
        detox,
        disableSentryAutoUpload = true,
        fastlane,
        releaseSigning,
    } = options;

    // Safe when Expo adds the plugin automatically without options: defaults apply
    // (R8 off, Sentry auto-upload off, fastlane, automatic release signing) and a
    // bare entry never throws except on Expo template drift.
    if (androidNamespace !== undefined) {
        config = withAndroidNamespace(config, androidNamespace);
    }

    if (androidAppName !== undefined) {
        config = withAndroidAppName(config, androidAppName);
    }

    config = withFoundationBuildProperties(config, androidBuildProperties);

    if (detox !== undefined && detox !== false) {
        const detoxOptions = detox === true ? {} : detox;
        if (
            detoxOptions === null ||
            typeof detoxOptions !== "object" ||
            Array.isArray(detoxOptions)
        ) {
            throw new Error(
                "@zyno-io/mobile-foundation-rn requires detox to be a boolean or an options object",
            );
        }

        config = withDetox(config, {
            ...detoxOptions,
            androidPackage:
                detoxOptions.androidPackage ?? androidNamespace,
        });
    }

    config = withReleaseSigning(config, releaseSigning);
    config = withSentryAutoUpload(config, disableSentryAutoUpload);
    config = withFastlane(config, fastlane);

    return config;
};

module.exports = withMobileFoundation;
module.exports.withAndroidAppName = withAndroidAppName;
module.exports.withAndroidBuildProperties = withAndroidBuildProperties;
module.exports.withAndroidNamespace = withAndroidNamespace;
module.exports.withDetox = withDetox;
module.exports.withFastlane = withFastlane;
module.exports.withReleaseSigning = withReleaseSigning;
module.exports.withSentryAutoUpload = withSentryAutoUpload;
module.exports.FOUNDATION_GRADLE_PROPERTY_DEFAULTS =
    FOUNDATION_GRADLE_PROPERTY_DEFAULTS;
module.exports.withMobileFoundation = withMobileFoundation;
