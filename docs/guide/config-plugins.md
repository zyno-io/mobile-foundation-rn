# Expo Config Plugins

Mobile Foundation ships reusable Expo config plugins for Android identity,
build settings, Detox, Android release signing, fastlane files, and Sentry
automatic-upload defaults. They require Expo SDK 58 or newer and run during
`npx expo prebuild`, so generated native files do not need to be edited or
committed. Expo handles the iOS scene life cycle automatically.

## Combined plugin

Use the package root when an app needs more than one capability:

```json
{
    "expo": {
        "android": {
            "package": "app.example.dev"
        },
        "plugins": [
            [
                "@zyno-io/mobile-foundation-rn",
                {
                    "androidAppName": "Example (Dev)",
                    "androidNamespace": "app.example",
                    "androidBuildProperties": {
                        "gradleProperties": {
                            "org.gradle.jvmargs": "-Xmx2048m -XX:MaxMetaspaceSize=1024m"
                        },
                        "gradleWrapperProperties": {
                            "networkTimeout": 60000
                        }
                    },
                    "detox": true,
                    "releaseSigning": true,
                    "fastlane": {
                        "ios": {
                            "matchGitUrl": "git@git.example.com:team/fastlane-certs.git",
                            "extensionTargets": ["ExampleAlerts"],
                            "matchAppIdentifiers": {
                                "development": ["app.example.dev"],
                                "appstore": ["app.example"]
                            }
                        }
                    }
                }
            ]
        ]
    }
}
```

`androidAppName` changes the launcher label without changing `expo.name`.
`androidNamespace` changes the Gradle namespace and Java/Kotlin source package
without changing the `expo.android.package` application ID.

## Defaults

These apply to every combined-plugin entry, including a bare
`"@zyno-io/mobile-foundation-rn"` with no options:

| Feature | Default | Turn off |
| --- | --- | --- |
| Release signing | Automatic: on only when `resources/native/android/signer.jks` exists | `releaseSigning: false` |
| Sentry automatic upload | Disabled on iOS and Android | `disableSentryAutoUpload: false` |
| Fastlane | Generated for iOS and Android | `fastlane: false` (or `fastlane.ios` / `fastlane.android: false`) |
| R8 | `android.enableMinifyInReleaseBuilds=false` | set the property to `true` in `gradleProperties` |

The standalone `android-build-properties` entry has no defaults.

## Android build properties

The standalone entry point writes arbitrary properties to the generated
`android/gradle.properties` and
`android/gradle/wrapper/gradle-wrapper.properties` files:

```json
[
    "@zyno-io/mobile-foundation-rn/plugin/android-build-properties",
    {
        "gradleProperties": {
            "org.gradle.jvmargs": "-Xmx4g -XX:MaxMetaspaceSize=1g",
            "org.gradle.parallel": true
        },
        "gradleWrapperProperties": {
            "networkTimeout": 60000
        }
    }
]
```

Values may be strings, numbers, or booleans. Existing properties are replaced
in place and missing properties are appended. This plugin covers raw settings
that `expo-build-properties` does not expose.

## Release signing

`releaseSigning` adds a `release` signing config to `android/app/build.gradle`,
points the release build type at it, and copies the keystore to
`android/signer.jks`.

- **Automatic (option omitted):** enabled only when the keystore exists. If an
  app plugin already defines a `release` signing config, foundation warns and
  skips.
- **Explicit (`true` or an object):** the keystore must exist and a conflicting
  `release` config throws. Recommended for production apps, so a missing
  keystore fails the prebuild instead of silently shipping a debug-signed build.
- **`false`:** off. Foundation's own block is removed if present.

```json
"releaseSigning": {
    "keystorePath": "resources/native/android/signer.jks",
    "keyAlias": "key0",
    "passwordEnv": "APK_KS_PASSWORD",
    "debugKeystoreFallback": "local"
}
```

Values shown are the defaults. `debugKeystoreFallback` controls what happens
when the password variable is unset:

- `'local'`: fall back to the debug keystore only when `CI` is unset.
- `'always'`: always fall back. Reserve for CI that only builds E2E binaries.
- `'never'`: no fallback; the build has no signing config without the secret.

The pipeline contract is `android/signer.jks`, alias `key0`, and the
`APK_KS_PASSWORD` environment variable (store and key password). Keep the
keystore outside `android/`, which prebuild regenerates. A `--no-clean` prebuild
over a signing block left by an app-local plugin throws in explicit mode
(`releaseSigning: true`) and warns and skips in automatic mode; run
`npx expo prebuild --clean` after removing the app-local block.

Create the keystore with `mfrn generate-android-keystore`; it uses these
options as defaults. See the [CLI guide](/guide/cli).

## Sentry automatic upload

`disableSentryAutoUpload` (default `true`) stops Sentry from uploading during
native builds, because CI uploads JS source maps itself. It edits two files:

- `ios/.xcode.env`: exports `SENTRY_DISABLE_AUTO_UPLOAD=true` unless the
  variable is already `false`.
- `android/app/build.gradle`: sets `project.ext.shouldSentryAutoUploadGeneral`
  to read the same variable, after Sentry's `apply from`.

Set `SENTRY_DISABLE_AUTO_UPLOAD=false` at build time to re-enable uploads. The
plugin coexists with Sentry's own Expo plugin and its `disableAutoUpload`
option; foundation's assignment is evaluated last and wins.

## Fastlane

`fastlane` generates files into `ios/fastlane/` and `android/fastlane/`:

| File | Platform | Purpose |
| --- | --- | --- |
| `Appfile` | both | Bundle ID or package name (env override in CI), iOS team ID |
| `Fastfile` | both | Lanes the pipeline calls |
| `Matchfile` | iOS | match storage and default type |
| `.gitignore` | both | Ignores `report.xml` and `asc-api-key.json` |

The pipeline calls the iOS lanes `update_metadata`, `prepare_provisioning` and
`build`. On Android it runs `fastlane supply` directly, which reads only the
Appfile; the generated `deploy` lane is for local use.

Values come from options, falling back to the Expo config:

- `appleTeamId` from `expo.ios.appleTeamId`. When missing, the Appfile omits
  `team_id` and prebuild warns.
- `bundleIdentifier` from `expo.ios.bundleIdentifier`; `packageName` from
  `expo.android.package`. CI sets `BUNDLE_IDENTIFIER_IOS` and
  `BUNDLE_IDENTIFIER_ANDROID`, so these only matter for local runs.
- `extensionTargets` lists extension target names. Each must equal its
  bundle-ID suffix.
- `matchGitUrl` has no default. Without it the Matchfile omits `git_url`. CI is
  unaffected because it passes `git_url` to `prepare_provisioning`; local
  `match` runs (including `mfrn update-match`) then need `git_url:` or
  `MATCH_GIT_URL`. Set `matchGitUrl` to make local runs work out of the box.
- `matchAppIdentifiers` maps each profile type (`development`, `adhoc`,
  `appstore`, `enterprise`) to bundle IDs. It no longer renders a file; it is
  the input of `mfrn update-match`, which expands `extensionTargets` for you.
  Earlier versions generated `ios/fastlane/update-match.sh`; prebuild deletes a
  leftover copy that still carries the generated marker.
- Local `match` runs read the Apple ID from `FASTLANE_USER`.

### Overrides and appended lanes

`fastlane.ios.sourceDir` (default `resources/native/ios/fastlane`) and
`fastlane.android.sourceDir` (default `resources/native/android/fastlane`) add
per-file overrides. Every entry is copied on top of the generated output, and
foundation warns when one replaces a generated file. Put lane additions in
`Fastfile.append`, which is added to the end of the generated Fastfile; use
`override_lane` to replace an existing lane. Do not provide both `Fastfile` and
`Fastfile.append`. The directory must be outside `ios/` and `android/`.

The pipeline's repo-root `fastlane/<platform>/` copy still lands on top in
deploy jobs, so don't use both mechanisms.

## R8

`android.enableMinifyInReleaseBuilds` defaults to `false` in the combined
plugin. R8 makes native Android stack traces unreadable unless the pipeline
uploads mapping files. Opt in per app:

```json
"androidBuildProperties": {
    "gradleProperties": { "android.enableMinifyInReleaseBuilds": true }
}
```

## Plugin order

List the foundation plugin before app-local plugins. Expo runs the
earliest-listed plugin's mods last, so app plugins run first and foundation's
conflict check sees their signing config. If an app plugin listed before
foundation injects its own `release` signing config, both blocks end up in
`build.gradle` and Gradle merges them without an error: foundation's block comes
later, so its keystore and alias silently win. Either list foundation first or
set `releaseSigning: false`.

`expo-build-properties` writes the same `android.enableMinifyInReleaseBuilds`
property. When an app sets `enableMinifyInReleaseBuilds` (or
`enableProguardInReleaseBuilds`) there, foundation skips its R8 default so the
app's setting wins regardless of plugin order.

## Migrating from app-local plugins

1. Enable the foundation options and keep your existing files in `sourceDir`.
   Foundation reproduces them, with override warnings.
2. Delete files from `sourceDir` one at a time, and remove the matching
   app-local plugin code.
3. Run `npx expo prebuild --clean` after each change and review the diff.

## Public config

Plugin options are embedded in the app's public Expo config (including OTA
manifests). Never put secrets or personal data in them.

## Detox Android setup

Install Detox in the app:

```bash
yarn add --dev detox
```

Enable the standalone plugin:

```json
[
    "@zyno-io/mobile-foundation-rn/plugin/detox",
    {
        "androidPackage": "app.example",
        "allowCleartextTraffic": true,
        "disableAutofill": true,
        "masterTimeoutSec": 120,
        "idleResourceTimeoutSec": 60,
        "rnContextLoadTimeoutSec": 120
    }
]
```

The plugin generates the shared Android native setup:

- Detox Maven repository
- Android instrumentation runner and build type
- Detox and JUnit Android test dependencies
- duplicate native-library packaging rules
- `DetoxTest.java`
- optional cleartext-traffic and autofill manifest settings

All options are optional. The three timeout defaults are 90, 60, and 180
seconds. `allowCleartextTraffic` defaults to `false`; enable it only for a
dedicated E2E build that does not manage cleartext traffic through its own
manifest or network-security plugin. `disableAutofill` defaults to `true`.
`androidPackage` defaults to `expo.android.package`; set it explicitly when the
Java/Kotlin namespace differs from the application ID. The combined plugin
automatically passes `androidNamespace` to Detox.

The app still owns `.detoxrc.js`, Jest configuration, test files, device
selection, and project-specific network security or iOS synchronization code.
Keep `allowCleartextTraffic` disabled when another app plugin owns that setting.

Do not enable this plugin and `@config-plugins/detox` together. After migrating,
remove `@config-plugins/detox` and hand-maintained copies of the native changes
listed above. Regenerate native directories with a clean prebuild to verify the
migration.
