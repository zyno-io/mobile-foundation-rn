const {
    AndroidConfig,
    withAppBuildGradle,
    withDangerousMod,
    withStringsXml,
} = require("expo/config-plugins");

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

const withMobileFoundation = (config, options = {}) => {
    const { androidAppName, androidNamespace } = options;

    // Keep the plugin safe when Expo adds it automatically without options.
    if (androidNamespace !== undefined) {
        config = withAndroidNamespace(config, androidNamespace);
    }

    if (androidAppName !== undefined) {
        config = withAndroidAppName(config, androidAppName);
    }

    return config;
};

module.exports = withMobileFoundation;
module.exports.withAndroidAppName = withAndroidAppName;
module.exports.withAndroidNamespace = withAndroidNamespace;
module.exports.withMobileFoundation = withMobileFoundation;
