# MfForm

Context provider that enables keyboard navigation between inputs. See the [Form Navigation guide](../guide/form-navigation) for a complete walkthrough.

## Usage

```tsx
import { MfForm, MfTextInput, MfTextArea } from '@zyno-io/mobile-foundation-rn';

<MfForm>
    <MfTextInput placeholder="First name" returnKeyType="next" />
    <MfTextInput placeholder="Last name" returnKeyType="next" />
    <MfTextInput placeholder="Email" returnKeyType="next" />
    <MfTextArea placeholder="Notes" returnKeyType="done" />
</MfForm>
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `children` | `ReactNode` | Form inputs and layout |

## MfFormContext

The context provided to children:

```ts
interface FormContextType {
    registerInput(ref: TextInput): void;
    unregisterInput(ref: TextInput): void;
    getNextInput(currentRef: TextInput): TextInput | null;
}
```

## useMfFormContext

Access the form context from custom components:

```ts
import { useMfFormContext } from '@zyno-io/mobile-foundation-rn';

const { registerInput, unregisterInput, getNextInput } = useMfFormContext();
```

Returns no-op functions when used outside a `<MfForm>`, so it's safe to call unconditionally.
