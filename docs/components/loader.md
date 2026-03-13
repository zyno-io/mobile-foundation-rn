# MfLoader

Spinning loader animation using the configured spinner icon.

## MfLoader

```tsx
import { MfLoader } from '@zyno-io/mobile-foundation-rn';

<MfLoader />
<MfLoader size={32} color="#FF0000" />
<MfLoader background />
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `color` | `string` | `primaryButtonBackground` | Spinner color |
| `size` | `number` | `64` | Spinner size |
| `background` | `boolean` | `false` | Show semi-transparent background circle |

## MfLoaderView

Loader centered in a flex container:

```tsx
import { MfLoaderView } from '@zyno-io/mobile-foundation-rn';

<MfLoaderView />
```

### Props

Extends `ViewProps` plus `color` and `size` from `MfLoader`.

## MfLoaderOverlay

Manual overlay with a loader:

```tsx
import { MfLoaderOverlay } from '@zyno-io/mobile-foundation-rn';

{isLoading && <MfLoaderOverlay />}
{isLoading && <MfLoaderOverlay solo />}  // With dark background
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `solo` | `boolean` | `false` | Add dark overlay background |

## GlobalLoaderOverlay

Automatic overlay controlled by `LoaderState.loaderCount`. Rendered by `MfProvider` — you don't need to place this manually.

Shows when any `useWaitTask` is in progress. See [useWaitTask](../hooks/wait-task).

## LoaderState

MobX observable controlling the global loader:

```ts
import { LoaderState } from '@zyno-io/mobile-foundation-rn';

// Manually control (prefer useWaitTask instead)
LoaderState.loaderCount++;
// ... do work ...
LoaderState.loaderCount--;
```
