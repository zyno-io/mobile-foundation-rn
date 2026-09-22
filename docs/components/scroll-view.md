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
2. When its visible area changes (the keyboard opening shrinks it), it measures the input's position relative to the scroll view's content
3. If the input is not already fully visible, it scrolls just far enough to show it, keeping a small gap from the edge — an input that is already fully visible is left where it is
4. The scroll animation is smooth and non-jarring

The measurement is independent of how far the scroll view is already scrolled, so inputs deep in a long form (e.g. when large accessibility text pushes them below the fold) land in view rather than overshooting.

This works with both `MfTextInput` and `MfTextArea`, and integrates with `MfForm` keyboard navigation.
