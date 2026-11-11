const path = require("node:path");

const PACKAGE = require("../package.json");

const isPlainObject = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value);

const assertOptionsObject = (value, optionName, pluginName) => {
    if (!isPlainObject(value)) {
        throw new Error(
            `${pluginName} requires ${optionName} to be a boolean or an options object`,
        );
    }
};

const assertKnownKeys = (obj, keys, optionName, pluginName) => {
    for (const key of Object.keys(obj)) {
        if (!keys.includes(key)) {
            throw new Error(`${pluginName} does not support ${optionName}.${key}`);
        }
    }
};

const assertAnchor = (contents, anchor, description, fileName, pluginName) => {
    if (!contents.split("\n").some((line) => anchor.test(line))) {
        throw new Error(
            `${pluginName} could not find ${description} in ${fileName}; review the updated Expo template and update the plugin.`,
        );
    }
};

const isInsideDirectory = (target, dir) => {
    const relative = path.relative(dir, target);
    return (
        relative === "" ||
        (!relative.startsWith("..") && !path.isAbsolute(relative))
    );
};

const toPosixPath = (p) => p.split(path.sep).join("/");

module.exports = {
    PACKAGE,
    assertAnchor,
    assertKnownKeys,
    assertOptionsObject,
    isInsideDirectory,
    isPlainObject,
    toPosixPath,
};
