# MFTextArea

Multi-line text input with form integration. A simpler component than `MFTextInput` — it does not support labels, icons, or masks.

## Usage

```tsx
import { MFTextArea } from '@zyno-io/mobile-foundation-rn';

<MFTextArea placeholder="Write your notes here..." />
<MFTextArea placeholder="Description" disabled />
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

## Form Integration

Inside a `<Form>`, `MFTextArea` registers its ref for keyboard navigation. Set `returnKeyType="next"` or `returnKeyType="done"` to control the keyboard button behavior.
