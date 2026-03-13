# Getting Started

## Installation

```bash
yarn add @zyno-io/mobile-foundation-rn
```

### Peer Dependencies

The library requires the following peer dependencies. Install any that your project doesn't already include:

```bash
yarn add react react-native \
  @react-navigation/native @react-navigation/stack \
  react-native-safe-area-context react-native-gesture-handler \
  react-native-reanimated react-native-keyboard-controller \
  react-native-screens react-native-device-info \
  @react-native-async-storage/async-storage \
  @fortawesome/fontawesome-svg-core @fortawesome/react-native-fontawesome \
  @expo/react-native-action-sheet \
  @sentry/react-native \
  expo-font expo-linking expo-splash-screen expo-updates expo-testflight \
  mobx mobx-react-lite lodash react-native-logs
```

Be sure to then sync the package versions with those required by the version of Expo you're using, if applicable:

```bash
npx expo install --fix
```

## Quick Setup

### 1. Create your app storage

Before using `useSetupFoundation`, you must create an `AppStorage` instance:

```ts
// src/storage.ts
import { createAppStorage } from '@zyno-io/mobile-foundation-rn';

const storage = createAppStorage({
    token: undefined as string | undefined,
    onboardingComplete: false,
});

export default storage;
```

### 2. Configure the foundation

Create a configuration file that runs before any other foundation imports:

```tsx
// src/configure.ts
import './storage'; // Must be created before useSetupFoundation
import { configureFoundation } from '@zyno-io/mobile-foundation-rn';
import { faCheck, faSpinner } from '@fortawesome/free-solid-svg-icons';

configureFoundation({
    colors: {
        light: {
            background: '#ffffff',
            surface: '#f5f5f5',
            text: '#1a1a1a',
            secondaryText: '#666666',
            accent: '#007AFF',
            primaryButtonBackground: '#007AFF',
            primaryButtonText: '#ffffff',
            secondaryButtonBackground: '#e5e5e5',
            secondaryButtonText: '#1a1a1a',
            inputBackground: '#f5f5f5',
            inputText: '#1a1a1a',
            inputPlaceholderText: '#999999',
            inputIcon: '#999999',
            inputInvalidBackground: '#fff0f0',
            fieldLabel: '#666666',
            cardBackground: '#ffffff',
            // ... all ColorScheme keys
        },
        dark: {
            background: '#1a1a1a',
            surface: '#2a2a2a',
            text: '#f0f0f0',
            // ... dark variants
        },
    },
    env: {
        APP_ENV: 'production',
        SENTRY_DSN: 'https://your-dsn@sentry.io/123',
    },
    icons: {
        check: faCheck,
        spinner: faSpinner,
    },
});
```

::: warning IMPORTANT
Import your configure file **before** any other foundation modules in your app entry point. The configuration must be available before components that call `getFoundationConfig()` at module scope.
:::

### 3. Wrap your app with FoundationProvider

```tsx
// App.tsx
import './src/configure'; // Must be first!

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import {
    FoundationProvider,
    useSetupFoundation,
} from '@zyno-io/mobile-foundation-rn';

function AppContent() {
    const isReady = useSetupFoundation();
    if (!isReady) return null;

    return (
        <NavigationContainer>
            {/* Your navigators and screens */}
        </NavigationContainer>
    );
}

export default function App() {
    return (
        <FoundationProvider>
            <AppContent />
        </FoundationProvider>
    );
}
```

### 4. Use foundation components in your screens

```tsx
import {
    MFWrapperView,
    MFScrollView,
    MFText,
    MFTextInput,
    Form,
} from '@zyno-io/mobile-foundation-rn';

function MyScreen() {
    return (
        <MFWrapperView>
            <MFScrollView>
                <Form>
                    <MFText>Fill out the form below:</MFText>
                    <MFTextInput placeholder="Name" returnKeyType="next" />
                    <MFTextInput placeholder="Email" returnKeyType="next" />
                    <MFTextInput placeholder="Phone" mask="phone" returnKeyType="done" />
                </Form>
            </MFScrollView>
        </MFWrapperView>
    );
}
```

Keyboard avoidance, safe area handling, and theming are handled automatically. Form navigation requires setting `returnKeyType` on each input.

## What's Included

| Category | What you get |
|----------|-------------|
| **Layout** | `MFWrapperView`, `MFScrollView`, `MFFlatList` — keyboard-aware containers with safe area support |
| **Inputs** | `MFTextInput`, `MFTextArea` — themed inputs with masks, icons, labels, and form integration |
| **Form** | `Form` + `useNextTextInputRef` — Next/Done keyboard navigation based on input position |
| **UI** | `MFText`, `MFButton`, `MFIcon`, `MFCheckbox`, `MFLoader` — themed primitives |
| **Theming** | `createStyles`, `useStyles`, `useColors` — light/dark scheme with override support |
| **Services** | `AppMeta`, `createAppStorage`, `createLogger`, `SentryHelper`, `Updater` — production essentials |
| **Hooks** | Keyboard height, safe area, app state, navigation focus, mount effects, and more |
