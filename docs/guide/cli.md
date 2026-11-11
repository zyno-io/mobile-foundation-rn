# CLI (`mfrn`)

The package ships an `mfrn` command for chores that sit next to the
[config plugins](/guide/config-plugins). Run it from an app that depends on
`@zyno-io/mobile-foundation-rn`:

```bash
yarn mfrn <command>    # or: npx mfrn <command>
```

Wire the upgrade into the app's scripts:

```json
{
    "scripts": {
        "deps:upgrade": "mfrn update-deps"
    }
}
```

Commands that need app configuration load it with the app's own Expo install
(`expo/config`) and read the options of the `@zyno-io/mobile-foundation-rn`
plugin entry, using the same normalization and validation as `expo prebuild`.

## Global options

| Option | Default | Purpose |
| --- | --- | --- |
| `--cwd <dir>` | current directory | App root; must contain `package.json` |
| `--dry-run` | off | Print the commands and planned file changes; change nothing |
| `-h`, `--help` | | Help, also per command (`mfrn <command> --help`) |

Every external command is echoed as `$ command args` before it runs, inherits
the terminal, and aborts the run with a message if it exits non-zero. An
unknown command or flag prints usage and exits non-zero.

Tools on `PATH`: `yarn` or `npm` for `update-deps`; `bundle` (with `fastlane` in
the app's Gemfile) for `update-match`; `keytool` (any JDK) for
`generate-android-keystore`. `npm-check-updates` is bundled with the package, and
`expo` and `patch-package` are taken from the app's own `node_modules`, so no
global installs are needed. The CLI does not require any particular registry.

## `mfrn update-deps`

Upgrades dependencies, reinstalls, fixes Expo versions and checks patches.

```bash
mfrn update-deps [--cooldown 3d] [--trusted '@zyno*']... [--reject <pattern>]... [--no-rename-patches]
```

| Flag | Default | Purpose |
| --- | --- | --- |
| `--cooldown <d>` | `3d` | Minimum age of a release before it is adopted |
| `--trusted <glob>` | `@zyno*` | Packages upgraded to the newest version with no cooldown; repeatable |
| `--reject <pattern>` | none | Packages left alone; repeatable, applies to both upgrade passes |
| `--no-rename-patches` | off | Report mismatched patches instead of renaming them |

Reads: `package.json` (`packageManager`, dependencies) and the lockfile. It does
not load the Expo config. Supports yarn berry and npm; yarn classic, pnpm and
bun are rejected.

Steps:

1. **Registry preflight (yarn).** Reads `yarn config get npmScopes --json` and
   runs `yarn npm whoami --scope <scope>` for every scope the app configured
   with `npmAlwaysAuth: true`. A failure aborts before anything changes, naming
   the scope and registry from the app's config and suggesting
   `yarn npm login --scope <scope>`. Without such scopes (or with npm) this is a
   no-op. The reason: deleting the lockfile while a private registry rejects
   auth leaves an empty lockfile.
2. Backs up `package.json` and the lockfile to a temp directory.
3. Runs npm-check-updates with the cooldown, then once per trusted pattern
   without it. `--reject` patterns are passed to every pass.
4. Deletes the lockfile (yarn: recreates it empty) and installs.
5. If `expo` is a dependency, runs `expo install --fix` (it respects
   `expo.install.exclude`).
6. Installs again.
7. If `patches/` exists, runs `patch-package --error-on-fail`, then renames
   each `name+version.patch` (also `@scope+name+version.patch`) whose version
   differs from the installed one (`git mv` when tracked). Names it cannot parse
   (for example nested `++` paths) are skipped with a note.
8. Prints the dependencies whose major version changed. When `expo` changed
   major, it prints a prominent reminder to run a clean prebuild and pod
   install and to review the native changes.

Failure behavior: a failure in steps 2 to 6 restores `package.json` and the
lockfile from the backup and says so; `node_modules` is left as is. A
`patch-package` failure does not restore anything (dependencies are installed;
only the patch is broken) and the command exits non-zero.

On disk it changes `package.json`, the lockfile, `node_modules` and, for
renames, `patches/`.

```bash
mfrn update-deps --reject react-native --trusted '@acme/*'
```

## `mfrn update-match [types...]`

Refreshes fastlane match certificates and provisioning profiles. It replaces the
generated `ios/fastlane/update-match.sh`.

```bash
mfrn update-match [development|adhoc|appstore|enterprise]... [--readonly] [-- <fastlane args>]
```

| Flag | Default | Purpose |
| --- | --- | --- |
| `types...` | all configured | Only these profile types |
| `--readonly` | off | Pass `--readonly` to match |
| `-- <args>` | none | Passed through to fastlane |

Reads `fastlane.ios`: `matchAppIdentifiers` (per type), `extensionTargets`
(each identifier also expands to `id.Target`), `matchGitUrl` (`--git_url`) and
`appleTeamId` (else `expo.ios.appleTeamId`, as `--team_id`). It errors when
fastlane or `fastlane.ios` is disabled, when no identifiers are configured, for
an unknown or unconfigured type, and when neither `matchGitUrl` nor the
`MATCH_GIT_URL` environment variable is set.

It runs `bundle exec fastlane match <type> -a <ids> ...` once per type, in
`ios/` (or the project root when there is no `ios/`), and warns when
`FASTLANE_USER` is unset because fastlane then prompts for the Apple ID. It
writes nothing locally; match updates the certificates repository.

```bash
FASTLANE_USER=dev@example.com mfrn update-match appstore --readonly
```

## `mfrn generate-android-keystore`

Generates the PKCS12 upload keystore used by [release signing](/guide/config-plugins#release-signing).

```bash
mfrn generate-android-keystore [--out <path>] [--alias <name>] [--dname <dn>] [--force]
```

| Flag | Default | Purpose |
| --- | --- | --- |
| `--out <path>` | `releaseSigning.keystorePath`, else `resources/native/android/signer.jks` | Keystore location; must be outside `android/` |
| `--alias <name>` | `releaseSigning.keyAlias`, else `key0` | Key alias |
| `--dname <dn>` | `CN=<expo name>` | Certificate distinguished name |
| `--force` | off | Replace an existing keystore |

Reads the `releaseSigning` options (`keystorePath`, `keyAlias`, `passwordEnv`)
and `expo.name`. It refuses to overwrite an existing file without `--force` and
creates missing parent directories. The only file it writes is the keystore.

The password is read from the `passwordEnv` variable (default
`APK_KS_PASSWORD`). When unset, a random one is generated and printed once at the
end; store it as a CI secret with that name and in the team password manager,
because it cannot be recovered. It reaches `keytool` through `-storepass:env` and
`-keypass:env`, never on a command line.

It runs `keytool -genkeypair` (RSA 4096, valid 10000 days), then
`keytool -list -v` and prints the SHA-1 and SHA-256 fingerprints. Use them for
Android App Links (`assetlinks.json`) and Firebase. With Play App Signing this
keystore is the upload key, not the app-signing key. Commit the keystore: it is
useless without the password. `releaseSigning` picks it up on the next prebuild.

```bash
mfrn generate-android-keystore --dname "CN=Example App, O=Example Inc"
```
