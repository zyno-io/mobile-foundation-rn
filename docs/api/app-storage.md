# AppStorage

MobX-observable persistent storage backed by AsyncStorage. Properties are automatically persisted when changed.

## Usage

```ts
import { createAppStorage } from '@zyno-io/mobile-foundation-rn';

// Define your storage shape with defaults
const storage = createAppStorage({
    token: undefined as string | undefined,
    onboardingComplete: false,
    preferredTheme: 'system' as 'light' | 'dark' | 'system',
});

export default storage;
```

```tsx
// In components — MobX observer reacts to changes
import { observer } from 'mobx-react-lite';
import storage from './storage';

const ProfileScreen = observer(() => {
    return <MFText>Theme: {storage.preferredTheme}</MFText>;
});

// Set a value — auto-persisted
storage.preferredTheme = 'dark';
```

::: warning IMPORTANT
You must call `createAppStorage()` before `useSetupFoundation()` runs, because the setup hook calls `$load()` on the storage instance internally.
:::

## `createAppStorage<T>(defaults?)`

Creates and returns a storage instance.

### Parameters

| Param | Type | Description |
|-------|------|-------------|
| `defaults` | `Partial<T>` | Default values for storage properties |

### Return Value

Returns `T & AppStorageMethods` — your typed properties plus the control methods.

## AppStorageMethods

### `$load()`

```ts
await storage.$load();
```

Loads persisted values from AsyncStorage. Called automatically by `useSetupFoundation`.

Memoized — subsequent calls return immediately.

### `$persist()`

```ts
storage.$persist();
```

Manually trigger a persist. Normally not needed — setting any property triggers auto-persist with a 250ms debounce.

### `$clear()`

```ts
storage.$clear();
```

Sets all properties to `undefined` and persists the cleared state.

## Auto-Persistence

When you set a property on the storage object, it:

1. Updates the MobX observable (triggering observer re-renders)
2. Schedules a debounced persist (250ms) to AsyncStorage

Multiple rapid changes result in a single AsyncStorage write.

## Dynamic Properties

Accessing a property that wasn't in the initial defaults auto-creates it as a MobX observable:

```ts
const storage = createAppStorage({ name: '' });

// This creates 'age' as a new observable property
storage.age = 25;
```
