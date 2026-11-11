const fs = require("node:fs");
const path = require("node:path");

const {
    CodeGenerator,
    WarningAggregator,
    withAppBuildGradle,
    withDangerousMod,
} = require("expo/config-plugins");

const {
    PACKAGE,
    assertAnchor,
    assertKnownKeys,
    assertOptionsObject,
    isInsideDirectory,
    isPlainObject,
} = require("./utils");

const PLUGIN_NAME = `${PACKAGE.name}/release-signing`;
const TAG = "mobile-foundation-release-signing";
const DEFAULT_KEYSTORE_PATH = "resources/native/android/signer.jks";
const SIGNING_CONFIGS_ANCHOR = /^ {4}signingConfigs \{$/;
const SIGNING_CONFIGS_END = /^ {4}\}$/;
const RELEASE_SIGNING_CONFIG = /^\s*release\s*\{\s*$/;
const RELEASE_BUILD_TYPE_SIGNING =
    /(^ {4}buildTypes \{\n[\s\S]*?^ {8}release \{\n[^{}]*?^ {12}signingConfig signingConfigs\.)(\w+)$/m;
const FALLBACK_MODES = ["local", "always", "never"];
const OPTION_KEYS = [
    "keystorePath",
    "keyAlias",
    "passwordEnv",
    "debugKeystoreFallback",
];

const createReleaseSigningConfig = ({
    keyAlias,
    passwordEnv,
    debugKeystoreFallback,
}) => {
    const lines = [
        "        release {",
        `            if (System.getenv('${passwordEnv}')) {`,
        "                storeFile file('../signer.jks')",
        `                storePassword System.getenv('${passwordEnv}')`,
        `                keyAlias '${keyAlias}'`,
        `                keyPassword System.getenv('${passwordEnv}')`,
    ];
    if (debugKeystoreFallback === "never") {
        lines.push("            }");
    } else {
        lines.push(
            debugKeystoreFallback === "local"
                ? "            } else if (!System.getenv('CI')) {"
                : "            } else {",
            debugKeystoreFallback === "local"
                ? "                // Local E2E release builds fall back to the debug keystore; CI must provide the real one."
                : `                // Builds without ${passwordEnv} (local and E2E) fall back to the debug keystore.`,
            "                storeFile file('debug.keystore')",
            "                storePassword 'android'",
            "                keyAlias 'androiddebugkey'",
            "                keyPassword 'android'",
            "            }",
        );
    }
    lines.push("        }");
    return lines.join("\n");
};

// Scans from the signingConfigs anchor to the first closing line of that block.
const hasReleaseSigningConfig = (contents) => {
    const lines = contents.split("\n");
    const start = lines.findIndex((line) => SIGNING_CONFIGS_ANCHOR.test(line));
    if (start === -1) {
        return false;
    }
    for (let i = start + 1; i < lines.length; i++) {
        if (SIGNING_CONFIGS_END.test(lines[i])) {
            return false;
        }
        if (RELEASE_SIGNING_CONFIG.test(lines[i])) {
            return true;
        }
    }
    return false;
};

// options: normalized options (with .explicit) or null for the undo path.
const patchReleaseSigning = (contents, options) => {
    const { contents: withoutOwn, didClear } = CodeGenerator.removeContents({
        src: contents,
        tag: TAG,
    });

    if (!options) {
        if (!didClear) {
            return { contents, skipped: false };
        }
        return {
            contents: hasReleaseSigningConfig(withoutOwn)
                ? withoutOwn
                : withoutOwn.replace(RELEASE_BUILD_TYPE_SIGNING, "$1debug"),
            skipped: false,
        };
    }

    if (hasReleaseSigningConfig(withoutOwn)) {
        if (options.explicit) {
            throw new Error(
                `${PLUGIN_NAME} found a "release" signingConfig in android/app/build.gradle that it did not generate (from an app plugin listed after the foundation plugin, or left by an earlier prebuild). Remove it and run \`npx expo prebuild --clean\`, or set releaseSigning to false.`,
            );
        }
        return { contents: withoutOwn, skipped: true };
    }

    assertAnchor(
        withoutOwn,
        SIGNING_CONFIGS_ANCHOR,
        'the "signingConfigs {" block',
        "android/app/build.gradle",
        PLUGIN_NAME,
    );
    if (!RELEASE_BUILD_TYPE_SIGNING.test(withoutOwn)) {
        throw new Error(
            `${PLUGIN_NAME} could not find the release build type's "signingConfig signingConfigs.<name>" line in android/app/build.gradle; review the updated Expo template and update the plugin.`,
        );
    }

    const merged = CodeGenerator.mergeContents({
        src: withoutOwn,
        newSrc: createReleaseSigningConfig(options),
        tag: TAG,
        anchor: SIGNING_CONFIGS_ANCHOR,
        offset: 1,
        comment: "//",
    }).contents;

    return {
        contents: merged.replace(RELEASE_BUILD_TYPE_SIGNING, "$1release"),
        skipped: false,
    };
};

const assertPath = (value, optionName) => {
    if (
        typeof value !== "string" ||
        value.trim().length === 0 ||
        /[\r\n]/.test(value)
    ) {
        throw new Error(
            `${PLUGIN_NAME} requires ${optionName} to be a non-empty string without newlines`,
        );
    }
};

const normalizeReleaseSigningOptions = (raw) => {
    if (raw === false) {
        return null;
    }

    const value = raw === undefined || raw === true ? {} : raw;
    assertOptionsObject(value, "releaseSigning", PLUGIN_NAME);
    assertKnownKeys(value, OPTION_KEYS, "releaseSigning", PLUGIN_NAME);

    const normalized = {
        explicit: raw !== undefined,
        keystorePath: value.keystorePath ?? DEFAULT_KEYSTORE_PATH,
        keyAlias: value.keyAlias ?? "key0",
        passwordEnv: value.passwordEnv ?? "APK_KS_PASSWORD",
        debugKeystoreFallback: value.debugKeystoreFallback ?? "local",
    };

    assertPath(normalized.keystorePath, "keystorePath");
    if (
        typeof normalized.keyAlias !== "string" ||
        !/^[^'\\\r\n]+$/.test(normalized.keyAlias)
    ) {
        throw new Error(
            `${PLUGIN_NAME} requires keyAlias to be a non-empty string without quotes, backslashes, or newlines`,
        );
    }
    if (
        typeof normalized.passwordEnv !== "string" ||
        !/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalized.passwordEnv)
    ) {
        throw new Error(
            `${PLUGIN_NAME} requires passwordEnv to be a valid environment variable name`,
        );
    }
    if (!FALLBACK_MODES.includes(normalized.debugKeystoreFallback)) {
        throw new Error(
            `${PLUGIN_NAME} requires debugKeystoreFallback to be one of ${FALLBACK_MODES.join(", ")}`,
        );
    }

    return normalized;
};

const resolveReleaseKeystore = (projectRoot, options) => {
    const source = path.resolve(projectRoot, options.keystorePath);
    if (isInsideDirectory(source, path.join(projectRoot, "android"))) {
        throw new Error(
            `${PLUGIN_NAME} requires keystorePath to be outside the generated android/ directory`,
        );
    }
    if (fs.existsSync(source) && fs.statSync(source).isFile()) {
        return source;
    }
    if (options.explicit) {
        throw new Error(
            `${PLUGIN_NAME} could not find the release keystore at ${options.keystorePath}`,
        );
    }
    return null;
};

const withReleaseSigning = (config, raw) => {
    const options = normalizeReleaseSigningOptions(raw);

    if (options) {
        config = withDangerousMod(config, [
            "android",
            (modConfig) => {
                const source = resolveReleaseKeystore(
                    modConfig.modRequest.projectRoot,
                    options,
                );
                if (source) {
                    fs.copyFileSync(
                        source,
                        path.join(
                            modConfig.modRequest.projectRoot,
                            "android",
                            "signer.jks",
                        ),
                    );
                }
                return modConfig;
            },
        ]);
    }

    return withAppBuildGradle(config, (modConfig) => {
        if (modConfig.modRequest.introspect) {
            return modConfig;
        }

        const active =
            options &&
            resolveReleaseKeystore(
                modConfig.modRequest.projectRoot,
                options,
            ) !== null
                ? options
                : null;

        if (modConfig.modResults.language !== "groovy") {
            if (active) {
                throw new Error(
                    `${PLUGIN_NAME} only supports Groovy build.gradle files`,
                );
            }
            return modConfig;
        }

        const result = patchReleaseSigning(
            modConfig.modResults.contents,
            active,
        );
        modConfig.modResults.contents = result.contents;
        if (result.skipped) {
            WarningAggregator.addWarningAndroid(
                "releaseSigning",
                "android/app/build.gradle already defines a release signingConfig, so foundation release signing was skipped. Remove the app's signing config to use foundation's, or set releaseSigning to false.",
            );
        }
        return modConfig;
    });
};

module.exports = {
    createReleaseSigningConfig,
    normalizeReleaseSigningOptions,
    patchReleaseSigning,
    withReleaseSigning,
};
