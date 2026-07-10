# Configuration

## `configureFoundation(config)`

Initializes the foundation library. Must be called once before any foundation components or services are used.

```ts
import { configureFoundation } from '@zyno-io/mobile-foundation-rn';

configureFoundation({
    colors: { light: { ... }, dark: { ... } },
    env: { ... },
    icons: { check: faCheck, spinner: faSpinner },
    // Optional:
    fonts: { 'CustomFont-Bold': require('./assets/fonts/CustomFont-Bold.ttf') },
    updaterTimeout: 5000,
    statusBar: { barStyle: 'auto' },
    splashScreen: 'auto',
    deepLinkHandler: (url) => handleDeepLink(url),
    supportContact: 'support@example.com',
    userErrorClasses: [MyCustomError],
});
```

## FoundationConfig

```ts
interface FoundationConfig {
    colors: {
        light: ColorScheme;
        dark: ColorScheme;
    };
    env: {
        APP_ENV?: string;
        BUILD_VERSION?: string;
        SENTRY_DSN?: string;
        LOGGER_URL?: string;
        CDN_URL?: string;
        MUS_URL?: string;
        MUS_APP_ID?: string;
        MUS_CHANNEL?: string;
    };
    icons: {
        check: IconProp;
        spinner: IconProp;
    };
    fonts?: Record<string, any>;
    updaterTimeout?: number;
    statusBar?: {
        barStyle: StatusBarStyle | 'auto';
        backgroundColorKey?: string;
    };
    splashScreen?: 'auto' | 'manual';
    deepLinkHandler?: (url: string) => void;
    supportContact?: string;
    userErrorClasses?: Array<new (...args: any[]) => Error>;
}
```

### `colors`

Light and dark color schemes. See [Theming](./theming) for the full `ColorScheme` type.

### `env`

Environment variables used by services:

| Key | Used by | Purpose |
|-----|---------|---------|
| `APP_ENV` | AppMeta | Identifies environment (e.g., `production`, `staging`) |
| `BUILD_VERSION` | AppMeta | Overrides device-reported version |
| `SENTRY_DSN` | SentryHelper | Sentry DSN for crash reporting |
| `LOGGER_URL` | Logger | Remote logging endpoint |
| `CDN_URL` | Storage helpers | CDN base URL for asset paths |
| `MUS_URL` | Updater | Base URL of the Mobile Update Server for native-update status |
| `MUS_APP_ID` | Updater | MUS application id used in the native-status endpoint path |
| `MUS_CHANNEL` | Updater | Release channel; sent as the `expo-channel-name` OTA header and in the native-status query |

The three `MUS_*` keys are required together for [native (app-store) update checks](../api/updater#native-app-store-updates). If any of them is missing, native-update checking is disabled (a no-op) and the related `Updater` accessors return their empty values. Device-targeted OTA request headers only require `MUS_CHANNEL`.

### `icons`

FontAwesome icons used by foundation components:

- `check` — used by `MfCheckbox`
- `spinner` — used by `MfLoader`

### `fonts`

Optional custom font map passed to `expo-font` during setup. Loaded by `useSetupFoundation`.

### `updaterTimeout`

Timeout in milliseconds for each OTA startup/checking phase. Entering checking starts a fresh timer. Downloading starts a separate 10-second timer, while pending installation and restart have no timeout. When a phase times out, the update status UI is cleared, though the underlying work may still complete in the background; entering a new phase makes that phase visible and starts its own timer.

### `statusBar`

Controls the `StatusBar` rendered by `MfProvider`:

- `barStyle: 'auto'` — automatically sets `light-content` for dark theme, `dark-content` for light
- `backgroundColorKey` — key from `ColorScheme` to use as the status bar background color (Android)

### `splashScreen`

Controls splash screen dismissal in `useSetupFoundation`:

- `'auto'` (default) — hides the splash screen when setup completes
- `'manual'` — you must call `SplashScreen.hideAsync()` yourself

### `deepLinkHandler`

Called with the URL when the app is opened via a deep link. Invoked by `MfProvider`.

### `supportContact`

A string displayed in error dialogs for unexpected errors. When set, the generic error alert includes this text (e.g., an email address or phone number).

```ts
configureFoundation({
    // ...
    supportContact: 'support@example.com',
});
```

### `userErrorClasses`

Array of custom Error subclasses that should be treated like `UserError` — their message is shown directly in alerts without the generic "unexpected error" wrapper.

## Side Effects

`configureFoundation` also:

1. Configures MobX (`enforceActions: 'never'`)
2. Schedules `SentryHelper.init()` via `setImmediate`
3. Starts `AppStateTracker` (logs app lifecycle events)
