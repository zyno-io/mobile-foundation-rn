# Updater

Manages two kinds of app updates:

- **OTA updates** via `expo-updates` — JavaScript bundle updates, checked on launch and when the app returns to the foreground.
- **Native (app-store) updates** via the **Mobile Update Server (MUS)** — detects when a newer binary is available in the store and, when the server marks it required, forces the user to update.

It also applies **device-targeted OTA request headers** (channel / device id) so the update server can target rollouts by channel and device.

## Usage

The Updater runs automatically when initialized via `useSetupFoundation`. The `Updater._useHook()` is invoked at the start of `useSetupFoundation`, setting up the update-checking effects. In most cases you don't need to interact with it directly.

To enable native-update checks, set `MUS_URL`, `MUS_APP_ID`, and `MUS_CHANNEL` in [env config](../guide/configuration#env). Device-targeted OTA request headers only require `MUS_CHANNEL`.

---

## OTA Updates

### `statusText`

MobX observable string showing the current update status:

```tsx
import { observer } from 'mobx-react-lite';
import { Updater, MfText } from '@zyno-io/mobile-foundation-rn';

const UpdateBanner = observer(() => {
    if (!Updater.statusText) return null;
    return <MfText>{Updater.statusText}</MfText>;
});
```

Possible values:
- `null` — no visible update activity (idle, timed out, or deferred)
- `"Starting up..."` — expo-updates startup procedure running
- `"Checking for updates..."` — checking with expo-updates
- `"Downloading update..."` — downloading OTA bundle
- `"Installing update..."` — update pending, install scheduled
- `"Restarting to install update..."` — reloading into the new bundle

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

Register a predicate that defers automatic updates during critical operations (an active call, an in-progress transaction, etc.). While it returns `true`, the Updater holds off on **both**:

- installing/reloading an OTA update, and
- showing the [required-native-update alert](#required-update-alert).

The predicate is read **reactively** — if it reads MobX observables, the deferred work re-evaluates automatically when those observables change (e.g. the alert appears as soon as the call ends).

### `shouldDeferUpdate()`

Returns `true` if the deferral listener says to wait.

---

## Native (App-Store) Updates

Native-update checking requires `MUS_URL`, `MUS_APP_ID`, and `MUS_CHANNEL` to all be set. If any is missing, this whole feature is a no-op and the accessors below return their empty values.

On launch (and whenever the app returns to the foreground), the Updater fetches native-update status from the MUS `native-status` endpoint:

```
GET {MUS_URL}/api/manifest/{MUS_APP_ID}/native-status?channelId={MUS_CHANNEL}&platform={ios|android}
```

The response is stored as an observable and drives the accessors below.

### `INativeUpdateStatus`

The shape returned by the `native-status` endpoint (exported as a type):

```ts
import type { INativeUpdateStatus } from '@zyno-io/mobile-foundation-rn';

interface INativeUpdateStatus {
    platform: 'ios' | 'android';
    channelName: string;
    nativeUpdateRequiredAt: string;   // ISO timestamp of the hard cutoff
    nativeUpdateRequired: boolean;     // server says this build is obsolete now
    latestStoreVersion: string;        // newest version available in the store
    latestStoreVersionDetectedAt: string;
    storeUrl: string;                  // deep link to the store listing
}
```

### `nativeStatus`

Observable getter returning the raw `INativeUpdateStatus | null` (`null` until the first successful fetch).

### `hasNativeUpdate`

`boolean` — `true` when `latestStoreVersion` from the server is newer than the running binary's version (`AppMeta.baseAppVersion`). This reflects *availability*, not whether the update is mandatory.

### `isNativeUpdateRequired`

`boolean` — `true` when the server has marked the running build obsolete (`nativeUpdateRequired === true`).

### `nativeUpdateDeadline`

`Date | null` — the hard cutoff (`nativeUpdateRequiredAt`) after which the build stops working, or `null` if not provided / unparseable.

### `nativeUpdateDaysUntilRequired`

`number | null` — whole days remaining until the deadline (rounded up, minimum `1`). Returns `null` if there is no deadline or it has already passed.

### `nativeDeadlineText`

`string | null` — a ready-to-display message:

- `"An update is required to continue."` when the update is already required
- `"This version will stop working in N days."` (or `"... in 1 day."`) when there is a future deadline
- `"This version will stop working in the near future."` when a deadline exists but days couldn't be computed
- `null` when there is no deadline

Use it to render a soft, dismissible "update available" banner ahead of the hard cutoff:

```tsx
const UpdateNudge = observer(() => {
    if (!Updater.hasNativeUpdate || !Updater.nativeDeadlineText) return null;
    return (
        <MfButton text={Updater.nativeDeadlineText} onPress={() => Updater.openStore()} />
    );
});
```

### `loadNativeStatus()`

```ts
await Updater.loadNativeStatus();
```

Fetches native status immediately and, on the first call, wires up the foreground re-fetch and the alert autorun. Called automatically by `_useHook` on launch; you rarely need to call it directly.

### `openStore()`

Opens `nativeStatus.storeUrl` (the App Store / Play Store listing). No-op if no store URL is known.

### Required-update alert

When an update is both **available** and **required** — and not currently [deferred](#setupdatedeferrallistener-listener) — the Updater shows a non-cancelable **"Update Required"** alert. Tapping **OK**:

1. opens the store via `openStore()`, and
2. calls [`lockUiPermanently()`](#lockuipermanently), leaving the global loader up so the app stays unusable until the user updates.

The alert is shown at most once per app session and re-evaluates reactively, so it appears as soon as a deferral ends.

### `lockUiPermanently()`

Shows the global loader and never dismisses it. Used after the user acknowledges the required-update alert so the app appears locked while they install the new binary from the store.

---

## Device-Targeted OTA Request Headers

When `MUS_CHANNEL` is set (and not in development), the Updater overrides the expo-updates request headers so the MUS can target OTA rollouts:

| Header | Value |
|--------|-------|
| `expo-channel-name` | `MUS_CHANNEL` |
| `mus-device-id` | `AppMeta.deviceId` |

---

## Automatic Behavior

`_useHook` (invoked by `useSetupFoundation`) always starts native-update status loading. Native status self-skips when the full MUS config is absent; when configured, it fetches on launch/foreground and can show the [required-update alert](#required-update-alert), unless deferred.

When **not** in development mode, `_useHook` also:

1. **On launch** — after `AppMeta.load()` completes, starts the MUS header sync and checks for an OTA update.
2. **On foreground** — re-checks for OTA updates (`useAppActivatedEffect`).
3. **On OTA download** — installs immediately, unless [deferred](#setupdatedeferrallistener-listener).

In development mode, OTA checks, MUS request-header overrides, and OTA auto-install are skipped.

The `updaterTimeout` config applies independently whenever the updater enters its startup/checking phase. Downloading has a separate 10-second timeout. Entering a new phase resets the deadline, while pending installation and restart never time out. A timeout only clears the user-facing status; it does not cancel the underlying work. A pending update may display as installing during Expo's native startup procedure, but automatic reload waits until that procedure finishes.

While `shouldDeferUpdate()` is true, `statusText` is immediately masked to `null`. An in-progress check or download may continue, but any scheduled install is canceled and remains pending. When deferral clears, the current unmasked status is restored and a pending install is scheduled again when safe.
