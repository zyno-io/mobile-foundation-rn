# MFTextInput

Themed text input with optional icon, label, and input masks. Integrates with `Form` for keyboard navigation.

## Usage

```tsx
import { MFTextInput } from '@zyno-io/mobile-foundation-rn';
import { faPhone } from '@fortawesome/free-solid-svg-icons';

// Basic
<MFTextInput placeholder="Name" />

// With label and icon
<MFTextInput
    label="Phone"
    placeholder="(555) 123-4567"
    mask="phone"
    icon={faPhone}
    returnKeyType="next"
/>

// Disabled
<MFTextInput placeholder="Read only" disabled value="Fixed value" />
```

## Props

Extends all standard React Native `TextInputProps`, plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mask` | `'phone' \| 'currency'` | — | Auto-format input text |
| `disabled` | `boolean` | `false` | Prevent editing and dim appearance |
| `icon` | `IconProp` | — | FontAwesome icon shown inside the input |
| `label` | `string` | — | Label text above the input |
| `wrapperStyle` | `ViewStyle` | — | Style for the outer wrapper |
| `inputWrapperStyle` | `ViewStyle` | — | Style for the input container |

## Input Masks

### Phone

Formats input as `(XXX) XXX-XXXX`:

```tsx
<MFTextInput mask="phone" placeholder="Phone number" />
```

Typing `5551234567` displays as `(555) 123-4567`. Strips the `+1` prefix if present.

### Currency

Adds a `$` prefix and strips non-digit characters:

```tsx
<MFTextInput mask="currency" placeholder="Amount" />
```

## Form Integration

Inside a `<Form>`, `MFTextInput` automatically:

- Registers its ref for position-based navigation ordering
- Calls `focusNext()` on submit when `returnKeyType` is `"next"`
- Blurs the input on submit when `returnKeyType` is `"done"`
- Tracks focus state in `MFActiveTextInputContext` for scroll-to-input

::: tip
You must set `returnKeyType="next"` or `returnKeyType="done"` on each input to control the keyboard button. The form does not auto-assign return key types.
:::

## Theming

Uses the following color scheme keys:

- `cardBackground` — input background color
- `inputText` — text color
- `inputPlaceholderText` — placeholder color
- `inputIcon` — icon color
- `fieldLabel` — label text color
