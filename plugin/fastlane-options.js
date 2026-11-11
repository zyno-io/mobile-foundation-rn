const { PACKAGE, assertKnownKeys, assertOptionsObject, isPlainObject } = require("./utils");

// Option normalization lives apart from the plugin so the CLI can use it without expo installed.
const PLUGIN_NAME = `${PACKAGE.name}/fastlane`;

// No default match git URL: the package is public and must not carry internal hostnames.
const MATCH_PROFILE_TYPES = ["development", "adhoc", "appstore", "enterprise"];
const DEFAULT_SOURCE_DIR = {
    ios: "resources/native/ios/fastlane",
    android: "resources/native/android/fastlane",
};
const APPLE_TEAM_ID_PATTERN = /^[A-Z0-9]{10}$/;
const BUNDLE_ID_PATTERN = /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;
const ANDROID_PACKAGE_PATTERN =
    /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/;
const EXTENSION_TARGET_PATTERN = /^[A-Za-z0-9-]+$/;
const IOS_KEYS = [
    "appleTeamId",
    "bundleIdentifier",
    "extensionTargets",
    "matchGitUrl",
    "matchAppIdentifiers",
    "sourceDir",
];
const ANDROID_KEYS = ["packageName", "sourceDir"];
const assertString = (value, pattern, optionName, description) => {
    if (typeof value !== "string" || !pattern.test(value)) {
        throw new Error(
            `${PLUGIN_NAME} requires ${optionName} to be ${description}`,
        );
    }
};

const assertSourceDirOption = (value, optionName) => {
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

const normalizeIosOptions = (raw) => {
    if (raw === false) {
        return null;
    }
    const value = raw === undefined || raw === true ? {} : raw;
    assertOptionsObject(value, "fastlane.ios", PLUGIN_NAME);
    assertKnownKeys(value, IOS_KEYS, "fastlane.ios", PLUGIN_NAME);

    if (value.appleTeamId !== undefined) {
        assertString(
            value.appleTeamId,
            APPLE_TEAM_ID_PATTERN,
            "fastlane.ios.appleTeamId",
            "a 10-character Apple team ID",
        );
    }
    if (value.bundleIdentifier !== undefined) {
        assertString(
            value.bundleIdentifier,
            BUNDLE_ID_PATTERN,
            "fastlane.ios.bundleIdentifier",
            "a valid bundle identifier",
        );
    }
    const extensionTargets = value.extensionTargets ?? [];
    if (!Array.isArray(extensionTargets)) {
        throw new Error(
            `${PLUGIN_NAME} requires fastlane.ios.extensionTargets to be an array`,
        );
    }
    for (const target of extensionTargets) {
        assertString(
            target,
            EXTENSION_TARGET_PATTERN,
            "fastlane.ios.extensionTargets entries",
            "target names containing only letters, digits, and hyphens",
        );
    }
    if (new Set(extensionTargets).size !== extensionTargets.length) {
        throw new Error(
            `${PLUGIN_NAME} requires fastlane.ios.extensionTargets to be unique`,
        );
    }
    if (value.matchGitUrl !== undefined) {
        assertString(
            value.matchGitUrl,
            /^\S+$/,
            "fastlane.ios.matchGitUrl",
            "a non-empty string without whitespace",
        );
    }
    const matchAppIdentifiers = value.matchAppIdentifiers ?? {};
    if (!isPlainObject(matchAppIdentifiers)) {
        throw new Error(
            `${PLUGIN_NAME} requires fastlane.ios.matchAppIdentifiers to be an object`,
        );
    }
    assertKnownKeys(
        matchAppIdentifiers,
        MATCH_PROFILE_TYPES,
        "fastlane.ios.matchAppIdentifiers",
        PLUGIN_NAME,
    );
    for (const [type, ids] of Object.entries(matchAppIdentifiers)) {
        if (!Array.isArray(ids)) {
            throw new Error(
                `${PLUGIN_NAME} requires fastlane.ios.matchAppIdentifiers.${type} to be an array`,
            );
        }
        for (const id of ids) {
            assertString(
                id,
                BUNDLE_ID_PATTERN,
                `fastlane.ios.matchAppIdentifiers.${type} entries`,
                "valid bundle identifiers",
            );
        }
    }
    if (value.sourceDir !== undefined) {
        assertSourceDirOption(value.sourceDir, "fastlane.ios.sourceDir");
    }

    return {
        appleTeamId: value.appleTeamId,
        bundleIdentifier: value.bundleIdentifier,
        extensionTargets,
        matchGitUrl: value.matchGitUrl,
        matchAppIdentifiers,
        sourceDir: value.sourceDir ?? DEFAULT_SOURCE_DIR.ios,
        sourceDirExplicit: value.sourceDir !== undefined,
    };
};

const normalizeAndroidOptions = (raw) => {
    if (raw === false) {
        return null;
    }
    const value = raw === undefined || raw === true ? {} : raw;
    assertOptionsObject(value, "fastlane.android", PLUGIN_NAME);
    assertKnownKeys(value, ANDROID_KEYS, "fastlane.android", PLUGIN_NAME);

    if (value.packageName !== undefined) {
        assertString(
            value.packageName,
            ANDROID_PACKAGE_PATTERN,
            "fastlane.android.packageName",
            "a valid Android package name",
        );
    }
    if (value.sourceDir !== undefined) {
        assertSourceDirOption(value.sourceDir, "fastlane.android.sourceDir");
    }

    return {
        packageName: value.packageName,
        sourceDir: value.sourceDir ?? DEFAULT_SOURCE_DIR.android,
        sourceDirExplicit: value.sourceDir !== undefined,
    };
};

const normalizeFastlaneOptions = (raw) => {
    if (raw === false) {
        return { ios: null, android: null };
    }
    const value = raw === undefined || raw === true ? {} : raw;
    assertOptionsObject(value, "fastlane", PLUGIN_NAME);
    assertKnownKeys(value, ["ios", "android"], "fastlane", PLUGIN_NAME);
    return {
        ios: normalizeIosOptions(value.ios),
        android: normalizeAndroidOptions(value.android),
    };
};

module.exports = {
    ANDROID_PACKAGE_PATTERN,
    APPLE_TEAM_ID_PATTERN,
    BUNDLE_ID_PATTERN,
    DEFAULT_SOURCE_DIR,
    MATCH_PROFILE_TYPES,
    assertString,
    normalizeFastlaneOptions,
};
