# Updater

Manages two kinds of app updates:

- **OTA updates** via `expo-updates` — JavaScript bundle updates, checked on launch and when the app returns to the foreground.
- **Native (app-store) updates** via the **Mobile Update Server (MUS)** — detects when a newer binary is available in the store and, when the server marks it required, forces the user to update.

It also keeps **MUS-targeted OTA request headers** (channel / device / user id) in sync so the update server can target rollouts by channel, device, and signed-in user.

## Usage

The Updater runs automatically when initialized via `useSetupFoundation`. The `Updater._useHook()` is invoked at the start of `useSetupFoundation`, setting up the update-checking effects. In most cases you don't need to interact with it directly.

To enable native-update checks and MUS-targeted OTA headers, set the `MUS_URL`, `MUS_APP_ID`, and `MUS_CHANNEL` [env config](../guide/configuration#env). If you want the `mus-user-id` header populated, register a user-id provider once you have an auth layer:

```ts
import { Updater } from '@zyno-io/mobile-foundation-rn';

// e.g. after configuring your keychain/auth store
Updater.setUserIdProvider(() => KeychainState.accountId);
```

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
- `null` — no update activity
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

## MUS-Targeted OTA Request Headers

When `MUS_CHANNEL` is set (and not in development), the Updater overrides the expo-updates request headers so the MUS can target OTA rollouts:

| Header | Value |
|--------|-------|
| `expo-channel-name` | `MUS_CHANNEL` |
| `mus-device-id` | `AppMeta.deviceId` |
| `mus-user-id` | result of the registered user-id provider, or `"none"` |

### `setUserIdProvider(provider)`

```ts
Updater.setUserIdProvider(() => KeychainState.accountId);
```

Registers a provider for the current user id. The header override is kept in sync **reactively** — as the provider's observables change (login / logout), the `mus-user-id` header updates automatically. Calling this also starts the header sync if it hasn't started yet. Pass `null` to clear the provider.

---

## Automatic Behavior

When **not** in development mode, `_useHook` (invoked by `useSetupFoundation`):

1. **On launch** — after `AppMeta.load()` completes, checks for an OTA update; also starts the MUS header sync and fetches native update status.
2. **On foreground** — re-checks for OTA updates (`useAppActivatedEffect`) and re-fetches native update status.
3. **On OTA download** — installs immediately, unless [deferred](#setupdatedeferrallistener-listener).
4. **On required native update** — shows the [required-update alert](#required-update-alert), unless deferred.

In development mode all of the above is skipped.

The `updaterTimeout` config controls when the OTA status text is cleared. It does not cancel the underlying `checkForUpdateAsync()` call — the check may still complete in the background after the timeout.
