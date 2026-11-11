const fs = require("node:fs");
const path = require("node:path");

const {
    CodeGenerator,
    WarningAggregator,
    withAppBuildGradle,
    withDangerousMod,
} = require("expo/config-plugins");

const { PACKAGE, assertAnchor } = require("./utils");

const PLUGIN_NAME = `${PACKAGE.name}/sentry`;
const TAG = "mobile-foundation-sentry-auto-upload";
const DEPENDENCIES_ANCHOR = /^dependencies \{$/;
const LEGACY_XCODE_ENV_LINE =
    /^export SENTRY_DISABLE_AUTO_UPLOAD=true[ \t]*$\n?/gm;
// sentry.gradle.kts reads this override once the app build.gradle has been evaluated. Never emit
// `{ -> return false }`: the Sentry Expo plugin deletes that exact line when its disableAutoUpload is off.
const GRADLE_SRC = [
    "// Automatic Sentry uploads are off; CI uploads JS source maps. Set SENTRY_DISABLE_AUTO_UPLOAD=false to re-enable.",
    "project.ext.shouldSentryAutoUploadGeneral = { -> System.getenv('SENTRY_DISABLE_AUTO_UPLOAD') == 'false' }",
].join("\n");
const XCODE_ENV_SRC = [
    "# Automatic Sentry uploads are off; CI uploads JS source maps. Set SENTRY_DISABLE_AUTO_UPLOAD=false to re-enable.",
    'if [ "${SENTRY_DISABLE_AUTO_UPLOAD:-}" != "false" ]; then',
    "  export SENTRY_DISABLE_AUTO_UPLOAD=true",
    "fi",
].join("\n");

const patchSentryAppBuildGradle = (contents, disable) => {
    if (!disable) {
        return CodeGenerator.removeContents({ src: contents, tag: TAG })
            .contents;
    }
    assertAnchor(
        contents,
        DEPENDENCIES_ANCHOR,
        'the top-level "dependencies {" block',
        "android/app/build.gradle",
        PLUGIN_NAME,
    );
    return CodeGenerator.mergeContents({
        src: contents,
        newSrc: GRADLE_SRC,
        tag: TAG,
        anchor: DEPENDENCIES_ANCHOR,
        offset: 0,
        comment: "//",
    }).contents;
};

const patchXcodeEnv = (contents, disable) => {
    const withoutOwn = CodeGenerator.removeGeneratedContents(contents, TAG);
    if (!disable) {
        return withoutOwn ?? contents;
    }
    const base = (withoutOwn ?? contents)
        .replace(LEGACY_XCODE_ENV_LINE, "")
        .trimEnd();
    const block = [
        CodeGenerator.createGeneratedHeaderComment(XCODE_ENV_SRC, TAG, "#"),
        XCODE_ENV_SRC,
        `# @generated end ${TAG}`,
    ].join("\n");
    return `${base}\n\n${block}\n`;
};

const withSentryAutoUpload = (config, disable = true) => {
    if (typeof disable !== "boolean") {
        throw new Error(
            `${PACKAGE.name} requires disableSentryAutoUpload to be a boolean`,
        );
    }

    config = withAppBuildGradle(config, (modConfig) => {
        if (modConfig.modRequest.introspect) {
            return modConfig;
        }
        if (modConfig.modResults.language !== "groovy") {
            if (disable) {
                WarningAggregator.addWarningAndroid(
                    "disableSentryAutoUpload",
                    "android/app/build.gradle is not Groovy, so foundation could not disable Sentry automatic upload on Android.",
                );
            }
            return modConfig;
        }
        modConfig.modResults.contents = patchSentryAppBuildGradle(
            modConfig.modResults.contents,
            disable,
        );
        return modConfig;
    });

    return withDangerousMod(config, [
        "ios",
        (modConfig) => {
            const envPath = path.join(
                modConfig.modRequest.platformProjectRoot,
                ".xcode.env",
            );
            if (!fs.existsSync(envPath)) {
                if (disable) {
                    throw new Error(
                        `${PLUGIN_NAME} could not find ios/.xcode.env; review the updated Expo template and update the plugin.`,
                    );
                }
                return modConfig;
            }
            const original = fs.readFileSync(envPath, "utf8");
            const updated = patchXcodeEnv(original, disable);
            if (updated !== original) {
                fs.writeFileSync(envPath, updated);
            }
            return modConfig;
        },
    ]);
};

module.exports = {
    patchSentryAppBuildGradle,
    patchXcodeEnv,
    withSentryAutoUpload,
};
