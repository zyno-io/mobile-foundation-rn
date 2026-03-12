# MFWrapperView

The primary layout container. Manages keyboard avoidance, safe area insets, and view measurement for all child components.

## Usage

```tsx
import { MFWrapperView, MFText, MFTextInput } from '@zyno-io/mobile-foundation-rn';

function MyScreen() {
    return (
        <MFWrapperView>
            <View style={{ flex: 1 }}>
                <MFText>Screen content</MFText>
            </View>
            <MFTextInput placeholder="Stays above keyboard" />
        </MFWrapperView>
    );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `safeArea` | `boolean \| Inset \| Inset[]` | `false` | Which safe area insets to apply (top/bottom only) |
| `noKeyboardAvoiding` | `boolean` | `false` | Disable automatic keyboard avoidance |
| `noLayoutCheck` | `boolean` | `false` | Skip layout measurement (for static layouts) |
| `layoutAfterTransition` | `boolean` | `false` | Delay measurement until after screen transitions |
| `center` | `boolean` | `false` | Center children vertically and horizontally |
| `contentContainerStyle` | `ViewStyle` | — | Style for the inner content container |
| `onInsetsPaddingUpdated` | `(padding: Insets) => void` | — | Callback when computed padding changes |
| `children` | `ReactNode` | — | Screen content |

The `MFWrapperViewCommonProps` type is exported for use in custom component props that extend the wrapper's API.

## Safe Area

Control which insets are applied:

```tsx
// All insets (top + bottom)
<MFWrapperView safeArea>

// Bottom only
<MFWrapperView safeArea="bottom">

// Multiple specific insets
<MFWrapperView safeArea={['top', 'bottom']}>
```

The `Inset` type is `'top' | 'bottom' | 'left' | 'right'`. Note that `MFWrapperView` only applies top and bottom padding — left/right values from the safe area hook are not used.

## How Keyboard Avoidance Works

1. `MFWrapperView` measures its absolute `pageY` position on screen
2. When the keyboard opens, it calculates how much of the view would be obscured
3. It applies animated bottom padding to push content above the keyboard
4. The measurement accounts for navigation headers, tab bars, and modal offsets

This approach is more reliable than React Native's built-in `KeyboardAvoidingView` because it measures the actual screen position rather than relying on view hierarchy assumptions.

## Nested Keyboard Contexts

When `MFWrapperView` is used inside another keyboard-aware container, it uses a `KeyboardHeightProvider` to communicate that the keyboard offset is already handled. This prevents double-padding in nested layouts.
