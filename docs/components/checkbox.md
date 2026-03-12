# MFCheckbox

Checkbox with optional label and nested content. Uses theme colors for the surface and text, with hardcoded black/white for the checkbox indicator itself.

## Usage

```tsx
import { MFCheckbox } from '@zyno-io/mobile-foundation-rn';

const [checked, setChecked] = useState(false);

// Basic
<MFCheckbox value={checked} onPress={() => setChecked(!checked)} label="I agree to the terms" />

// With nested content
<MFCheckbox value={checked} onPress={() => setChecked(!checked)} label="Enable notifications">
    <MFText>You'll receive push notifications for new messages.</MFText>
</MFCheckbox>

// Disabled
<MFCheckbox value={true} disabled label="Required" />
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `boolean` | `false` | Checked state |
| `onPress` | `() => void` | — | Toggle handler |
| `disabled` | `boolean` | `false` | Disable interaction |
| `icon` | `IconProp` | Config `check` icon | Custom check icon |
| `label` | `string` | — | Label text beside the checkbox |
| `wrapperStyle` | `ViewStyle` | — | Style for the outer container |
| `unstyled` | `boolean` | `false` | Remove default wrapper styling (padding, border) |
| `children` | `ReactNode` | — | Content rendered below, indented under the label |

## Theming

- `colors.surface` — checkbox background
- `colors.text` — label text color
- Checkbox indicator uses hardcoded black/white for the border and check icon
