# MfFlatList

Keyboard-aware FlatList with safe area support. Drop-in replacement for React Native's `FlatList` with keyboard avoidance.

## Usage

```tsx
import { MfWrapperView, MfFlatList, MfText, MfTextInput } from '@zyno-io/mobile-foundation-rn';

function ChatScreen({ messages }) {
    return (
        <MfWrapperView>
            <MfFlatList
                data={messages}
                renderItem={({ item }) => <MfText>{item.text}</MfText>}
                inverted
                style={{ flex: 1 }}
            />
            <MfTextInput placeholder="Type a message" />
        </MfWrapperView>
    );
}
```

## Props

Extends all standard `FlatListProps<T>`, plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `safeArea` | `boolean \| Inset \| Inset[]` | `false` | Safe area insets to apply as content padding (top/bottom only) |
| `noKeyboardAvoiding` | `boolean` | `false` | Disable keyboard-aware behavior |
