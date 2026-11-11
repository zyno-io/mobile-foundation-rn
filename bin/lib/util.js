const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

class CliError extends Error {
    constructor(message, { usage = false, exitCode = 1 } = {}) {
        super(message);
        this.name = "CliError";
        this.usage = usage;
        this.exitCode = exitCode;
    }
}

const quoteArg = (arg) =>
    /^[A-Za-z0-9_/:=.,@%+-]+$/.test(arg)
        ? arg
        : `'${String(arg).replace(/'/g, "'\\''")}'`;

const formatCommand = (cmd, args = []) =>
    [cmd, ...args].map(quoteArg).join(" ");

// Runs (or, with dryRun, only echoes) external commands. Every command is echoed first.
// `env` entries are merged into the child environment and are never echoed, so secrets
// travel by environment variable only.
const createRunner = ({
    dryRun = false,
    log = (line) => console.log(line),
    spawnSync = childProcess.spawnSync,
    baseEnv = process.env,
} = {}) => ({
    dryRun,
    log,
    run(cmd, args = [], { cwd, env, capture = false, allowFail = false } = {}) {
        log(`$ ${formatCommand(cmd, args)}`);
        if (dryRun) {
            return { status: 0, stdout: "", skipped: true };
        }
        const result = spawnSync(cmd, args, {
            cwd,
            env: { ...baseEnv, ...env },
            stdio: capture ? ["inherit", "pipe", "inherit"] : "inherit",
            encoding: "utf8",
        });
        if (result.error) {
            throw new CliError(
                result.error.code === "ENOENT"
                    ? `command not found: ${cmd}`
                    : `could not run ${cmd}: ${result.error.message}`,
            );
        }
        if (result.status !== 0 && !allowFail) {
            throw new CliError(
                `command failed (exit ${result.status ?? result.signal}): ${formatCommand(cmd, args)}`,
            );
        }
        return { status: result.status, stdout: result.stdout ?? "" };
    },
});

// Resolves a package's bin script from the given directories (not PATH, not npx).
const resolveBin = (pkgName, binName, paths, hint) => {
    let pkgJson;
    try {
        pkgJson = require.resolve(`${pkgName}/package.json`, { paths });
    } catch {
        throw new CliError(`could not resolve ${pkgName}; ${hint}`);
    }
    const { bin } = JSON.parse(fs.readFileSync(pkgJson, "utf8"));
    const rel = typeof bin === "string" ? bin : bin?.[binName];
    if (!rel) {
        throw new CliError(`${pkgName} has no "${binName}" executable`);
    }
    return path.join(path.dirname(pkgJson), rel);
};

const toRelative = (projectRoot, target) =>
    path.relative(projectRoot, target) || ".";

module.exports = { CliError, createRunner, formatCommand, quoteArg, resolveBin, toRelative };
