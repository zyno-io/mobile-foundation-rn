# Form Navigation

The `Form` component and `useNextTextInputRef` hook enable Next/Done keyboard navigation through form fields.

## How It Works

1. Wrap inputs in a `<Form>` component
2. Each `MFTextInput` / `MFTextArea` inside the form automatically registers its ref with the form context
3. The form sorts inputs by Y position (top-to-bottom), then X position (left-to-right) for inputs on the same row
4. Set `returnKeyType="next"` on each input (or `"done"` on the last one) — pressing the key moves focus to the next input in order

::: tip
The form handles input ordering and focus management, but you must explicitly set `returnKeyType` on each input to control the keyboard button label.
:::

## Basic Example

```tsx
import { MFWrapperView, MFScrollView, Form, MFTextInput, MFTextArea } from '@zyno-io/mobile-foundation-rn';

function ProfileForm() {
    return (
        <MFWrapperView>
            <MFScrollView>
                <Form>
                    <MFTextInput placeholder="First name" returnKeyType="next" />
                    <MFTextInput placeholder="Last name" returnKeyType="next" />
                    <MFTextInput placeholder="Email" returnKeyType="next" />
                    <MFTextInput placeholder="Phone" mask="phone" returnKeyType="next" />
                    <MFTextArea placeholder="Bio" returnKeyType="done" />
                </Form>
            </MFScrollView>
        </MFWrapperView>
    );
}
```

Pressing Next cycles through: First name -> Last name -> Email -> Phone -> Bio. The Bio field shows "Done" which dismisses the keyboard.

## Side-by-Side Inputs

Inputs on the same horizontal row (Y positions within 10px of each other) are sorted left-to-right:

```tsx
<Form>
    <MFTextInput placeholder="First name" returnKeyType="next" />
    <MFTextInput placeholder="Last name" returnKeyType="next" />
    <View style={{ flexDirection: 'row' }}>
        <MFTextInput placeholder="City" style={{ flex: 1 }} returnKeyType="next" />
        <MFTextInput placeholder="State" style={{ width: 80 }} returnKeyType="next" />
    </View>
    <MFTextInput placeholder="ZIP" returnKeyType="done" />
</Form>
```

Navigation order: First name -> Last name -> City -> State -> ZIP.

## Scroll-to-Focus

When combined with `MFScrollView`, focused inputs are automatically scrolled into view. As the user presses Next through a long form, each field scrolls into the visible area above the keyboard.

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
- Registering the input ref with the parent `Form` context
- Providing `focusNext()` which focuses the next input or blurs if last

## FormContext API

For advanced use cases, access the form context directly:

```ts
import { useFormContext } from '@zyno-io/mobile-foundation-rn';

const { registerInput, unregisterInput, getNextInput } = useFormContext();
```

- `registerInput(ref: TextInput)` — register a text input with the form
- `unregisterInput(ref: TextInput)` — remove an input from the form
- `getNextInput(currentRef: TextInput)` — returns the next `TextInput` in position order, or `null`

If `useFormContext` is called outside a `<Form>`, it returns no-op functions that won't crash.
