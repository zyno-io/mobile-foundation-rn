const fs = require("node:fs");
const path = require("node:path");

const { PACKAGE } = require("../../plugin/utils");
const { CliError } = require("./util");

const resolveProjectRoot = (cwd) => {
    const root = path.resolve(cwd);
    if (!fs.existsSync(path.join(root, "package.json"))) {
        throw new CliError(`no package.json found in ${root}; use --cwd to point at the app root`);
    }
    return root;
};

// Loads the app's Expo config through the app's own expo install.
const loadExpoConfig = (projectRoot) => {
    let resolved;
    try {
        resolved = require.resolve("expo/config", { paths: [projectRoot] });
    } catch {
        throw new CliError(
            `could not resolve expo/config from ${projectRoot}; install the app's dependencies first`,
        );
    }
    const { getConfig } = require(resolved);
    return getConfig(projectRoot, { skipSDKVersionRequirement: true }).exp;
};

// Options of the combined foundation plugin entry; {} when listed without options or absent
// (Expo applies the plugin's defaults either way).
const findFoundationPluginOptions = (exp) => {
    for (const entry of exp?.plugins ?? []) {
        if (entry === PACKAGE.name) {
            return {};
        }
        if (Array.isArray(entry) && entry[0] === PACKAGE.name) {
            return entry[1] ?? {};
        }
    }
    return {};
};

const loadProjectConfig = (projectRoot) => {
    let exp;
    try {
        exp = loadExpoConfig(projectRoot);
    } catch (error) {
        if (error instanceof CliError) {
            throw error;
        }
        throw new CliError(`could not load the Expo config: ${error.message}`, { cause: error });
    }
    return { exp, pluginOptions: findFoundationPluginOptions(exp) };
};

module.exports = {
    findFoundationPluginOptions,
    loadExpoConfig,
    loadProjectConfig,
    resolveProjectRoot,
};
