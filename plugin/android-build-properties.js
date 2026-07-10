const fs = require("node:fs/promises");
const path = require("node:path");

const {
    AndroidConfig,
    createRunOncePlugin,
    withDangerousMod,
    withGradleProperties,
} = require("expo/config-plugins");

const PACKAGE = require("../package.json");
const PLUGIN_NAME = `${PACKAGE.name}/android-build-properties`;

const assertOptionsObject = (options) => {
    if (
        options === null ||
        typeof options !== "object" ||
        Array.isArray(options)
    ) {
        throw new Error(`${PLUGIN_NAME} requires an options object`);
    }
};

const normalizeProperties = (properties, optionName) => {
    if (properties === undefined) {
        return {};
    }

    if (
        properties === null ||
        typeof properties !== "object" ||
        Array.isArray(properties)
    ) {
        throw new Error(`${PLUGIN_NAME} requires ${optionName} to be an object`);
    }

    return Object.fromEntries(
        Object.entries(properties).map(([key, value]) => {
            if (key.trim().length === 0) {
                throw new Error(
                    `${PLUGIN_NAME} requires ${optionName} keys to be non-empty`,
                );
            }

            if (value === null || value === undefined) {
                throw new Error(
                    `${PLUGIN_NAME} requires ${optionName}.${key} to have a value`,
                );
            }

            if (!["string", "number", "boolean"].includes(typeof value)) {
                throw new Error(
                    `${PLUGIN_NAME} requires ${optionName}.${key} to be a string, number, or boolean`,
                );
            }

            return [key, String(value)];
        }),
    );
};

const upsertProperties = (properties, updates) => {
    const remaining = new Map(Object.entries(updates));
    const results = [];

    for (const property of properties) {
        if (
            property.type !== "property" ||
            !Object.prototype.hasOwnProperty.call(updates, property.key)
        ) {
            results.push(property);
            continue;
        }

        if (!remaining.has(property.key)) {
            continue;
        }

        results.push({
            ...property,
            value: remaining.get(property.key),
        });
        remaining.delete(property.key);
    }

    for (const [key, value] of remaining) {
        results.push({ type: "property", key, value });
    }

    return results;
};

const withAndroidBuildProperties = (config, options = {}) => {
    assertOptionsObject(options);

    const gradleProperties = normalizeProperties(
        options.gradleProperties,
        "gradleProperties",
    );
    const gradleWrapperProperties = normalizeProperties(
        options.gradleWrapperProperties,
        "gradleWrapperProperties",
    );

    if (Object.keys(gradleProperties).length > 0) {
        config = withGradleProperties(config, (modConfig) => {
            modConfig.modResults = upsertProperties(
                modConfig.modResults,
                gradleProperties,
            );
            return modConfig;
        });
    }

    if (Object.keys(gradleWrapperProperties).length > 0) {
        config = withDangerousMod(config, [
            "android",
            async (modConfig) => {
                const wrapperPropertiesPath = path.join(
                    modConfig.modRequest.platformProjectRoot,
                    "gradle",
                    "wrapper",
                    "gradle-wrapper.properties",
                );
                const contents = await fs.readFile(
                    wrapperPropertiesPath,
                    "utf8",
                );
                const properties =
                    AndroidConfig.Properties.parsePropertiesFile(contents);
                const updatedProperties = upsertProperties(
                    properties,
                    gradleWrapperProperties,
                );

                await fs.writeFile(
                    wrapperPropertiesPath,
                    AndroidConfig.Properties.propertiesListToString(
                        updatedProperties,
                    ),
                );

                return modConfig;
            },
        ]);
    }

    return config;
};

module.exports = createRunOncePlugin(
    withAndroidBuildProperties,
    PLUGIN_NAME,
    PACKAGE.version,
);
module.exports.withAndroidBuildProperties = withAndroidBuildProperties;
module.exports.upsertProperties = upsertProperties;
