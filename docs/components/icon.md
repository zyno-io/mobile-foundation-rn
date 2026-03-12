# MFIcon

FontAwesome icon wrapper that uses the current theme's text color.

## Usage

```tsx
import { MFIcon } from '@zyno-io/mobile-foundation-rn';
import { faHeart, faStar } from '@fortawesome/free-solid-svg-icons';

<MFIcon icon={faHeart} />
<MFIcon icon={faStar} size={24} color="#FFD700" />
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `IconProp` | — | FontAwesome icon definition |
| `size` | `number` | `16` | Icon size in points |
| `color` | `string` | Theme `text` color | Override color |
| `style` | `FontAwesomeIconStyle` | — | Additional styles |

## MFIconProps Type

```ts
import type { MFIconProps } from '@zyno-io/mobile-foundation-rn';
```

Exported for use in custom component props.
