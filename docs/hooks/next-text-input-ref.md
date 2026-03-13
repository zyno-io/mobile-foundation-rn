# useNextTextInputRef

Integrates a text input with the parent `MfForm` context for automatic keyboard navigation.

## Usage

```tsx
import { useNextTextInputRef } from '@zyno-io/mobile-foundation-rn';

function CustomInput({ placeholder }: { placeholder: string }) {
    const { ref, focusNext } = useNextTextInputRef();

    return (
        <TextInput
            ref={ref}
            placeholder={placeholder}
            returnKeyType="next"
            onSubmitEditing={focusNext}
        />
    );
}
```

## Return Value

| Property | Type | Description |
|----------|------|-------------|
| `ref` | `RefObject<TextInput>` | Attach to your TextInput |
| `focusNext` | `() => void` | Focus the next input in form order, or blur if last |

## How It Works

1. On mount, measures the input's position on screen
2. Registers the input and its position with the parent `MfForm` context
3. `focusNext()` calls `MfForm.getNextInput()` which returns the next input sorted by position
4. On unmount, unregisters from the form

If used outside a `<MfForm>`, the hook is a no-op — `ref` still works as a normal ref, and `focusNext` blurs the input.

::: tip
You don't need this hook for `MfTextInput` or `MfTextArea` — they use it internally. This is for building custom input components that participate in form navigation.
:::
