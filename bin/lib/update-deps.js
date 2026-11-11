const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { CliError, formatCommand, resolveBin, withSignalGuard } = require("./util");

const DEP_FIELDS = ["dependencies", "devDependencies", "optionalDependencies"];
const DEFAULT_TRUSTED = "@zyno*";

const OPTIONS = {
    cooldown: { type: "string", default: "3d" },
    trusted: { type: "string", multiple: true },
    reject: { type: "string", multiple: true },
    "no-rename-patches": { type: "boolean" },
};

const USAGE = `Usage: mfrn update-deps [options]

Upgrade dependencies, reinstall, fix Expo versions and check patches.

Steps: preflight (yarn: node-modules linker, registry auth, age gate) -> back up
package.json and the lockfile -> npm-check-updates (cooldown, then trusted
patterns without it) -> recreate the lockfile and install -> expo install --fix
-> install -> patch-package check -> summary of major changes. A failure or a
SIGINT/SIGTERM/SIGHUP before the patch check restores the backups.

Options:
  --cooldown <d>      Minimum release age for upgrades (default: 3d)
  --trusted <glob>    Package pattern upgraded with no cooldown (repeatable,
                      default: ${DEFAULT_TRUSTED})
  --reject <pattern>  Package pattern to leave alone (repeatable)
  --no-rename-patches Do not rename patches to the installed version
  --dry-run           Print the commands and planned changes only
  --cwd <dir>         App root (default: current directory)

Yarn's npmMinimalAgeGate applies to installs. Trusted patterns not listed in
npmPreapprovedPackages (.yarnrc.yml) get the gate as their cooldown instead of
none.`;

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

// yarn berry or npm only; anything else is an error.
const detectPackageManager = (projectRoot, pkg) => {
    const field = typeof pkg.packageManager === "string" ? pkg.packageManager : "";
    const [fieldName, fieldVersion = ""] = field.replace(/\+.*$/, "").split("@");
    const has = (name) => fs.existsSync(path.join(projectRoot, name));

    let name = fieldName || null;
    if (!name) {
        if (has("yarn.lock")) name = "yarn";
        else if (has("package-lock.json")) name = "npm";
        else if (has("pnpm-lock.yaml")) name = "pnpm";
        else if (has("bun.lock") || has("bun.lockb")) name = "bun";
    }
    if (name === "yarn") {
        const classic =
            fieldVersion !== ""
                ? Number.parseInt(fieldVersion, 10) < 2
                : /^# yarn lockfile v1/m.test(
                      fs.readFileSync(path.join(projectRoot, "yarn.lock"), "utf8").slice(0, 200),
                  );
        if (classic) {
            throw new CliError("yarn classic (v1) is not supported; use yarn berry (2+) or npm");
        }
        assertNodeModulesLinker(projectRoot);
        return { name: "yarn", lockfile: "yarn.lock", install: ["yarn"] };
    }
    if (name === "npm") {
        return { name: "npm", lockfile: "package-lock.json", install: ["npm", "install"] };
    }
    throw new CliError(
        name
            ? `unsupported package manager "${name}"; only yarn berry and npm are supported`
            : "could not detect the package manager (no packageManager field or lockfile); only yarn berry and npm are supported",
    );
};

const PNP_MESSAGE =
    "Yarn Plug'n'Play is not supported (patches and Expo read node_modules); set `nodeLinker: node-modules` in .yarnrc.yml";

// Static PnP detection; the yarn preflight also asks `yarn config get nodeLinker`.
const assertNodeModulesLinker = (projectRoot) => {
    const has = (name) => fs.existsSync(path.join(projectRoot, name));
    if (has(".pnp.cjs") || has(".pnp.js")) {
        throw new CliError(PNP_MESSAGE);
    }
    try {
        const rc = fs.readFileSync(path.join(projectRoot, ".yarnrc.yml"), "utf8");
        const match = /^nodeLinker:\s*["']?([\w-]+)/m.exec(rc);
        if (match && match[1] !== "node-modules") {
            throw new CliError(PNP_MESSAGE);
        }
    } catch (error) {
        if (error instanceof CliError) throw error;
    }
};

// `yarn config get <name> --json` output: parsed JSON or undefined.
const parseYarnJson = (stdout) => {
    const text = String(stdout ?? "").trim();
    if (!text) return undefined;
    try {
        return JSON.parse(text);
    } catch {
        // Noise before the value (warnings): take the last line that parses, else the
        // first object or array.
        for (const line of text.split("\n").reverse()) {
            try {
                return JSON.parse(line);
            } catch {
                // keep looking
            }
        }
        const start = text.search(/[{[]/);
        try {
            return start === -1 ? undefined : JSON.parse(text.slice(start));
        } catch {
            return undefined;
        }
    }
};

// Parses `yarn config get npmScopes --json` into the scopes that always require auth.
const parseAuthScopes = (stdout) => {
    const data = parseYarnJson(stdout);
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
        return [];
    }
    return Object.entries(data)
        .filter(([, cfg]) => cfg && (cfg.npmAlwaysAuth === true || cfg.npmAlwaysAuth === "true"))
        .map(([scope, cfg]) => ({
            scope: scope.replace(/^@/, ""),
            registry: cfg.npmRegistryServer ?? "(default registry)",
        }));
};

const UNIT_MINUTES = { ms: 1 / 60000, s: 1 / 60, m: 1, h: 60, d: 1440, w: 10080 };

// "3d", "12h", "30m", "1w" or a bare number in `bareUnit` -> minutes (null when unknown).
const toMinutes = (value, bareUnit) => {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value * UNIT_MINUTES[bareUnit] : null;
    }
    const match = /^\s*(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)?\s*$/.exec(String(value ?? ""));
    if (!match) return null;
    return Number(match[1]) * UNIT_MINUTES[match[2] ?? bareUnit];
};

const globToRegExp = (glob) =>
    new RegExp("^" + glob.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");

// Whether a trusted pattern is covered by yarn's npmPreapprovedPackages (identical, `*`,
// or a preapproved glob matching the pattern text).
const isPreapproved = (pattern, preapproved) =>
    preapproved.some((p) => p === "*" || p === pattern || globToRegExp(p).test(pattern));

const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "optionalDependencies"];

// Every dependency name declared in a package.json object.
const dependencyNames = (pkg) => [
    ...new Set(DEPENDENCY_FIELDS.flatMap((field) => Object.keys(pkg?.[field] ?? {}))),
];

// Reconciles the requested cooldowns with yarn's age gate (minutes; 0 when unset). With
// `packageNames`, a trusted pattern that isn't itself preapproved is split per package:
// preapproved packages keep no cooldown and the rest get the gate.
const resolveCooldowns = ({ cooldown, trusted, gate, packageNames }) => {
    const gateMinutes = gate?.minutes ?? 0;
    const preapproved = gate?.preapproved ?? [];
    const warnings = [];
    let main = cooldown;
    if (gateMinutes > 0) {
        const requested = toMinutes(cooldown, "d");
        if (requested !== null && requested < gateMinutes) {
            main = `${gateMinutes}m`;
            warnings.push(
                `--cooldown ${cooldown} is shorter than yarn's npmMinimalAgeGate (${gateMinutes}m); using ${main}`,
            );
        }
    }
    const gated = (filter, label) => {
        warnings.push(
            `${label}: not in yarn's npmPreapprovedPackages, so yarn would reject releases younger than ${gateMinutes}m; upgrading with --cooldown ${gateMinutes}m (add it to npmPreapprovedPackages in .yarnrc.yml for same-day upgrades)`,
        );
        return { pattern: filter, cooldown: `${gateMinutes}m` };
    };
    const trustedCooldowns = trusted.flatMap((pattern) => {
        if (gateMinutes === 0 || isPreapproved(pattern, preapproved)) {
            return [{ pattern, cooldown: null }];
        }
        if (!packageNames) {
            return [gated(pattern, `trusted pattern ${pattern}`)];
        }
        const matched = packageNames.filter((name) => globToRegExp(pattern).test(name));
        const covered = matched.filter((name) => isPreapproved(name, preapproved));
        const uncovered = matched.filter((name) => !covered.includes(name));
        return [
            ...(covered.length ? [{ pattern: covered.join(","), cooldown: null }] : []),
            ...(uncovered.length ? [gated(uncovered.join(","), `${uncovered.join(", ")} (trusted ${pattern})`)] : []),
        ];
    });
    return { main, trusted: trustedCooldowns, warnings };
};

// Pure: the ordered steps. Commands are `cmd` steps; the rest are file operations.
const buildUpdateDepsPlan = ({
    pm,
    ncuCli,
    expoCli,
    patchPackageCli,
    hasExpo,
    hasPatches,
    cooldown = "3d",
    trusted = [DEFAULT_TRUSTED],
    reject = [],
    gate,
    packageNames,
}) => {
    const rejectArgs = reject.length ? ["--reject", reject.join(",")] : [];
    const ncu = (...args) => [ncuCli, "-u", ...args, ...rejectArgs];
    const cooldowns = resolveCooldowns({ cooldown, trusted, gate, packageNames });
    const steps = [];
    steps.push({ type: "backup" });
    steps.push({ type: "cmd", cmd: process.execPath, args: ncu("--cooldown", cooldowns.main) });
    for (const { pattern, cooldown: own } of cooldowns.trusted) {
        steps.push({
            type: "cmd",
            cmd: process.execPath,
            args: ncu(pattern, ...(own ? ["--cooldown", own] : [])),
        });
    }
    steps.push({ type: "remove-lockfile" });
    if (pm.name === "yarn") {
        steps.push({ type: "touch-lockfile" });
    }
    steps.push({ type: "cmd", cmd: pm.install[0], args: pm.install.slice(1) });
    if (hasExpo) {
        steps.push({ type: "cmd", cmd: process.execPath, args: [expoCli, "install", "--fix"] });
    }
    steps.push({ type: "cmd", cmd: pm.install[0], args: pm.install.slice(1) });
    if (hasPatches) {
        steps.push({
            type: "patch-check",
            cmd: process.execPath,
            args: [patchPackageCli, "--error-on-fail"],
        });
    }
    steps.push({ type: "summary" });
    steps.warnings = cooldowns.warnings;
    return steps;
};

// patch-package names: name+version.patch, @scope+name+version.patch, name+version.dev.patch,
// an optional +NNN+suffix sequence tail, and `++` for nested packages (not supported here).
const parsePatchName = (file) => {
    if (!file.endsWith(".patch")) {
        return { file, skip: "not a .patch file" };
    }
    let base = file.slice(0, -".patch".length);
    let suffix = "";
    if (base.endsWith(".dev")) {
        base = base.slice(0, -".dev".length);
        suffix = ".dev";
    }
    if (base.includes("++")) {
        return { file, skip: "nested package patch (++) cannot be parsed" };
    }
    const parts = base.split("+");
    const nameParts = parts[0].startsWith("@") ? 2 : 1;
    const name = parts.slice(0, nameParts).join("/");
    const version = parts[nameParts];
    if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version) || (nameParts === 2 && !parts[1])) {
        return { file, skip: "cannot find a version in the file name" };
    }
    const tail = parts.slice(nameParts + 1);
    return {
        file,
        name,
        version,
        prefix: parts.slice(0, nameParts).join("+"),
        tail: tail.length ? "+" + tail.join("+") : "",
        suffix,
    };
};

const readInstalledVersion = (projectRoot, name) => {
    try {
        return readJson(path.join(projectRoot, "node_modules", ...name.split("/"), "package.json")).version;
    } catch {
        return null;
    }
};

// Compares every parseable patch with node_modules.
const checkPatches = (projectRoot) => {
    const dir = path.join(projectRoot, "patches");
    const result = { mismatches: [], notes: [] };
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".patch")).sort()) {
        const parsed = parsePatchName(file);
        if (parsed.skip) {
            result.notes.push(`skipped patches/${file}: ${parsed.skip}`);
            continue;
        }
        const installed = readInstalledVersion(projectRoot, parsed.name);
        if (installed === null) {
            result.notes.push(`skipped patches/${file}: ${parsed.name} is not installed`);
        } else if (installed !== parsed.version) {
            result.mismatches.push({
                ...parsed,
                installed,
                renamedTo: `${parsed.prefix}+${installed}${parsed.tail}${parsed.suffix}.patch`,
            });
        }
    }
    return result;
};

const isTracked = (projectRoot, file, spawnSync = childProcess.spawnSync) =>
    spawnSync("git", ["ls-files", "--error-unmatch", file], { cwd: projectRoot, stdio: "ignore" })
        .status === 0;

const renamePatches = async ({ projectRoot, mismatches, runner, spawnSync }) => {
    const done = [];
    for (const m of mismatches) {
        const from = path.join("patches", m.file);
        const to = path.join("patches", m.renamedTo);
        if (fs.existsSync(path.join(projectRoot, to))) {
            runner.log(`note: not renaming ${from}: ${to} already exists`);
            continue;
        }
        if (isTracked(projectRoot, from, spawnSync)) {
            await runner.run("git", ["mv", from, to], { cwd: projectRoot });
        } else {
            runner.log(`renaming ${from} -> ${to}`);
            fs.renameSync(path.join(projectRoot, from), path.join(projectRoot, to));
        }
        done.push({ from, to });
    }
    return done;
};

const parseMajor = (spec) => {
    const match = /^[\s^~<>=v]*(\d+)(?:\.|$|\s)/.exec(String(spec));
    return match ? Number(match[1]) : null;
};

// Dependencies whose declared major changed between two package.json snapshots.
const diffMajors = (before, after) => {
    const flat = (pkg) => Object.assign({}, ...DEP_FIELDS.map((f) => pkg[f] ?? {}));
    const a = flat(before);
    const b = flat(after);
    const majors = [];
    let changed = 0;
    for (const name of Object.keys(b)) {
        if (a[name] === undefined || a[name] === b[name]) continue;
        changed++;
        const from = parseMajor(a[name]);
        const to = parseMajor(b[name]);
        if (from !== null && to !== null && from !== to) {
            majors.push({ name, from: a[name], to: b[name], fromMajor: from, toMajor: to });
        }
    }
    return { changed, majors };
};

const summarize = ({ before, after, log }) => {
    const { changed, majors } = diffMajors(before, after);
    log("");
    log(`Updated ${changed} dependenc${changed === 1 ? "y" : "ies"}; ${majors.length} major version change${majors.length === 1 ? "" : "s"}.`);
    for (const m of majors) {
        log(`  ${m.name}: ${m.from} -> ${m.to}`);
    }
    if (majors.some((m) => m.name === "expo")) {
        log("");
        log("==============================================================");
        log("  Expo SDK upgraded. Before building:");
        log("    - run a clean prebuild (npx expo prebuild --clean)");
        log("    - run pod install in ios/");
        log("    - review the native changes in android/ and ios/");
        log("==============================================================");
    }
};

const backupFiles = (projectRoot, lockfile) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mfrn-update-deps-"));
    const hadLockfile = fs.existsSync(path.join(projectRoot, lockfile));
    fs.copyFileSync(path.join(projectRoot, "package.json"), path.join(dir, "package.json"));
    if (hadLockfile) {
        fs.copyFileSync(path.join(projectRoot, lockfile), path.join(dir, lockfile));
    }
    return { dir, hadLockfile };
};

const restoreBackup = (projectRoot, lockfile, backup) => {
    fs.copyFileSync(path.join(backup.dir, "package.json"), path.join(projectRoot, "package.json"));
    if (backup.hadLockfile) {
        fs.copyFileSync(path.join(backup.dir, lockfile), path.join(projectRoot, lockfile));
    } else {
        fs.rmSync(path.join(projectRoot, lockfile), { force: true });
    }
};

// Yarn preflight, before anything is modified. Returns the age gate for the plan.
const preflight = async ({ projectRoot, runner }) => {
    const { log } = runner;
    const config = (name, allowFail = false) =>
        runner.run("yarn", ["config", "get", name, "--json"], { cwd: projectRoot, capture: true, allowFail });

    const linker = await config("nodeLinker");
    const scopes = await config("npmScopes");
    const gate = await config("npmMinimalAgeGate", true);
    const preapproved = await config("npmPreapprovedPackages", true);

    if (runner.dryRun) {
        log("  (then: reject Plug'n'Play; `yarn npm whoami --scope <scope>` for each scope with npmAlwaysAuth: true; adjust cooldowns to the age gate)");
        return { minutes: 0, preapproved: [] };
    }

    const linkerValue = parseYarnJson(linker.stdout);
    if (typeof linkerValue === "string" && linkerValue !== "node-modules") {
        throw new CliError(`${PNP_MESSAGE} (nodeLinker is ${linkerValue})`);
    }

    for (const { scope, registry } of parseAuthScopes(scopes.stdout)) {
        const who = await runner.run("yarn", ["npm", "whoami", "--scope", scope], {
            cwd: projectRoot,
            allowFail: true,
        });
        if (who.status !== 0) {
            throw new CliError(
                `registry auth failed for scope @${scope} (${registry}); nothing was modified. Fix the token (e.g. \`yarn npm login --scope ${scope}\`) and retry`,
            );
        }
    }

    const minutes = gate.status === 0 ? toMinutes(parseYarnJson(gate.stdout), "m") ?? 0 : 0;
    const list = preapproved.status === 0 ? parseYarnJson(preapproved.stdout) : [];
    return { minutes, preapproved: Array.isArray(list) ? list.map(String) : [] };
};

// Executes the update. Returns the process exit code. `planInput` feeds buildUpdateDepsPlan.
const executeUpdateDeps = async ({ projectRoot, pm, planInput, options, runner, spawnSync, proc }) => {
    const { dryRun, log } = runner;
    const lockPath = path.join(projectRoot, pm.lockfile);
    const before = readJson(path.join(projectRoot, "package.json"));
    let exitCode = 0;

    const gate = pm.name === "yarn" ? await preflight({ projectRoot, runner }) : undefined;
    const plan = buildUpdateDepsPlan({ ...planInput, pm, gate, packageNames: dependencyNames(before) });
    for (const warning of plan.warnings) {
        log(`warning: ${warning}`);
    }
    const guardedSteps = plan.filter((s) => s.type !== "patch-check" && s.type !== "summary");
    const patchStep = plan.find((s) => s.type === "patch-check");

    let backup = null;
    const runGuarded = async () => {
        try {
            for (const step of guardedSteps) {
                switch (step.type) {
                    case "backup":
                        if (dryRun) {
                            log(`[dry-run] would back up package.json and ${pm.lockfile} to a temp dir`);
                        } else {
                            backup = backupFiles(projectRoot, pm.lockfile);
                            log(`Backed up package.json and ${pm.lockfile} to ${backup.dir}`);
                        }
                        break;
                    case "cmd":
                        await runner.run(step.cmd, step.args, { cwd: projectRoot });
                        break;
                    case "remove-lockfile":
                        if (dryRun) {
                            log(`[dry-run] would delete ${pm.lockfile}`);
                        } else {
                            log(`removing ${pm.lockfile}`);
                            fs.rmSync(lockPath, { force: true });
                        }
                        break;
                    case "touch-lockfile":
                        if (dryRun) {
                            log(`[dry-run] would recreate an empty ${pm.lockfile}`);
                        } else {
                            log(`creating empty ${pm.lockfile}`);
                            fs.writeFileSync(lockPath, "");
                        }
                        break;
                    default:
                        break;
                }
            }
        } catch (error) {
            if (backup) {
                restoreBackup(projectRoot, pm.lockfile, backup);
                fs.rmSync(backup.dir, { recursive: true, force: true });
                log(`Restored package.json and ${pm.lockfile} from the backup (backup removed; node_modules was left as is).`);
            }
            throw error;
        }
    };
    if (dryRun) {
        await runGuarded();
    } else {
        await withSignalGuard(runner, runGuarded, proc);
    }

    if (patchStep) {
        if (dryRun) {
            log("[dry-run] would run patch-package and rename mismatched patches:");
        }
        const result = await runner.run(patchStep.cmd, patchStep.args, {
            cwd: projectRoot,
            allowFail: true,
        });
        if (result.status !== 0) {
            log("");
            log("patch-package failed: a patch no longer applies to the installed version.");
            log("Dependencies are installed, so package.json and the lockfile were not restored;");
            log("update or regenerate the patch.");
            if (backup) log(`The pre-upgrade backup is kept at ${backup.dir}`);
            return 1;
        }
        if (dryRun) {
            log(
                options.renamePatches
                    ? "[dry-run] would compare patches/*.patch with node_modules and rename mismatches (git mv when tracked)"
                    : "[dry-run] patch renaming is disabled",
            );
        } else {
            const { mismatches, notes } = checkPatches(projectRoot);
            for (const note of notes) log(`note: ${note}`);
            if (options.renamePatches) {
                await renamePatches({ projectRoot, mismatches, runner, spawnSync });
            } else {
                for (const m of mismatches) {
                    log(`note: patches/${m.file} is for ${m.name}@${m.version} but ${m.installed} is installed`);
                }
            }
        }
    }

    if (dryRun) {
        log("[dry-run] would summarize major version changes");
    } else {
        summarize({
            before,
            after: readJson(path.join(projectRoot, "package.json")),
            log,
        });
        if (backup) {
            fs.rmSync(backup.dir, { recursive: true, force: true });
        }
    }
    return exitCode;
};

const run = async ({ values, projectRoot, runner, spawnSync }) => {
    const pkg = readJson(path.join(projectRoot, "package.json"));
    const pm = detectPackageManager(projectRoot, pkg);
    const hasExpo = Boolean(pkg.dependencies?.expo ?? pkg.devDependencies?.expo);
    const hasPatches = fs.existsSync(path.join(projectRoot, "patches"));
    const installHint = "install the app's dependencies first";
    return executeUpdateDeps({
        projectRoot,
        pm,
        planInput: {
            ncuCli: resolveBin("npm-check-updates", "ncu", [__dirname], "reinstall @zyno-io/mobile-foundation-rn"),
            expoCli: hasExpo ? resolveBin("expo", "expo", [projectRoot], installHint) : undefined,
            patchPackageCli: hasPatches
                ? resolveBin(
                      "patch-package",
                      "patch-package",
                      [projectRoot],
                      "patches/ exists, so add patch-package to the app's devDependencies and install",
                  )
                : undefined,
            hasExpo,
            hasPatches,
            cooldown: values.cooldown,
            trusted: values.trusted?.length ? values.trusted : [DEFAULT_TRUSTED],
            reject: values.reject ?? [],
        },
        options: { renamePatches: !values["no-rename-patches"] },
        runner,
        spawnSync,
    });
};

module.exports = {
    name: "update-deps",
    summary: "Upgrade dependencies, reinstall, fix Expo versions, check patches",
    usage: USAGE,
    options: OPTIONS,
    positionals: false,
    passthrough: false,
    run,
    assertNodeModulesLinker,
    buildUpdateDepsPlan,
    checkPatches,
    detectPackageManager,
    diffMajors,
    executeUpdateDeps,
    formatCommand,
    isPreapproved,
    dependencyNames,
    parseAuthScopes,
    parseMajor,
    parsePatchName,
    parseYarnJson,
    renamePatches,
    resolveCooldowns,
    toMinutes,
};
