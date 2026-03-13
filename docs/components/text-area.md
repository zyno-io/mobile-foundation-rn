# MfTextArea

Multi-line text input with form integration. A simpler component than `MfTextInput` — it does not support labels, icons, or masks.

## Usage

```tsx
import { MfTextArea } from '@zyno-io/mobile-foundation-rn';

<MfTextArea placeholder="Write your notes here..." />
<MfTextArea placeholder="Description" disabled />
```

## Props

Extends standard React Native `TextInputProps`, plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `disabled` | `boolean` | `false` | Prevent editing |
| `style` | `ViewStyle` | — | Style for the text area |

Defaults changed from `TextInput`:

| Prop | Default |
|------|---------|
| `multiline` | `true` |
| `numberOfLines` | `2` |
| `height` | `120` |

## MfForm Integration

Inside a `<MfForm>`, `MfTextArea` registers its ref for keyboard navigation. Set `returnKeyType="next"` or `returnKeyType="done"` to control the keyboard button behavior.
