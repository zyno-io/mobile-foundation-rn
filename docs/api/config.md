# configureFoundation

See the [Configuration guide](../guide/configuration) for the full reference.

## Quick Reference

```ts
import { configureFoundation } from '@zyno-io/mobile-foundation-rn';
import type { FoundationConfig, ColorScheme, CreateColorScheme } from '@zyno-io/mobile-foundation-rn';
```

| Export | Type | Description |
|--------|------|-------------|
| `configureFoundation` | `(config: FoundationConfig) => void` | Initialize the library |
| `FoundationConfig` | type | Configuration interface |
| `ColorScheme` | type | Color scheme key-value map |
| `CreateColorScheme<T>` | type | Helper to extend ColorScheme with custom key names (T is a string union) |

::: info
`getFoundationConfig()` is available as an internal import from `./config` but is not re-exported from the library's public API.
:::

## Side Effects

`configureFoundation` also:

1. Configures MobX (`enforceActions: 'never'`)
2. Schedules `SentryHelper.init()` via `setImmediate`
3. Starts `AppStateTracker` (logs app lifecycle events)
