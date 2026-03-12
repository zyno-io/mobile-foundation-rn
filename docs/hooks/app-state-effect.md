# useAppStateEffect

React to app foreground/background state changes.

## useAppStateEffect

Fires on every app state change (after the initial launch):

```ts
import { useAppStateEffect } from '@zyno-io/mobile-foundation-rn';

useAppStateEffect((state) => {
    console.log('App state changed to:', state); // 'active' | 'background' | 'inactive'
});
```

The callback does **not** fire on the initial mount — only on subsequent state changes.

## useAppActivatedEffect

Fires only when the app comes to the foreground:

```ts
import { useAppActivatedEffect } from '@zyno-io/mobile-foundation-rn';

useAppActivatedEffect(() => {
    refreshData();
});
```

## useAppDeactivatedEvent

Fires only when the app goes to the background:

```ts
import { useAppDeactivatedEvent } from '@zyno-io/mobile-foundation-rn';

useAppDeactivatedEvent(() => {
    saveProgress();
});
```

## Cleanup

All three hooks automatically remove their listeners on unmount.
