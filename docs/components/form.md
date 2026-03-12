# Form

Context provider that enables keyboard navigation between inputs. See the [Form Navigation guide](../guide/form-navigation) for a complete walkthrough.

## Usage

```tsx
import { Form, MFTextInput, MFTextArea } from '@zyno-io/mobile-foundation-rn';

<Form>
    <MFTextInput placeholder="First name" returnKeyType="next" />
    <MFTextInput placeholder="Last name" returnKeyType="next" />
    <MFTextInput placeholder="Email" returnKeyType="next" />
    <MFTextArea placeholder="Notes" returnKeyType="done" />
</Form>
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `children` | `ReactNode` | Form inputs and layout |

## FormContext

The context provided to children:

```ts
interface FormContextType {
    registerInput(ref: TextInput): void;
    unregisterInput(ref: TextInput): void;
    getNextInput(currentRef: TextInput): TextInput | null;
}
```

## useFormContext

Access the form context from custom components:

```ts
import { useFormContext } from '@zyno-io/mobile-foundation-rn';

const { registerInput, unregisterInput, getNextInput } = useFormContext();
```

Returns no-op functions when used outside a `<Form>`, so it's safe to call unconditionally.
