const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { CliError, formatCommand, resolveBin } = require("./util");
const DEP_FIELDS = ["dependencies", "devDependencies", "optionalDependencies"];

const OPTIONS = {
    cooldown: { type: "string", default: "3d" },
    trusted: { type: "string", multiple: true },
    reject: { type: "string", multiple: true },
    "no-rename-patches": { type: "boolean" },
};

const USAGE = `Usage: mfrn update-deps [options]

Upgrade dependencies, reinstall, fix Expo versions and check patches.

Steps: preflight registry auth (yarn) -> back up package.json and lockfile ->
npm-check-updates (cooldown, then trusted patterns without it) -> recreate the
lockfile and install -> expo install --fix -> install -> patch-package check ->
summary of major changes. Failures before the patch check restore the backups.

Options:
  --cooldown <d>      Minimum release age for upgrades (default: 3d)
  --trusted <glob>    Package pattern upgraded with no cooldown (repeatable,
                      default: @zyno*)
  --reject <pattern>  Package pattern to leave alone (repeatable)
  --no-rename-patches Do not rename patches to the installed version
  --dry-run           Print the commands and planned changes only
  --cwd <dir>         App root (default: current directory)`;

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

// Parses `yarn config get npmScopes --json` into the scopes that always require auth.
const parseAuthScopes = (stdout) => {
    let data;
    const text = stdout.trim();
    try {
        data = JSON.parse(text);
    } catch {
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start === -1 || end <= start) {
            return [];
        }
        try {
            data = JSON.parse(text.slice(start, end + 1));
        } catch {
            return [];
        }
    }
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

// Pure: the ordered steps. Commands are `cmd` steps; the rest are file operations.
const buildUpdateDepsPlan = ({
    pm,
    ncuCli,
    expoCli,
    patchPackageCli,
    hasExpo,
    hasPatches,
    cooldown = "3d",
    trusted = ["@zyno*"],
    reject = [],
}) => {
    const rejectArgs = reject.length ? ["--reject", reject.join(",")] : [];
    const ncu = (...args) => [ncuCli, "-u", ...args, ...rejectArgs];
    const steps = [];
    if (pm.name === "yarn") {
        steps.push({ type: "preflight" });
    }
    steps.push({ type: "backup" });
    steps.push({ type: "cmd", cmd: process.execPath, args: ncu("--cooldown", cooldown) });
    for (const pattern of trusted) {
        steps.push({ type: "cmd", cmd: process.execPath, args: ncu(pattern) });
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
    return steps;
};

// patch-package names: name+version.patch, @scope+name+version.patch, an optional
// +NNN+suffix sequence tail, and `++` for nested packages (not supported here).
const parsePatchName = (file) => {
    if (!file.endsWith(".patch")) {
        return { file, skip: "not a .patch file" };
    }
    const base = file.slice(0, -".patch".length);
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
                renamedTo: `${parsed.prefix}+${installed}${parsed.tail}.patch`,
            });
        }
    }
    return result;
};

const isTracked = (projectRoot, file, spawnSync = childProcess.spawnSync) =>
    spawnSync("git", ["ls-files", "--error-unmatch", file], { cwd: projectRoot, stdio: "ignore" })
        .status === 0;

const renamePatches = ({ projectRoot, mismatches, runner, spawnSync }) => {
    const done = [];
    for (const m of mismatches) {
        const from = path.join("patches", m.file);
        const to = path.join("patches", m.renamedTo);
        if (fs.existsSync(path.join(projectRoot, to))) {
            runner.log(`note: not renaming ${from}: ${to} already exists`);
            continue;
        }
        if (isTracked(projectRoot, from, spawnSync)) {
            runner.run("git", ["mv", from, to], { cwd: projectRoot });
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

const preflight = ({ projectRoot, runner }) => {
    const result = runner.run("yarn", ["config", "get", "npmScopes", "--json"], {
        cwd: projectRoot,
        capture: true,
    });
    if (runner.dryRun) {
        runner.log("  (then `yarn npm whoami --scope <scope>` for each scope with npmAlwaysAuth: true)");
        return;
    }
    for (const { scope, registry } of parseAuthScopes(result.stdout)) {
        const who = runner.run("yarn", ["npm", "whoami", "--scope", scope], {
            cwd: projectRoot,
            allowFail: true,
        });
        if (who.status !== 0) {
            throw new CliError(
                `registry auth failed for scope @${scope} (${registry}); nothing was modified. Fix the token (e.g. \`yarn npm login --scope ${scope}\`) and retry`,
            );
        }
    }
};

// Executes a plan. Returns the process exit code.
const executeUpdateDeps = ({ projectRoot, pm, plan, options, runner, spawnSync }) => {
    const { dryRun, log } = runner;
    const lockPath = path.join(projectRoot, pm.lockfile);
    const before = readJson(path.join(projectRoot, "package.json"));
    let backup = null;
    let exitCode = 0;

    const guarded = [];
    const afterPreflight = [];
    // Steps before `backup` are preflight; steps up to `patch-check` are guarded by the backup.
    let phase = "pre";
    for (const step of plan) {
        if (step.type === "backup") {
            phase = "guarded";
        } else if (step.type === "patch-check") {
            phase = "post";
        } else if (step.type === "summary") {
            phase = "summary";
        }
        (phase === "pre" ? afterPreflight : guarded).push({ ...step, phase });
    }

    for (const step of afterPreflight) {
        preflight({ projectRoot, runner });
    }

    try {
        for (const step of guarded.filter((s) => s.phase === "guarded")) {
            switch (step.type) {
                case "backup":
                    if (dryRun) {
                        log(`[dry-run] would back up package.json and ${pm.lockfile} to a temp dir`);
                    } else {
                        backup = backupFiles(projectRoot, pm.lockfile);
                    }
                    break;
                case "cmd":
                    runner.run(step.cmd, step.args, { cwd: projectRoot });
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
            log(`Restored package.json and ${pm.lockfile} from the backup (node_modules was left as is).`);
        }
        throw error;
    }

    for (const step of guarded.filter((s) => s.phase === "post")) {
        if (dryRun) {
            log("[dry-run] would run patch-package and rename mismatched patches:");
        }
        const result = runner.run(step.cmd, step.args, {
            cwd: projectRoot,
            allowFail: true,
        });
        if (result.status !== 0) {
            log("");
            log("patch-package failed: a patch no longer applies to the installed version.");
            log("Dependencies are installed (the backup was not restored); update or regenerate the patch.");
            exitCode = 1;
        } else if (dryRun) {
            log(
                options.renamePatches
                    ? "[dry-run] would compare patches/*.patch with node_modules and rename mismatches (git mv when tracked)"
                    : "[dry-run] patch renaming is disabled",
            );
        } else {
            const { mismatches, notes } = checkPatches(projectRoot);
            for (const note of notes) log(`note: ${note}`);
            if (options.renamePatches) {
                renamePatches({ projectRoot, mismatches, runner, spawnSync });
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

const run = ({ values, projectRoot, runner, spawnSync }) => {
    const pkg = readJson(path.join(projectRoot, "package.json"));
    const pm = detectPackageManager(projectRoot, pkg);
    const trusted = values.trusted?.length ? values.trusted : ["@zyno*"];
    const hasExpo = Boolean(pkg.dependencies?.expo ?? pkg.devDependencies?.expo);
    const hasPatches = fs.existsSync(path.join(projectRoot, "patches"));
    const installHint = "install the app's dependencies first";
    const plan = buildUpdateDepsPlan({
        pm,
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
        trusted,
        reject: values.reject ?? [],
    });
    const exitCode = executeUpdateDeps({
        projectRoot,
        pm,
        plan,
        options: { renamePatches: !values["no-rename-patches"] },
        runner,
        spawnSync,
    });
    return exitCode;
};

module.exports = {
    name: "update-deps",
    summary: "Upgrade dependencies, reinstall, fix Expo versions, check patches",
    usage: USAGE,
    options: OPTIONS,
    positionals: false,
    passthrough: false,
    run,
    buildUpdateDepsPlan,
    checkPatches,
    detectPackageManager,
    diffMajors,
    executeUpdateDeps,
    formatCommand,
    parseAuthScopes,
    parseMajor,
    parsePatchName,
    renamePatches,
};
