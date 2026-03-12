# Updater

OTA update management using `expo-updates`. Checks for updates on app launch and foreground.

## Usage

The Updater runs automatically when initialized via `useSetupFoundation`. The `Updater._useHook()` is invoked at the start of `useSetupFoundation`, setting up update checking effects. In most cases you don't need to interact with it directly.

## Properties

### `statusText`

MobX observable string showing the current update status:

```tsx
import { observer } from 'mobx-react-lite';
import { Updater, MFText } from '@zyno-io/mobile-foundation-rn';

const UpdateBanner = observer(() => {
    if (!Updater.statusText) return null;
    return <MFText>{Updater.statusText}</MFText>;
});
```

Possible values:
- `null` — no update in progress
- `"Checking for updates..."` — checking with expo-updates
- `"Downloading update..."` — downloading OTA bundle
- `"Installing update..."` — about to reload

## Methods

### `downloadUpdate()`

```ts
const available = await Updater.downloadUpdate();
```

Checks for and downloads an available update. Returns `true` if an update was downloaded.

### `installUpdate()`

```ts
Updater.installUpdate();
```

Reloads the app with the downloaded update.

### `setUpdateDeferralListener(listener)`

```ts
Updater.setUpdateDeferralListener(() => {
    // Return true to defer the update
    return isUserInMiddleOfCheckout;
});
```

Register a callback that can defer automatic updates during critical operations. The updater checks this before installing.

### `shouldDeferUpdate()`

Returns `true` if the deferral listener says to wait.

## Automatic Behavior

When not in development mode:

1. **On launch**: `_useHook()` sets up an effect that checks for updates after `AppMeta.load()` completes
2. **On foreground**: Checks again when the app comes back to the foreground via `useAppActivatedEffect`
3. **On download**: Installs immediately (unless deferred)

The `updaterTimeout` config controls when the status text is cleared. It does not cancel the underlying `checkForUpdateAsync()` call — the check may still complete in the background after the timeout.
