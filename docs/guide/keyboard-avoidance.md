# Keyboard Avoidance

The foundation provides automatic keyboard avoidance that works across all React Navigation layouts — stack screens, tab bars, modals, and nested navigators.

## How It Works

Three components work together:

1. **`MFWrapperView`** — measures its position on screen and applies bottom padding equal to the keyboard height (minus any portion of the view already below the keyboard line)
2. **`MFScrollView`** / **`MFFlatList`** — auto-scrolls the focused input into view when the keyboard opens
3. **`useMfKeyboardHeight`** — provides animated keyboard height values using `react-native-keyboard-controller`

The system handles coordinate offsets from navigation headers, tab bars, and modal presentation automatically because `MFWrapperView` measures its absolute `pageY` position.

## Basic Usage

```tsx
import { MFWrapperView, MFTextInput } from '@zyno-io/mobile-foundation-rn';

function MyScreen() {
    return (
        <MFWrapperView>
            <View style={{ flex: 1 }}>
                <Text>Content</Text>
            </View>
            <MFTextInput placeholder="This stays above the keyboard" />
        </MFWrapperView>
    );
}
```

## With Scrollable Content

```tsx
import { MFWrapperView, MFScrollView, MFTextInput } from '@zyno-io/mobile-foundation-rn';

function FormScreen() {
    return (
        <MFWrapperView>
            <MFScrollView>
                <MFTextInput placeholder="Name" />
                <View style={{ height: 600 }} />
                <MFTextInput placeholder="This one auto-scrolls into view" />
            </MFScrollView>
        </MFWrapperView>
    );
}
```

When the lower input is focused, `MFScrollView` scrolls it into the visible area above the keyboard.

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

`MFWrapperView` accounts for the header height automatically — no extra configuration needed.

### Tab Bar

```tsx
function TabScreen() {
    return (
        <MFWrapperView>
            <View style={{ flex: 1 }}>
                <Text>Tab content</Text>
            </View>
            <MFTextInput placeholder="Above tab bar, above keyboard when open" />
        </MFWrapperView>
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

Modals have different coordinate geometry — `MFWrapperView` handles this transparently.

## Disabling Keyboard Avoidance

For screens where you manage keyboard behavior yourself:

```tsx
<MFWrapperView noKeyboardAvoiding>
    {/* Keyboard avoidance disabled */}
</MFWrapperView>
```

Or on the scroll view:

```tsx
<MFScrollView noKeyboardAvoiding>
    {/* Auto-scroll disabled */}
</MFScrollView>
```

## Nested Contexts

The keyboard height system prevents double-counting when `MFWrapperView` and `MFScrollView` are nested. The inner component uses a `KeyboardHeightProvider` that reports the keyboard as already handled, so child components don't apply the offset twice.

## Safe Area Integration

Keyboard avoidance and safe area insets are coordinated. See [MFWrapperView](../components/wrapper-view) and [useMFSafeAreaInsets](../hooks/safe-area-insets) for details on how `safeArea` props interact with keyboard padding.
