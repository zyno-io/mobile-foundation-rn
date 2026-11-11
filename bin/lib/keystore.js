const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const { isInsideDirectory } = require("../../plugin/utils");
const { normalizeReleaseSigningOptions } = require("../../plugin/release-signing");
const { loadProjectConfig } = require("./config");
const { CliError, toRelative } = require("./util");

const OPTIONS = {
    out: { type: "string" },
    alias: { type: "string" },
    dname: { type: "string" },
    force: { type: "boolean" },
};

const USAGE = `Usage: mfrn generate-android-keystore [options]

Generate the PKCS12 upload keystore used by Android release signing.

Options:
  --out <path>     Keystore path (default: releaseSigning.keystorePath, else
                   resources/native/android/signer.jks)
  --alias <name>   Key alias (default: releaseSigning.keyAlias, else key0)
  --dname <dn>     Distinguished name (default: CN=<expo name>)
  --force          Overwrite an existing keystore
  --dry-run        Print the command without running it
  --cwd <dir>      App root (default: current directory)

The password comes from the releaseSigning.passwordEnv variable (default
APK_KS_PASSWORD) when set; otherwise a random one is generated and printed once.
It is passed to keytool through the environment, never on the command line.`;

const generatePassword = () => crypto.randomBytes(24).toString("base64url");

// RFC 2253 escaping for a value placed in a DN.
const escapeDnValue = (value) =>
    String(value)
        .replace(/[,+"\\<>;=]/g, (c) => "\\" + c)
        .replace(/^([# ])/, "\\$1")
        .replace(/ $/, "\\ ");

const resolveKeystoreOptions = ({ projectRoot, exp, pluginOptions, flags = {} }) => {
    const raw = pluginOptions?.releaseSigning;
    // `releaseSigning: false` disables signing, not the defaults this command falls back to.
    const normalized = normalizeReleaseSigningOptions(raw === false ? undefined : raw);

    const out = path.resolve(projectRoot, flags.out ?? normalized.keystorePath);
    if (isInsideDirectory(out, path.join(projectRoot, "android"))) {
        throw new CliError(
            "the keystore path must be outside the generated android/ directory (prebuild --clean deletes it)",
        );
    }
    if (fs.existsSync(out) && !flags.force) {
        throw new CliError(
            `${toRelative(projectRoot, out)} already exists; pass --force to overwrite it (the old keystore cannot be recovered)`,
        );
    }

    const alias = flags.alias ?? normalized.keyAlias;
    if (!/^[^'\\\r\n]+$/.test(alias)) {
        throw new CliError("the key alias must be non-empty and contain no quotes, backslashes, or newlines");
    }

    let dname = flags.dname;
    if (dname === undefined) {
        if (typeof exp?.name !== "string" || exp.name.trim() === "") {
            throw new CliError("could not derive a distinguished name from the Expo config; pass --dname");
        }
        dname = "CN=" + escapeDnValue(exp.name.trim());
    }

    return { out, alias, dname, passwordEnv: normalized.passwordEnv };
};

// Pure: the keytool commands. Passwords are referenced by env var name only.
const buildKeystorePlan = ({ out, alias, dname, passwordEnv }) => ({
    generate: {
        cmd: "keytool",
        args: [
            "-genkeypair",
            "-v",
            "-storetype", "PKCS12",
            "-keystore", out,
            "-alias", alias,
            "-keyalg", "RSA",
            "-keysize", "4096",
            "-validity", "10000",
            "-dname", dname,
            "-storepass:env", passwordEnv,
            "-keypass:env", passwordEnv,
        ],
    },
    list: {
        cmd: "keytool",
        args: [
            "-list",
            "-v",
            "-keystore", out,
            "-alias", alias,
            "-storepass:env", passwordEnv,
        ],
    },
});

const parseFingerprints = (output) => {
    const pick = (label) => {
        const match = new RegExp(
            "^\\s*" + label + ":\\s*([0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2})+)\\s*$",
            "m",
        ).exec(output);
        return match ? match[1].toUpperCase() : null;
    };
    return { sha1: pick("SHA-?1"), sha256: pick("SHA-?256") };
};

const keytoolAvailable = (spawnSync = childProcess.spawnSync) => {
    const result = spawnSync("keytool", ["-help"], { stdio: "ignore" });
    return !result.error && result.status === 0;
};

const run = ({
    values,
    projectRoot,
    runner,
    env,
    loadConfig = loadProjectConfig,
    spawnSync,
}) => {
    const { exp, pluginOptions } = loadConfig(projectRoot);
    const resolved = resolveKeystoreOptions({ projectRoot, exp, pluginOptions, flags: values });
    const plan = buildKeystorePlan(resolved);
    const rel = toRelative(projectRoot, resolved.out);
    const { passwordEnv } = resolved;

    if (!keytoolAvailable(spawnSync)) {
        const message = "keytool not found on PATH; a JDK is required (e.g. Temurin 17+)";
        if (!runner.dryRun) {
            throw new CliError(message);
        }
        runner.log("warning: " + message);
    }

    const provided = Boolean(env[passwordEnv]);
    if (runner.dryRun) {
        runner.log(`Would create ${rel}${fs.existsSync(resolved.out) ? " (replacing the existing file)" : ""}`);
        runner.log(
            provided
                ? `Password: from $${passwordEnv}`
                : `Password: a random one would be generated and printed once (set $${passwordEnv} to choose it)`,
        );
        runner.run(plan.generate.cmd, plan.generate.args);
        runner.run(plan.list.cmd, plan.list.args);
        return;
    }

    const password = provided ? env[passwordEnv] : generatePassword();
    const childEnv = { [passwordEnv]: password };
    fs.mkdirSync(path.dirname(resolved.out), { recursive: true });
    if (values.force) {
        fs.rmSync(resolved.out, { force: true });
    }
    runner.run(plan.generate.cmd, plan.generate.args, { cwd: projectRoot, env: childEnv });
    const listing = runner.run(plan.list.cmd, plan.list.args, {
        cwd: projectRoot,
        env: childEnv,
        capture: true,
    });
    const { sha1, sha256 } = parseFingerprints(listing.stdout);

    runner.log("");
    runner.log(`Created ${rel} (alias ${resolved.alias})`);
    runner.log(`SHA-1:   ${sha1 ?? "(not found in keytool output)"}`);
    runner.log(`SHA-256: ${sha256 ?? "(not found in keytool output)"}`);
    runner.log("");
    runner.log("Use these fingerprints for Android App Links (assetlinks.json) and Firebase.");
    runner.log("With Play App Signing this is the upload key; Google holds the app-signing key,");
    runner.log("so also register Play's app-signing fingerprints for assetlinks.json.");
    runner.log("");
    runner.log(`Commit ${rel}: it is useless without the password. releaseSigning picks it up`);
    runner.log("on the next prebuild.");
    if (!provided) {
        runner.log("");
        runner.log("Keystore password (shown once; it cannot be recovered):");
        runner.log(`  ${password}`);
        runner.log(`Store it as the CI secret ${passwordEnv} and in the team password manager.`);
    }
};

module.exports = {
    name: "generate-android-keystore",
    summary: "Generate the Android upload keystore",
    usage: USAGE,
    options: OPTIONS,
    positionals: false,
    passthrough: false,
    run,
    buildKeystorePlan,
    escapeDnValue,
    generatePassword,
    keytoolAvailable,
    parseFingerprints,
    resolveKeystoreOptions,
};
