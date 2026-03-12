# FoundationProvider

Root provider component that sets up all foundation contexts. Wrap your entire app with this component.

## Usage

```tsx
import { FoundationProvider } from '@zyno-io/mobile-foundation-rn';

export default function App() {
    return (
        <FoundationProvider>
            <AppContent />
        </FoundationProvider>
    );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `colorScheme` | `'light' \| 'dark' \| null` | `null` (system) | Override color scheme for React Navigation theming |
| `children` | `ReactNode` | — | App content |

::: info
The `colorScheme` prop controls the React Navigation theme (header/tab bar colors). Foundation's own `useColors()` and `useStyles()` follow the system color scheme or `ColorSchemeOverrideContext`. Use `ColorSchemeOverrideContext` to override foundation colors.
:::

## What It Provides

`FoundationProvider` composes the following providers and behaviors:

- **SafeAreaProvider** — safe area inset context for all child components
- **GestureHandlerRootView** — required by `react-native-gesture-handler`
- **KeyboardProvider** — from `react-native-keyboard-controller` for animated keyboard tracking
- **ActionSheetProvider** — from `@expo/react-native-action-sheet`
- **MfGlobalKeyboardProvider** — foundation's keyboard height context
- **StatusBar** — configured from `FoundationConfig.statusBar`
- **GlobalLoaderOverlay** — shows when `LoaderState.loaderCount > 0`
- **Sentry error boundary** — wraps the app with Sentry's error tracking
- **Deep link handling** — calls `FoundationConfig.deepLinkHandler` when the app is opened via URL
