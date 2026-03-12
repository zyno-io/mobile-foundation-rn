const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the parent directory so Metro can resolve the symlinked library source
config.watchFolders = [monorepoRoot];

// Only resolve node_modules from the test-app — NOT from the parent.
// The parent's node_modules has different package versions that cause conflicts.
config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
];

// Block the parent's node_modules from being resolved via watchFolders
config.resolver.blockList = [
    new RegExp(path.resolve(monorepoRoot, 'node_modules').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/.*'),
];

module.exports = config;
