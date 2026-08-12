# MfPressable & MfTouchableOpacity

Drop-in replacements for `Pressable` and `TouchableOpacity` with **double-tap prevention wired by default**.

An accidental double-tap on a list row or a nav button fires `onPress` twice, which pushes two screens, sends two messages, or opens two modals. These components swallow the repeat press so you don't have to remember a guard at every call site.

Use `MfPressable` by default. Reach for `MfTouchableOpacity` when you specifically want the built-in fade feedback.

## Usage

```tsx
import { MfPressable, MfTouchableOpacity } from '@zyno-io/mobile-foundation-rn';

// Guarded by default — a rapid second tap is ignored
<MfPressable onPress={() => navigation.navigate('Detail', { id })}>
    <MfText>{item.name}</MfText>
</MfPressable>

// Pressed-state render props work exactly as they do on Pressable
<MfPressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={onSelect}>
    {({ pressed }) => <MfText>{pressed ? 'Selecting…' : 'Select'}</MfText>}
</MfPressable>

// Opacity feedback variant
<MfTouchableOpacity onPress={onSelect}>
    <MfText>Select</MfText>
</MfTouchableOpacity>

// A slower action deserves a longer window
<MfPressable pressThrottleMs={2000} onPress={submitOrder}>
    <MfText>Place order</MfText>
</MfPressable>

// Opt out where repeat presses are the point (keypads, steppers, +/- controls)
<MfPressable pressThrottleMs={0} onPress={() => appendDigit('5')}>
    <MfText>5</MfText>
</MfPressable>
```

## How the guard works

- **Leading edge.** The first press fires immediately — there is no added latency. Presses inside the window are dropped outright, never queued or replayed later.
- **Measured from the last press that *fired*.** A rapid triple-tap fires once, not twice.
- **Per instance.** Each component keeps its own window, so tapping row A doesn't block row B, and a dialer keypad still works when each key has its own handler.
- **`onPress` only.** `onPressIn`, `onPressOut`, and `onLongPress` are passed through untouched.

## Props

Both components accept every prop of the component they wrap (`Pressable` from `react-native-gesture-handler` and `TouchableOpacity` from `react-native`, respectively), plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `pressThrottleMs` | `number` | `500` | Window in ms during which repeat presses are ignored. `0` disables the guard. |

The default comes from `defaults.pressThrottleMs` in your foundation config:

```ts
configureFoundation({
    // …
    defaults: {
        pressThrottleMs: 750, // app-wide; 0 disables everywhere
    },
});
```

`MfButton` extends `MfPressable`, so it is guarded on the same terms and accepts `pressThrottleMs` too.

## useThrottledPress

The same guard as a hook, for handlers you pass to components you don't control — a third-party list row, a navigation `headerRight`, an action-sheet callback.

```tsx
import { useThrottledPress } from '@zyno-io/mobile-foundation-rn';

const onSelect = useThrottledPress(() => navigation.navigate('Detail', { id }));

// …then hand `onSelect` to whatever needs it
<SomeThirdPartyRow onPress={onSelect} />
```

| Argument | Type | Default | Description |
|------|------|---------|-------------|
| `handler` | `(event) => void \| null \| undefined` | — | Handler to guard. A nullish handler returns `undefined`, so `onPress` stays unset. |
| `throttleMs` | `number` | `defaults.pressThrottleMs` (500) | Window in ms. `0` disables. |

The returned callback is referentially stable across renders and always calls the latest `handler`, so it is safe to pass to memoized children.

## Notes

- `MfPressable` wraps `react-native-gesture-handler`'s `Pressable` (the same one `MfButton` already used), not React Native's. It cooperates with RNGH gestures — swipeables, bottom sheets, RNGH scroll views. Behavior is otherwise equivalent.
- `MfCheckbox` is deliberately **not** throttled: two fast taps on a checkbox are two intentional toggles, and swallowing the second would leave it in the wrong state.
