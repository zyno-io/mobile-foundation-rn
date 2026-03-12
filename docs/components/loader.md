# MFLoader

Spinning loader animation using the configured spinner icon.

## MFLoader

```tsx
import { MFLoader } from '@zyno-io/mobile-foundation-rn';

<MFLoader />
<MFLoader size={32} color="#FF0000" />
<MFLoader background />
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `color` | `string` | `primaryButtonBackground` | Spinner color |
| `size` | `number` | `64` | Spinner size |
| `background` | `boolean` | `false` | Show semi-transparent background circle |

## MFLoaderView

Loader centered in a flex container:

```tsx
import { MFLoaderView } from '@zyno-io/mobile-foundation-rn';

<MFLoaderView />
```

### Props

Extends `ViewProps` plus `color` and `size` from `MFLoader`.

## MFLoaderOverlay

Manual overlay with a loader:

```tsx
import { MFLoaderOverlay } from '@zyno-io/mobile-foundation-rn';

{isLoading && <MFLoaderOverlay />}
{isLoading && <MFLoaderOverlay solo />}  // With dark background
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `solo` | `boolean` | `false` | Add dark overlay background |

## GlobalLoaderOverlay

Automatic overlay controlled by `LoaderState.loaderCount`. Rendered by `FoundationProvider` — you don't need to place this manually.

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
