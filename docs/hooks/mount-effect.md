# useMountEffect

Convenience hook that runs an effect only on mount.

## Usage

```ts
import { useMountEffect } from '@zyno-io/mobile-foundation-rn';

function MyComponent() {
    useMountEffect(() => {
        analytics.trackScreenView('MyScreen');
    });

    // With async
    useMountEffect(async () => {
        await loadInitialData();
    });
}
```

## Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `callback` | `() => void \| Promise<void>` | — | Effect to run on mount |
| `deps` | `DependencyList` | `[]` | Dependency array (defaults to empty) |

Equivalent to `useEffect(callback, deps)` with `deps` defaulting to `[]`. If you pass custom dependencies, the effect re-runs when they change — it is not mount-only in that case.
