# Form Navigation

The `MfForm` component and `useNextTextInputRef` hook enable Next/Done keyboard navigation through form fields.

## How It Works

1. Wrap inputs in a `<MfForm>` component
2. Each `MfTextInput` / `MfTextArea` inside the form automatically registers its ref with the form context
3. The form sorts inputs by Y position (top-to-bottom), then X position (left-to-right) for inputs on the same row
4. Set `returnKeyType="next"` on each input (or `"done"` on the last one) — pressing the key moves focus to the next input in order

::: tip
The form handles input ordering and focus management, but you must explicitly set `returnKeyType` on each input to control the keyboard button label.
:::

## Basic Example

```tsx
import { MfWrapperView, MfScrollView, MfForm, MfTextInput, MfTextArea } from '@zyno-io/mobile-foundation-rn';

function ProfileForm() {
    return (
        <MfWrapperView>
            <MfScrollView>
                <MfForm>
                    <MfTextInput placeholder="First name" returnKeyType="next" />
                    <MfTextInput placeholder="Last name" returnKeyType="next" />
                    <MfTextInput placeholder="Email" returnKeyType="next" />
                    <MfTextInput placeholder="Phone" mask="phone" returnKeyType="next" />
                    <MfTextArea placeholder="Bio" returnKeyType="done" />
                </MfForm>
            </MfScrollView>
        </MfWrapperView>
    );
}
```

Pressing Next cycles through: First name -> Last name -> Email -> Phone -> Bio. The Bio field shows "Done" which dismisses the keyboard.

## Side-by-Side Inputs

Inputs on the same horizontal row (Y positions within 10px of each other) are sorted left-to-right:

```tsx
<MfForm>
    <MfTextInput placeholder="First name" returnKeyType="next" />
    <MfTextInput placeholder="Last name" returnKeyType="next" />
    <View style={{ flexDirection: 'row' }}>
        <MfTextInput placeholder="City" style={{ flex: 1 }} returnKeyType="next" />
        <MfTextInput placeholder="State" style={{ width: 80 }} returnKeyType="next" />
    </View>
    <MfTextInput placeholder="ZIP" returnKeyType="done" />
</MfForm>
```

Navigation order: First name -> Last name -> City -> State -> ZIP.

## Scroll-to-Focus

When combined with `MfScrollView`, focused inputs are automatically scrolled into view. As the user presses Next through a long form, each field scrolls into the visible area above the keyboard.

## Custom Input Integration

If you build custom input components, use `useNextTextInputRef` to integrate with the form:

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

`useNextTextInputRef` handles:
- Registering the input ref with the parent `MfForm` context
- Providing `focusNext()` which focuses the next input or blurs if last

## MfFormContext API

For advanced use cases, access the form context directly:

```ts
import { useMfFormContext } from '@zyno-io/mobile-foundation-rn';

const { registerInput, unregisterInput, getNextInput } = useMfFormContext();
```

- `registerInput(ref: TextInput)` — register a text input with the form
- `unregisterInput(ref: TextInput)` — remove an input from the form
- `getNextInput(currentRef: TextInput)` — returns the next `TextInput` in position order, or `null`

If `useMfFormContext` is called outside a `<MfForm>`, it returns no-op functions that won't crash.
