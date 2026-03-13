# MfScrollView

Keyboard-aware scroll view that auto-scrolls focused inputs into view. Use inside `MfWrapperView`.

## Usage

```tsx
import { MfWrapperView, MfScrollView, MfTextInput } from '@zyno-io/mobile-foundation-rn';

function FormScreen() {
    return (
        <MfWrapperView>
            <MfScrollView>
                <MfTextInput placeholder="Name" />
                <View style={{ height: 600 }} />
                <MfTextInput placeholder="Email" />
            </MfScrollView>
        </MfWrapperView>
    );
}
```

When "Email" is focused, the scroll view scrolls it into the visible area above the keyboard.

## Props

Extends all standard `ScrollViewProps`, plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `safeArea` | `boolean \| Inset \| Inset[]` | `false` | Safe area insets to apply as content padding (top/bottom only) |
| `noKeyboardAvoiding` | `boolean` | `false` | Disable auto-scroll to focused input |
| `allowOverscroll` | `boolean` | `false` | Allow overscroll bounce at edges |

The `MfScrollViewProps` type is exported for use in custom component props.

## Auto-Scroll Behavior

When an input inside the scroll view receives focus:

1. The scroll view detects the focused input via `MfActiveTextInputContext`
2. It measures the input's position relative to the scroll view
3. It scrolls to position the input in the visible area above the keyboard
4. The scroll animation is smooth and non-jarring

This works with both `MfTextInput` and `MfTextArea`, and integrates with `MfForm` keyboard navigation.
