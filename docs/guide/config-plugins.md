# Expo Config Plugins

Mobile Foundation ships reusable Expo config plugins for Android identity,
build settings, Detox, and the iOS UIScene life cycle. They run during
`npx expo prebuild`, so generated native files do not need to be edited or
committed.

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
                    "detox": true
                }
            ]
        ]
    }
}
```

`androidAppName` changes the launcher label without changing `expo.name`.
`androidNamespace` changes the Gradle namespace and Java/Kotlin source package
without changing the `expo.android.package` application ID.
The [UIScene life cycle](#ios-uiscene-life-cycle) plugin is applied
automatically; pass `"uiScene": false` to opt out.

## iOS UIScene life cycle

Apps built with the iOS 27 SDK (Xcode 27) must adopt the UIScene life cycle or
they refuse to launch:

```
Application failed to launch: UIScene life cycle is required for apps built with this SDK.
```

Expo's bare template still uses the app-delegate life cycle, so the combined
plugin adopts scenes on every prebuild. The standalone entry point does the
same for apps that do not use the combined plugin:

```json
["@zyno-io/mobile-foundation-rn/plugin/ui-scene"]
```

The plugin:

- adds a single-window `UIApplicationSceneManifest` to `Info.plist`
- rewrites the generated `AppDelegate.swift` so a `SceneDelegate` creates the
  window and starts React Native. With Expo 57.0.2x and later the delegate
  subclasses Expo's own `ExpoAppSceneDelegate` (and the app delegate conforms
  to `ExpoReactNativeFactoryProvider`), so Expo forwards scene life-cycle
  events, URLs, universal links, and quick actions to the app delegate. Older
  Expo versions get a self-contained delegate that does the same forwarding, so
  Expo modules and React Native's `Linking` (including `getInitialURL`) keep
  working either way.

It is a no-op when the project already adopts scenes, and it fails the prebuild
if `AppDelegate.swift` no longer matches the Expo template — adopt scenes in
the app itself and set `uiScene: false` in that case.

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
