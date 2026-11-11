const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SIGNAL_NUMBERS = { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 };

class CliError extends Error {
    constructor(message, { usage = false, exitCode = 1, cause } = {}) {
        super(message);
        this.name = "CliError";
        this.usage = usage;
        this.exitCode = exitCode;
        if (cause) {
            this.cause = cause;
        }
    }
}

const interruptError = (signal) =>
    new CliError(`interrupted (${signal})`, {
        exitCode: 128 + (SIGNAL_NUMBERS[signal] ?? 0),
    });

const quoteArg = (arg) =>
    /^[A-Za-z0-9_/:=.,@%+-]+$/.test(arg)
        ? arg
        : `'${String(arg).replace(/'/g, "'\\''")}'`;

const formatCommand = (cmd, args = []) =>
    [cmd, ...args].map(quoteArg).join(" ");

// Runs (or, with dryRun, only echoes) external commands. Every command is echoed first
// (read-only probes made with plain spawnSync, such as `git ls-files` and `keytool -help`,
// are not). `env` entries are merged into the child environment and never echoed, so
// secrets travel by environment variable only. Commands are asynchronous so that signal
// handlers can run while one is in flight: interrupt() kills the current child and makes
// run() reject, which lets callers roll back.
const createRunner = ({
    dryRun = false,
    log = (line) => console.log(line),
    spawn = childProcess.spawn,
    baseEnv = process.env,
} = {}) => {
    let current = null;
    let interrupted = null;
    return {
        dryRun,
        log,
        get interrupted() {
            return interrupted;
        },
        interrupt(signal) {
            interrupted = signal;
            if (current) {
                current.kill(signal);
            }
        },
        async run(cmd, args = [], { cwd, env, capture = false, allowFail = false } = {}) {
            log(`$ ${formatCommand(cmd, args)}`);
            if (dryRun) {
                return { status: 0, stdout: "", skipped: true };
            }
            if (interrupted) {
                throw interruptError(interrupted);
            }
            const outcome = await new Promise((resolve) => {
                const child = spawn(cmd, args, {
                    cwd,
                    env: { ...baseEnv, ...env },
                    stdio: capture ? ["inherit", "pipe", "inherit"] : "inherit",
                });
                current = child;
                let stdout = "";
                child.stdout?.setEncoding?.("utf8");
                child.stdout?.on("data", (chunk) => {
                    stdout += chunk;
                });
                child.on("error", (error) => resolve({ error }));
                child.on("close", (code, signal) => resolve({ code, signal, stdout }));
            });
            current = null;
            if (outcome.error) {
                throw new CliError(
                    outcome.error.code === "ENOENT"
                        ? `command not found: ${cmd}`
                        : `could not run ${cmd}: ${outcome.error.message}`,
                );
            }
            if (interrupted) {
                throw interruptError(interrupted);
            }
            if (outcome.signal && SIGNAL_NUMBERS[outcome.signal]) {
                throw interruptError(outcome.signal);
            }
            if (outcome.code !== 0 && !allowFail) {
                throw new CliError(
                    `command failed (exit ${outcome.code ?? outcome.signal}): ${formatCommand(cmd, args)}`,
                );
            }
            return { status: outcome.code, stdout: outcome.stdout ?? "" };
        },
    };
};

// Forwards termination signals to the runner while fn runs, then removes the listeners.
const withSignalGuard = async (runner, fn, proc = process) => {
    const handlers = Object.keys(SIGNAL_NUMBERS).map((signal) => [
        signal,
        () => runner.interrupt?.(signal),
    ]);
    for (const [signal, handler] of handlers) proc.on(signal, handler);
    try {
        return await fn();
    } finally {
        for (const [signal, handler] of handlers) proc.off(signal, handler);
    }
};

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

module.exports = {
    CliError,
    SIGNAL_NUMBERS,
    createRunner,
    formatCommand,
    interruptError,
    quoteArg,
    resolveBin,
    toRelative,
    withSignalGuard,
};
