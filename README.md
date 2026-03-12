# @zyno-io/mobile-foundation-rn

Shared foundation library for React Native apps. Provides UI components, state management, services, and app lifecycle utilities to eliminate duplication across projects.

## Installation

```bash
yarn add @zyno-io/mobile-foundation-rn
```

### Peer Dependencies

Your app must install these packages:

- `@expo/react-native-action-sheet`
- `@fortawesome/fontawesome-svg-core`, `@fortawesome/react-native-fontawesome`
- `@react-native-async-storage/async-storage`
- `@react-navigation/native`, `@react-navigation/stack`
- `@sentry/react-native`
- `expo-font`, `expo-linking`, `expo-splash-screen`, `expo-testflight`, `expo-updates`
- `lodash`
- `mobx`, `mobx-react-lite`
- `react`, `react-native`
- `react-native-device-info`, `react-native-gesture-handler`, `react-native-logs`, `react-native-reanimated`, `react-native-safe-area-context`

## Quick Start

### 1. Configure Foundation

Create a setup file (e.g. `src/foundation/setup.ts`) that runs before anything else:

```typescript
import { faCheck, faSpinnerThird } from '@fortawesome/pro-regular-svg-icons';
import { Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { configureFoundation, SentryHelper } from '@zyno-io/mobile-foundation-rn';
import { LightColors, DarkColors } from '@/constants/Colors';
import { Config } from '@/services/Config';
import { OpenApiUserError, OpenApiValidationError } from '@/services/ApiClient.setup';

configureFoundation({
    colors: { light: LightColors, dark: DarkColors },
    env: {
        APP_ENV: Config.APP_ENV,
        BUILD_VERSION: Config.BUILD_VERSION,
        SENTRY_DSN: Config.SENTRY_DSN,
        LOGGER_URL: Config.LOGGER_URL,
        CDN_URL: Config.CDN_URL,
    },
    fonts: { Inter_400Regular, Inter_700Bold },
    icons: { check: faCheck, spinner: faSpinnerThird },
    statusBar: { barStyle: 'light-content', backgroundColorKey: 'background' },
    splashScreen: 'auto', // default; use 'manual' to control splash yourself
    updaterTimeout: 4000,
    deepLinkHandler: (url) => handleDeepLink(url),
    supportContact: 'support@example.com',
    userErrorClasses: [OpenApiUserError, OpenApiValidationError],
});

// Sentry is auto-initialized by configureFoundation
```

### 2. Create App Storage

```typescript
import { createAppStorage } from '@zyno-io/mobile-foundation-rn';

interface IAppStorage {
    deviceToken?: string;
    lastSyncTime?: number;
}

export const AppStorage = createAppStorage<IAppStorage>({});
```

AppStorage is a MobX observable proxy with three special methods:
- `$load()` — Loads persisted state from AsyncStorage (called automatically by `useSetupFoundation`)
- `$persist()` — Manually triggers a persist
- `$clear()` — Clears all values and persists

Setting any property auto-persists with a 250ms debounce:
```typescript
AppStorage.deviceToken = 'abc123'; // automatically saved
```

### 3. Set Up Your App Entry

```typescript
import 'react-native-reanimated';
import '@/foundation/setup';

import { FoundationProvider, useSetupFoundation } from '@zyno-io/mobile-foundation-rn';
import { AppNavigator } from './AppNavigator';

function RootLayout() {
    const isReady = useSetupFoundation();
    if (!isReady) return null;

    return (
        <FoundationProvider>
            <AppNavigator />
        </FoundationProvider>
    );
}

export default RootLayout;
```

## Configuration Reference

### `configureFoundation(config)`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `colors` | `{ light: ColorScheme; dark: ColorScheme }` | Yes | Theme color definitions |
| `env` | `{ APP_ENV, BUILD_VERSION, SENTRY_DSN, LOGGER_URL, CDN_URL }` | Yes | Environment config |
| `icons` | `{ check: IconProp; spinner: IconProp }` | Yes | FontAwesome icons for checkbox and loader |
| `fonts` | `Record<string, any>` | No | Font map passed to `useFonts()` |
| `statusBar` | `{ barStyle, backgroundColorKey? }` | No | Status bar styling |
| `splashScreen` | `'auto' \| 'manual'` | No | Splash screen hide behavior (default: `'auto'`) |
| `updaterTimeout` | `number` | No | Max ms to wait for update check before proceeding |
| `deepLinkHandler` | `(url: string) => void` | No | Handler for incoming deep links |
| `supportContact` | `string` | No | Contact info shown in error dialogs |
| `userErrorClasses` | `ErrorClass[]` | No | Error classes whose messages are shown to users |

## Core Concepts

### `useSetupFoundation(appIsReady?)`

Consolidates all foundation startup into a single hook:
- Initializes Sentry navigation instrumentation
- Runs the OTA updater hook
- Loads fonts via `useFonts()`
- Loads `AppMeta` and `AppStorage`
- Hides the splash screen when ready (unless `splashScreen: 'manual'`)

Pass an optional `appIsReady` callback for app-specific conditions:

```typescript
const isReady = useSetupFoundation(() => myDataIsLoaded);
```

### `<FoundationProvider>`

Wraps your app with all required providers:
- `ActionSheetProvider`
- `ThemeProvider` (React Navigation)
- `MfGlobalKeyboardProvider`
- `GestureHandlerRootView`
- `SafeAreaProvider`
- `StatusBar` (from config)
- `DeepLinkingHandler` (from config)
- `GlobalLoaderOverlay` (connected to foundation's internal `LoaderState`)

Accepts an optional `colorScheme` prop to force light/dark (defaults to system).

### Observable Proxy (`createObservableProxy`)

Creates a MobX-observable proxy that automatically makes new properties observable:

```typescript
const state = createObservableProxy({ count: 0 });
state.count = 1; // observable, triggers reactions
state.newProp = 'hello'; // also observable
```

Supports hooks for custom getters and side effects:

```typescript
const state = createObservableProxy(target, {
    someProp: {
        get: (target) => computedValue,
        afterSet: () => persist(),
    },
});
```

### Updater

Manages Expo OTA updates with observable status:

```typescript
import { Updater } from '@zyno-io/mobile-foundation-rn';
import { observer } from 'mobx-react-lite';

const Startup = observer(() => {
    // Updater.statusText is null when not busy
    if (Updater.statusText) {
        return <Text>{Updater.statusText}</Text>;
    }
    // proceed with app...
});
```

Defer updates during critical operations:
```typescript
Updater.setUpdateDeferralListener(() => isOnActiveCall);
```

## Components

| Component | Description |
|-----------|-------------|
| `MFButton` | Themed button with icon support and loading state |
| `MFCheckbox` | Checkbox using configured check icon |
| `MFFlatList` | Themed FlatList with pull-to-refresh |
| `MFIcon` | FontAwesome icon wrapper |
| `MFLoader` / `MFLoaderView` | Loading spinner using configured spinner icon |
| `MFLoaderOverlay` / `GlobalLoaderOverlay` | Full-screen loading overlay |
| `MFScrollView` | Themed ScrollView |
| `MFText` / `MFStatusTextView` | Themed text components |
| `MFTextArea` | Multi-line text input |
| `MFTextInput` | Single-line text input |
| `MFWrapperView` | Safe-area-aware wrapper view |
| `Form` / `FormContext` | Form context provider |

## Hooks

| Hook | Description |
|------|-------------|
| `useSetupFoundation()` | Foundation startup (see above) |
| `useWaitTask(logger, fn)` | Returns a function that shows the loader overlay during execution |
| `useStyles(styleGen)` | Themed StyleSheet hook |
| `useColors()` | Current theme colors |
| `useMountEffect(fn)` | Effect that runs once on mount |
| `useAppStateEffect(fn)` | Runs on every app state change |
| `useAppActivatedEffect(fn)` | Runs when app comes to foreground |
| `useAppDeactivatedEvent(fn)` | Runs when app goes to background |
| `useNavigationFocusEffect(fn)` | Runs when screen gains focus |
| `useNavigationUnfocusEffect(fn)` | Runs when screen loses focus |
| `useNavigationWithTitle(title)` | Sets navigation title |
| `useNavigationWithOptions(opts)` | Sets navigation options |
| `useNextTextInputRef()` | Auto-focus next input on submit |
| `useMfKeyboardHeight()` | Current keyboard height |
| `useMFSafeAreaInsets()` | Safe area insets with overrides |
| `getLinkingUrl()` | Get the current linking URL synchronously |

## Helpers

| Helper | Description |
|--------|-------------|
| `createStyles(fn)` | Create a themed style generator |
| `createObservableProxy(target, hooks?)` | MobX observable proxy |
| `LoaderState` | Internal observable `{ loaderCount }` used by `useWaitTask` and `GlobalLoaderOverlay` |
| `Broadcast` / `useBroadcastEffect` | Event bus for cross-component communication |
| `formatPhone`, `formatCurrency`, `formatDuration` | Formatting utilities |
| `memoizeAsync(fn)` | Memoize an async function (runs once) |
| `getCdnUrlForId(id)` | CDN URL builder |
| `hasHeightOrFlexProps(style)` | Layout helper |

## Services

| Service | Description |
|---------|-------------|
| `AppMeta` | Device/app metadata (deviceId, appVersion, appEnv, appEnvTf, isDevelopment) |
| `createAppStorage(defaults)` | Persistent observable storage factory |
| `createLogger(name)` | Structured logger with remote transport |
| `UserError` | User-facing error class |
| `SentryHelper` | Sentry initialization, wrapping, and navigation instrumentation |
| `Updater` | OTA update management with observable status |

## Color Scheme

Define your colors using `CreateColorScheme`:

```typescript
import { CreateColorScheme } from '@zyno-io/mobile-foundation-rn';

type AppColorKeys = 'brandPrimary' | 'brandSecondary';

export const LightColors: CreateColorScheme<AppColorKeys> = {
    // base keys (required)
    background: '#FFFFFF',
    text: '#000000',
    secondaryText: '#666666',
    // ...other base keys
    // custom keys
    brandPrimary: '#007AFF',
    brandSecondary: '#5856D6',
};
```

## File Structure

```
src/
  config.ts          — configureFoundation() and FoundationConfig type
  types.ts           — ColorScheme types
  index.ts           — Barrel exports
  components/        — UI components
  hooks/             — React hooks
  helpers/           — Pure utilities (styles, observable, formatting, etc.)
  services/          — Singletons (AppMeta, AppStorage, Logger, Sentry, Updater)
  setup/             — Side-effect imports (Mobx, AppStateTracker)
```
