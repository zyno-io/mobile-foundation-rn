# Theming

The foundation provides a complete light/dark theming system built on React Native's `useColorScheme` and MobX.

## Color Scheme

Define your colors when calling `configureFoundation`. Both `light` and `dark` schemes must provide all required keys:

```ts
configureFoundation({
    colors: {
        light: {
            transparent: 'transparent',
            white: '#ffffff',
            black: '#000000',
            background: '#ffffff',
            surface: '#f5f5f5',
            text: '#1a1a1a',
            secondaryText: '#666666',
            accent: '#007AFF',
            primaryButtonBackground: '#007AFF',
            primaryButtonText: '#ffffff',
            secondaryButtonBackground: '#e5e5e5',
            secondaryButtonText: '#1a1a1a',
            cardBackground: '#ffffff',
            cardBorder: '#e0e0e0',
            cardText: '#1a1a1a',
            cardSecondaryText: '#666666',
            cardTertiaryText: '#999999',
            fieldLabel: '#666666',
            inputBackground: '#f5f5f5',
            inputInvalidBackground: '#fff0f0',
            inputText: '#1a1a1a',
            inputIcon: '#999999',
            inputPlaceholderText: '#999999',
            selectedItemBackground: '#e8f0fe',
            selectedItemBorder: '#007AFF',
            selectedItemText: '#007AFF',
            infoText: '#666666',
            dangerBackground: '#fff0f0',
            dangerButtonBackground: '#ff3b30',
            dangerButtonText: '#ffffff',
        },
        dark: {
            // ... dark variants of the same keys
        },
    },
    // ...
});
```

## Custom Color Keys

Use `CreateColorScheme<T>` to add app-specific color keys. The generic parameter is a union of string literal key names:

```ts
import type { CreateColorScheme } from '@zyno-io/mobile-foundation-rn';

type AppColors = CreateColorScheme<'brandGradientStart' | 'brandGradientEnd'>;
```

This produces a type with all base theme keys plus your custom keys, all mapping to `string` values.

## `createStyles` / `useStyles`

Create theme-aware stylesheets:

```ts
import { createStyles, useStyles } from '@zyno-io/mobile-foundation-rn';

const getStyles = createStyles((colors) => ({
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    title: {
        color: colors.text,
        fontSize: 24,
    },
    card: {
        backgroundColor: colors.cardBackground,
        borderColor: colors.cardBorder,
        borderWidth: 1,
        borderRadius: 8,
    },
}));

function MyComponent() {
    const styles = useStyles(getStyles);
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Hello</Text>
        </View>
    );
}
```

Styles are memoized — the same scheme and generator always return the same object reference.

The `StyleGenerator` type is exported for use in your own utility functions:

```ts
import type { StyleGenerator } from '@zyno-io/mobile-foundation-rn';
```

## `useColors`

Access the current color scheme directly:

```ts
import { useColors } from '@zyno-io/mobile-foundation-rn';

function MyComponent() {
    const colors = useColors();
    return <View style={{ backgroundColor: colors.accent }} />;
}
```

## Color Scheme Override

Force a subtree to use a specific color scheme regardless of system setting:

```tsx
import { ColorSchemeOverrideContext } from '@zyno-io/mobile-foundation-rn';

function AlwaysDarkSection({ children }) {
    return (
        <ColorSchemeOverrideContext.Provider value="dark">
            {children}
        </ColorSchemeOverrideContext.Provider>
    );
}
```

`useColorSchemeOverride()` returns the current override value (`null` means follow system).

## FoundationProvider `colorScheme` Prop

Override the color scheme used for React Navigation theming:

```tsx
<FoundationProvider colorScheme="dark">
    <AppContent />
</FoundationProvider>
```

::: warning
This prop controls the React Navigation theme (header/tab bar colors). Foundation's own `useColors()` and `useStyles()` follow the system color scheme or `ColorSchemeOverrideContext`. To override foundation colors globally, use `ColorSchemeOverrideContext` at the root of your app.
:::
