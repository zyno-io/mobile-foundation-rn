const { PACKAGE, assertKnownKeys, assertOptionsObject } = require("./utils");

// Option normalization lives apart from the plugin so the CLI can use it without expo installed.
const PLUGIN_NAME = `${PACKAGE.name}/release-signing`;
const DEFAULT_KEYSTORE_PATH = "resources/native/android/signer.jks";
const FALLBACK_MODES = ["local", "always", "never"];
const OPTION_KEYS = [
    "keystorePath",
    "keyAlias",
    "passwordEnv",
    "debugKeystoreFallback",
];

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

module.exports = {
    DEFAULT_KEYSTORE_PATH,
    normalizeReleaseSigningOptions,
};
