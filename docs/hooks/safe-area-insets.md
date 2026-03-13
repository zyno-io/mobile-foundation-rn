# useMfSafeAreaInsets

Returns safe area insets filtered by which edges to apply.

## Usage

```ts
import { useMfSafeAreaInsets } from '@zyno-io/mobile-foundation-rn';

// All insets
const insets = useMfSafeAreaInsets(true);
// { top: 47, bottom: 34, left: 0, right: 0 }

// No insets
const insets = useMfSafeAreaInsets(false);
// { top: 0, bottom: 0, left: 0, right: 0 }

// Bottom only
const insets = useMfSafeAreaInsets('bottom');
// { top: 0, bottom: 34, left: 0, right: 0 }

// Specific edges
const insets = useMfSafeAreaInsets(['top', 'bottom']);
// { top: 47, bottom: 34, left: 0, right: 0 }
```

## Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `applyInsets` | `boolean \| Inset \| Inset[]` | — | Which edges to apply |

## Return Value

```ts
{ top: number; bottom: number; left: number; right: number }
```

All values are `0` for non-applied edges.

## Inset Type

```ts
type Inset = 'top' | 'bottom' | 'left' | 'right';
```

Exported from the library for use in your own component props.
