const fs = require("node:fs");
const path = require("node:path");

const {
    MATCH_PROFILE_TYPES,
    normalizeFastlaneOptions,
} = require("../../plugin/fastlane");
const { loadProjectConfig } = require("./config");
const { CliError, toRelative } = require("./util");

const OPTIONS = {
    readonly: { type: "boolean" },
};

const USAGE = `Usage: mfrn update-match [types...] [options] [-- <fastlane args>]

Refresh fastlane match certificates and provisioning profiles for the types
configured in fastlane.ios.matchAppIdentifiers (development, adhoc, appstore,
enterprise). Name types to refresh only those.

Options:
  --readonly   Pass --readonly to match (never create or renew)
  --dry-run    Print the commands without running them
  --cwd <dir>  App root (default: current directory)

Arguments after -- are passed to fastlane. Set FASTLANE_USER to your Apple ID,
and matchGitUrl (or MATCH_GIT_URL) to the match certificates repository.`;

// Expands each identifier with the configured extension targets (id, id.Target, ...).
const expandIdentifiers = (ids, extensionTargets = []) =>
    ids.flatMap((id) => [id, ...extensionTargets.map((t) => `${id}.${t}`)]);

// Pure: builds the match commands from normalized-or-raw plugin options.
const buildUpdateMatchPlan = ({
    exp,
    pluginOptions,
    types = [],
    readonly = false,
    passthrough = [],
    env = {},
    projectRoot,
}) => {
    const fastlane = normalizeFastlaneOptions(pluginOptions?.fastlane);
    if (pluginOptions?.fastlane === false) {
        throw new CliError("fastlane is disabled in the foundation plugin options (fastlane: false)");
    }
    const ios = fastlane.ios;
    if (!ios) {
        throw new CliError("fastlane.ios is disabled in the foundation plugin options");
    }

    const configured = MATCH_PROFILE_TYPES.filter(
        (type) => (ios.matchAppIdentifiers[type] ?? []).length > 0,
    );
    if (configured.length === 0) {
        throw new CliError(
            "no fastlane.ios.matchAppIdentifiers are configured; add identifiers per profile type, e.g. { \"appstore\": [\"com.example.app\"] }",
        );
    }

    for (const type of types) {
        if (!MATCH_PROFILE_TYPES.includes(type)) {
            throw new CliError(
                `unknown match type "${type}"; expected one of ${MATCH_PROFILE_TYPES.join(", ")}`,
                { usage: true },
            );
        }
        if (!configured.includes(type)) {
            throw new CliError(
                `match type "${type}" has no fastlane.ios.matchAppIdentifiers; configured: ${configured.join(", ")}`,
            );
        }
    }
    const selected = types.length
        ? configured.filter((type) => types.includes(type))
        : configured;

    if (!ios.matchGitUrl && !env.MATCH_GIT_URL) {
        throw new CliError(
            "no match git URL: set fastlane.ios.matchGitUrl in the plugin options or the MATCH_GIT_URL environment variable",
        );
    }
    const teamId = ios.appleTeamId ?? exp?.ios?.appleTeamId;

    const cwd = fs.existsSync(path.join(projectRoot, "ios"))
        ? path.join(projectRoot, "ios")
        : projectRoot;

    const warnings = [];
    if (!env.FASTLANE_USER) {
        warnings.push("FASTLANE_USER is not set; fastlane will prompt for your Apple ID");
    }

    return {
        cwd,
        warnings,
        commands: selected.map((type) => ({
            cmd: "bundle",
            args: [
                "exec",
                "fastlane",
                "match",
                type,
                "-a",
                expandIdentifiers(ios.matchAppIdentifiers[type], ios.extensionTargets).join(","),
                ...(ios.matchGitUrl ? ["--git_url", ios.matchGitUrl] : []),
                ...(teamId ? ["--team_id", teamId] : []),
                ...(readonly ? ["--readonly"] : []),
                ...passthrough,
            ],
        })),
    };
};

const run = ({ values, positionals, passthrough, projectRoot, runner, env, loadConfig = loadProjectConfig }) => {
    const { exp, pluginOptions } = loadConfig(projectRoot);
    const plan = buildUpdateMatchPlan({
        exp,
        pluginOptions,
        types: positionals,
        readonly: values.readonly,
        passthrough,
        env,
        projectRoot,
    });
    for (const warning of plan.warnings) {
        runner.log(`warning: ${warning}`);
    }
    runner.log(`Running in ${toRelative(projectRoot, plan.cwd)}`);
    for (const { cmd, args } of plan.commands) {
        runner.run(cmd, args, { cwd: plan.cwd });
    }
};

module.exports = {
    name: "update-match",
    summary: "Refresh fastlane match certificates and profiles",
    usage: USAGE,
    options: OPTIONS,
    positionals: true,
    passthrough: true,
    run,
    buildUpdateMatchPlan,
    expandIdentifiers,
};
