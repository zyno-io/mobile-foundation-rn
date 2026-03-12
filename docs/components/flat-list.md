# MFFlatList

Keyboard-aware FlatList with safe area support. Drop-in replacement for React Native's `FlatList` with keyboard avoidance.

## Usage

```tsx
import { MFWrapperView, MFFlatList, MFText, MFTextInput } from '@zyno-io/mobile-foundation-rn';

function ChatScreen({ messages }) {
    return (
        <MFWrapperView>
            <MFFlatList
                data={messages}
                renderItem={({ item }) => <MFText>{item.text}</MFText>}
                inverted
                style={{ flex: 1 }}
            />
            <MFTextInput placeholder="Type a message" />
        </MFWrapperView>
    );
}
```

## Props

Extends all standard `FlatListProps<T>`, plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `safeArea` | `boolean \| Inset \| Inset[]` | `false` | Safe area insets to apply as content padding (top/bottom only) |
| `noKeyboardAvoiding` | `boolean` | `false` | Disable keyboard-aware behavior |
