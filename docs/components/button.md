# MFButton

Themed pressable button with icon support and press feedback.

## Usage

```tsx
import { MFButton } from '@zyno-io/mobile-foundation-rn';
import { faSave, faArrowRight } from '@fortawesome/free-solid-svg-icons';

// Primary button
<MFButton text="Save" primary onPress={handleSave} />

// Secondary button (default)
<MFButton text="Cancel" onPress={handleCancel} />

// With icon
<MFButton text="Save" icon={faSave} primary onPress={handleSave} />

// Icon trailing
<MFButton text="Next" icon={faArrowRight} iconTrailing onPress={handleNext} />

// Disabled
<MFButton text="Submit" primary disabled />

// Custom children
<MFButton onPress={handlePress}>
    <View style={{ flexDirection: 'row' }}>
        <Text>Custom content</Text>
    </View>
</MFButton>
```

## Props

Extends all standard React Native `PressableProps`, plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | `string` | — | Button label text |
| `primary` | `boolean` | `false` | Use primary color scheme |
| `feedback` | `boolean` | `true` | Show opacity feedback on press |
| `disabled` | `boolean` | `false` | Disable press and reduce opacity |
| `icon` | `IconProp` | — | FontAwesome icon |
| `iconColor` | `string` | — | Override icon color |
| `iconSize` | `number` | — | Override icon size |
| `iconTrailing` | `boolean` | `false` | Place icon after text |
| `iconStyle` | `FontAwesomeIconStyle` | — | Additional icon styles |
| `children` | `ReactNode` | — | Custom content (overrides `text`) |

## Theming

| Variant | Background | Text |
|---------|-----------|------|
| Primary | `primaryButtonBackground` | `primaryButtonText` |
| Secondary | `secondaryButtonBackground` | `secondaryButtonText` |
