#!/usr/bin/env node

/**
 * Syncs root package.json devDependencies versions from test-app/package.json.
 * For any package that appears in both root devDependencies and test-app dependencies,
 * the root version is updated to match the test-app version.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootPkgPath = resolve(__dirname, '../package.json');
const testAppPkgPath = resolve(__dirname, '../test-app/package.json');

const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'));
const testAppPkg = JSON.parse(readFileSync(testAppPkgPath, 'utf-8'));

const testAppDeps = {
    ...testAppPkg.dependencies,
    ...testAppPkg.devDependencies,
};

let changed = 0;

for (const [pkg, currentVersion] of Object.entries(rootPkg.devDependencies)) {
    if (pkg in testAppDeps && testAppDeps[pkg] !== currentVersion) {
        console.log(`${pkg}: ${currentVersion} -> ${testAppDeps[pkg]}`);
        rootPkg.devDependencies[pkg] = testAppDeps[pkg];
        changed++;
    }
}

if (changed === 0) {
    console.log('All devDependencies are already in sync.');
} else {
    writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 4) + '\n');
    console.log(`\nUpdated ${changed} package(s). Run \`yarn install\` to update the lockfile.`);
}
