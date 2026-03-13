# Keyboard Avoidance

The foundation provides automatic keyboard avoidance that works across all React Navigation layouts — stack screens, tab bars, modals, and nested navigators.

## How It Works

Three components work together:

1. **`MfWrapperView`** — measures its position on screen and applies bottom padding equal to the keyboard height (minus any portion of the view already below the keyboard line)
2. **`MfScrollView`** / **`MfFlatList`** — auto-scrolls the focused input into view when the keyboard opens
3. **`useMfKeyboardHeight`** — provides animated keyboard height values using `react-native-keyboard-controller`

The system handles coordinate offsets from navigation headers, tab bars, and modal presentation automatically because `MfWrapperView` measures its absolute `pageY` position.

## Basic Usage

```tsx
import { MfWrapperView, MfTextInput } from '@zyno-io/mobile-foundation-rn';

function MyScreen() {
    return (
        <MfWrapperView>
            <View style={{ flex: 1 }}>
                <Text>Content</Text>
            </View>
            <MfTextInput placeholder="This stays above the keyboard" />
        </MfWrapperView>
    );
}
```

## With Scrollable Content

```tsx
import { MfWrapperView, MfScrollView, MfTextInput } from '@zyno-io/mobile-foundation-rn';

function FormScreen() {
    return (
        <MfWrapperView>
            <MfScrollView>
                <MfTextInput placeholder="Name" />
                <View style={{ height: 600 }} />
                <MfTextInput placeholder="This one auto-scrolls into view" />
            </MfScrollView>
        </MfWrapperView>
    );
}
```

When the lower input is focused, `MfScrollView` scrolls it into the visible area above the keyboard.

## Navigator Layouts

The keyboard system handles all common layouts:

### Stack Screen with Header

```tsx
<Stack.Screen
    name="MyScreen"
    component={MyScreen}
    options={{ headerShown: true, title: 'Form' }}
/>
```

`MfWrapperView` accounts for the header height automatically — no extra configuration needed.

### Tab Bar

```tsx
function TabScreen() {
    return (
        <MfWrapperView>
            <View style={{ flex: 1 }}>
                <Text>Tab content</Text>
            </View>
            <MfTextInput placeholder="Above tab bar, above keyboard when open" />
        </MfWrapperView>
    );
}
```

The input sits above the tab bar normally, and above the keyboard when it opens.

### Modal Presentation

```tsx
<Stack.Screen
    name="Modal"
    component={ModalScreen}
    options={{ presentation: 'modal' }}
/>
```

Modals have different coordinate geometry — `MfWrapperView` handles this transparently.

## Disabling Keyboard Avoidance

For screens where you manage keyboard behavior yourself:

```tsx
<MfWrapperView noKeyboardAvoiding>
    {/* Keyboard avoidance disabled */}
</MfWrapperView>
```

Or on the scroll view:

```tsx
<MfScrollView noKeyboardAvoiding>
    {/* Auto-scroll disabled */}
</MfScrollView>
```

## Nested Contexts

The keyboard height system prevents double-counting when `MfWrapperView` and `MfScrollView` are nested. The inner component uses a `KeyboardHeightProvider` that reports the keyboard as already handled, so child components don't apply the offset twice.

## Safe Area Integration

Keyboard avoidance and safe area insets are coordinated. See [MfWrapperView](../components/wrapper-view) and [useMfSafeAreaInsets](../hooks/safe-area-insets) for details on how `safeArea` props interact with keyboard padding.
