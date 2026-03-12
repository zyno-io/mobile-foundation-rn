# useNavigationFocusEffect

Run effects when a screen gains or loses focus in React Navigation.

## useNavigationFocusEffect

```ts
import { useNavigationFocusEffect } from '@zyno-io/mobile-foundation-rn';

useNavigationFocusEffect(() => {
    loadScreenData();
}, []);
```

Fires when the screen comes into focus (navigated to or returned to via back).

## useNavigationUnfocusEffect

```ts
import { useNavigationUnfocusEffect } from '@zyno-io/mobile-foundation-rn';

useNavigationUnfocusEffect(() => {
    pauseVideo();
}, []);
```

Fires when the screen loses focus (navigated away from).

## Parameters

| Param | Type | Description |
|-------|------|-------------|
| `callback` | `() => void` | Effect to run |
| `deps` | `any[]` | Dependency array |
