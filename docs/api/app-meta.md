# AppMeta

Static service providing device and app metadata. Populated during `useSetupFoundation`.

## Usage

```ts
import { AppMeta } from '@zyno-io/mobile-foundation-rn';

console.log(AppMeta.deviceId);       // "a1b2c3d4-..."
console.log(AppMeta.appVersion);     // "1.2.3"
console.log(AppMeta.isDevelopment);  // true in __DEV__
```

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `isDevelopment` | `boolean` | Reflects `__DEV__` |
| `appEnv` | `string` | From `FoundationConfig.env.APP_ENV` |
| `appEnvTf` | `string` | `appEnv` with `-tf` suffix if running via TestFlight |
| `baseAppVersion` | `string` | Version from `react-native-device-info` |
| `appVersion` | `string` | `BUILD_VERSION` from config, or `baseAppVersion` |
| `appVersionExtended` | `string` | Includes OTA update ID when available |
| `bundleId` | `string` | App bundle identifier |
| `platformVersion` | `string \| number` | OS version |
| `platformVersionInt` | `number` | OS major version as integer |
| `deviceId` | `string` | Unique device ID from `react-native-device-info` |
| `deviceIdEnv` | `string` | `{deviceId}-{appEnv}` |
| `isSimulator` | `boolean` | Running on simulator/emulator |
| `launchTs` | `number` | Timestamp of app launch |
| `activateCount` | `number` | Number of times app has come to foreground |

## Methods

### `load()`

```ts
await AppMeta.load();
```

Populates `deviceId` and `deviceIdEnv` using `react-native-device-info`'s `getUniqueId()`. Called automatically by `useSetupFoundation`.

This method is memoized — calling it multiple times executes the initialization only once.
