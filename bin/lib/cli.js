const { parseArgs } = require("node:util");

const { resolveProjectRoot } = require("./config");
const { CliError, createRunner } = require("./util");

// Command modules load on first use, so --help and unrelated commands never pull in more
// than they need.
const COMMANDS = [
    {
        name: "update-deps",
        summary: "Upgrade dependencies, reinstall, fix Expo versions, check patches",
        load: () => require("./update-deps"),
    },
    {
        name: "update-match",
        summary: "Refresh fastlane match certificates and profiles",
        load: () => require("./update-match"),
    },
    {
        name: "generate-android-keystore",
        summary: "Generate the Android upload keystore",
        load: () => require("./keystore"),
    },
];

const GLOBAL_OPTIONS = {
    help: { type: "boolean", short: "h" },
    cwd: { type: "string" },
    "dry-run": { type: "boolean" },
};

const usage = () =>
    [
        "Usage: mfrn <command> [options]",
        "",
        "Commands:",
        ...COMMANDS.map((c) => `  ${c.name.padEnd(26)}${c.summary}`),
        "",
        "Global options:",
        "  --cwd <dir>   App root containing package.json (default: current directory)",
        "  --dry-run     Print commands and planned changes without running them",
        "  -h, --help    Show help (also: mfrn <command> --help)",
    ].join("\n");

// Splits argv at the first `--`: [before, after].
const splitPassthrough = (argv) => {
    const i = argv.indexOf("--");
    return i === -1 ? [argv, []] : [argv.slice(0, i), argv.slice(i + 1)];
};

// Pure: parses argv into { command, values, positionals, passthrough } or { help }.
const parseCommandLine = (argv) => {
    const [name, ...rest] = argv;
    if (name === undefined || name === "--help" || name === "-h" || name === "help") {
        return { help: true };
    }
    const entry = COMMANDS.find((c) => c.name === name);
    if (!entry) {
        throw new CliError(`unknown command "${name}"`, { usage: true, exitCode: 2 });
    }
    const command = entry.load();
    const [before, after] = splitPassthrough(rest);
    if (after.length && !command.passthrough) {
        throw new CliError(`${command.name} does not accept arguments after --`, { usage: true, exitCode: 2 });
    }
    let parsed;
    try {
        parsed = parseArgs({
            args: before,
            options: { ...GLOBAL_OPTIONS, ...command.options },
            allowPositionals: true,
            strict: true,
        });
    } catch (error) {
        throw new CliError(error.message, { usage: true, exitCode: 2 });
    }
    if (parsed.positionals.length && !command.positionals) {
        throw new CliError(`unexpected argument "${parsed.positionals[0]}"`, { usage: true, exitCode: 2 });
    }
    return {
        command,
        values: parsed.values,
        positionals: parsed.positionals,
        passthrough: after,
        help: Boolean(parsed.values.help),
    };
};

// Resolves to the exit code; never calls process.exit.
const main = async (argv, deps = {}) => {
    const out = deps.out ?? ((line) => console.log(line));
    const err = deps.err ?? ((line) => console.error(line));
    const env = deps.env ?? process.env;
    try {
        const parsed = parseCommandLine(argv);
        if (parsed.help) {
            out(parsed.command ? parsed.command.usage : usage());
            return 0;
        }
        const { command, values, positionals, passthrough } = parsed;
        const projectRoot = resolveProjectRoot(values.cwd ?? process.cwd());
        const runner = deps.runner ?? createRunner({ dryRun: Boolean(values["dry-run"]), log: out });
        if (runner.dryRun) {
            out("Dry run: no commands will be executed and no files changed.");
        }
        const code = await command.run({
            values,
            positionals,
            passthrough,
            projectRoot,
            runner,
            env,
            loadConfig: deps.loadConfig,
            spawnSync: deps.spawnSync,
        });
        return typeof code === "number" ? code : 0;
    } catch (error) {
        err(`mfrn: ${error.message}`);
        if (env.MFRN_DEBUG) {
            err(String((error.cause ?? error).stack ?? error));
        }
        if (error instanceof CliError) {
            if (error.usage) {
                err("");
                err(usage());
            }
            return error.exitCode;
        }
        return 1;
    }
};

module.exports = { COMMANDS, main, parseCommandLine, usage };
