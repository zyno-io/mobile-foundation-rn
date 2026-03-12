# useSetupFoundation

Initializes foundation services and returns a readiness flag. Call this in your root app component.

## Usage

```tsx
import { useSetupFoundation } from '@zyno-io/mobile-foundation-rn';

function AppContent() {
    const isReady = useSetupFoundation();
    if (!isReady) return null;

    return <NavigationContainer>{/* ... */}</NavigationContainer>;
}
```

## Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `appIsReady` | `() => boolean` | — | Optional custom readiness check |

## Return Value

`boolean` — `true` when all initialization is complete.

## What It Does

1. Loads custom fonts from `FoundationConfig.fonts` via `expo-font`
2. Calls `AppMeta.load()` to populate device info and unique ID
3. Calls `AppStorage.$load()` to restore persisted state
4. Waits for `appIsReady()` to return `true` (if provided)
5. Hides the splash screen (if `FoundationConfig.splashScreen` is `'auto'`)

## Splash Screen Control

With `splashScreen: 'auto'` (default), the splash screen is hidden when `isReady` becomes `true`.

With `splashScreen: 'manual'`, you must hide it yourself:

```tsx
import * as SplashScreen from 'expo-splash-screen';

function AppContent() {
    const isReady = useSetupFoundation();

    useEffect(() => {
        if (isReady) {
            // Do additional setup, then:
            SplashScreen.hideAsync();
        }
    }, [isReady]);

    if (!isReady) return null;
    return <NavigationContainer>{/* ... */}</NavigationContainer>;
}
```
