# useMfKeyboardHeight

Provides animated keyboard height tracking using `react-native-keyboard-controller`.

## Usage

```ts
import { useMfKeyboardHeight } from '@zyno-io/mobile-foundation-rn';

function MyComponent() {
    const { keyboardHeight, keyboardOverlapsView, KeyboardHeightProvider } = useMfKeyboardHeight();

    // keyboardHeight is a Reanimated SharedValue<number>
    // keyboardOverlapsView is a boolean indicating if the keyboard overlaps this component
}
```

## Return Value

| Property | Type | Description |
|----------|------|-------------|
| `keyboardHeight` | `SharedValue<number>` | Animated keyboard height value |
| `keyboardOverlapsView` | `boolean` | `true` when tracking is enabled and no ancestor has already applied keyboard avoidance |
| `KeyboardHeightProvider` | `FC` | Provider for nested keyboard contexts |

## Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable/disable keyboard tracking |

## Nested Contexts

When `MfWrapperView` handles keyboard avoidance, it wraps children in `KeyboardHeightProvider` which reports the keyboard as already handled. This prevents child components from double-applying the keyboard offset.

## Global Context

`MfGlobalKeyboardProvider` and `MfGlobalKeyboardContext` provide app-wide keyboard state. These are set up by `MfProvider` — you don't need to add them manually.
