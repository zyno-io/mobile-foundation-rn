# Helpers

Utility functions and MobX helpers.

## Formatting

### `formatPhone(input)`

Formats a 10-digit string as a US phone number. Non-10-digit input is returned unchanged.

```ts
import { formatPhone } from '@zyno-io/mobile-foundation-rn';

formatPhone('5551234567');     // "(555) 123-4567"
formatPhone('+15551234567');   // "(555) 123-4567" (strips +1)
formatPhone('555');            // "555" (not 10 digits — returned as-is)
formatPhone('');               // ""
formatPhone(undefined);        // ""
```

### `formatCurrency(input)`

Strips non-digits and adds a `$` prefix. Accepts `string | null`.

```ts
import { formatCurrency } from '@zyno-io/mobile-foundation-rn';

formatCurrency('12345');  // "$12345"
formatCurrency('0');      // "$0"
formatCurrency('');       // ""
formatCurrency(null);     // ""
```

### `formatDuration(seconds)`

Converts seconds to a human-readable duration using `Xh Ym Zs` format. Zero-value segments are omitted (except when the total is 0).

```ts
import { formatDuration } from '@zyno-io/mobile-foundation-rn';

formatDuration(45);    // "45s"
formatDuration(60);    // "1m"
formatDuration(3661);  // "1h 1m 1s"
formatDuration(7200);  // "2h"
```

## Observable Helpers

### `createObservableProxy(target, hooks?)`

Creates a MobX-observable proxy with optional custom getters and afterSet hooks:

```ts
import { createObservableProxy } from '@zyno-io/mobile-foundation-rn';

const state = createObservableProxy(
    { count: 0, name: '' },
    {
        count: {
            afterSet: () => console.log('Count changed'),
        },
    },
);

state.count = 5; // Triggers afterSet hook + MobX reactions
```

**Signature**: `createObservableProxy<T>(target: T, hooks?: Hooks<T>): T`

Hooks per property can define:
- `get?(target: T): value` — custom getter
- `afterSet?(): void` — called after property is set

New properties accessed on the proxy are automatically created as MobX observables.

### `LoaderState`

Global MobX observable used by `GlobalLoaderOverlay` and `useWaitTask`:

```ts
import { LoaderState } from '@zyno-io/mobile-foundation-rn';

LoaderState.loaderCount; // number of active loading tasks
```

## Async

### `memoizeAsync(fn)`

Caches the result of an async function. Clears cache on rejection:

```ts
import { memoizeAsync } from '@zyno-io/mobile-foundation-rn';

const loadConfig = memoizeAsync(async () => {
    const response = await fetch('/config');
    return response.json();
});

await loadConfig(); // Fetches
await loadConfig(); // Returns cached result
```

Only works with zero-argument async functions.

## Layout

### `hasHeightOrFlexProps(style)`

Checks if a style object contains explicit height or flex sizing properties (`height`, `flex`, `flexGrow`, `flexShrink`, `flexBasis`):

```ts
import { hasHeightOrFlexProps } from '@zyno-io/mobile-foundation-rn';

hasHeightOrFlexProps({ height: 100 });      // true
hasHeightOrFlexProps({ flex: 1 });           // true
hasHeightOrFlexProps({ padding: 10 });       // false
```

Takes a single `ViewStyle` object (not arrays).

## Storage

### `getCdnUrlForId(id)`

Constructs a CDN URL from an asset ID:

```ts
import { getCdnUrlForId } from '@zyno-io/mobile-foundation-rn';

getCdnUrlForId('abcdef123456');
// → "{CDN_URL}/ab/cd/ef/abcdef123456"
```

Uses `FoundationConfig.env.CDN_URL` as the base.

### `getUriForCacheItem(name)`

Returns the file URI for a cached item, or `null` if not cached:

```ts
import { getUriForCacheItem } from '@zyno-io/mobile-foundation-rn';

const uri = await getUriForCacheItem('profile-photo');
// → "file:///path/to/cache/profile-photo" or null
```

### `getCacheUriForBlob(name, blob)`

Writes a blob to the cache directory and returns its URI:

```ts
import { getCacheUriForBlob } from '@zyno-io/mobile-foundation-rn';

const uri = await getCacheUriForBlob('photo.jpg', imageBlob);
// → "file:///path/to/cache/photo.jpg"
```

## Active Text Input

These exports manage which text input is currently focused (used internally by `MFScrollView` for scroll-to-input):

```ts
import {
    MFActiveTextInputContext,
    setMFActiveTextInput,
    unsetMFActiveTextInput,
    useMFActiveTextInputContext,
} from '@zyno-io/mobile-foundation-rn';
```

- `MFActiveTextInputContext` — React context holding `{ input: TextInput | null }`
- `setMFActiveTextInput(ref)` — set the currently active input
- `unsetMFActiveTextInput(ref)` — clear the active input (only if it matches `ref`)
- `useMFActiveTextInputContext()` — hook to access the context

## Deep Linking

### `getLinkingUrl()`

Returns the current deep link URL, or `null`:

```ts
import { getLinkingUrl } from '@zyno-io/mobile-foundation-rn';

const url = getLinkingUrl();
```

Updated globally when the app receives a deep link via Expo Linking.
