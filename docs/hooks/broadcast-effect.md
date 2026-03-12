# Broadcast / useBroadcastEffect

Global event emitter for app-wide communication between components.

## Broadcast

```ts
import { Broadcast } from '@zyno-io/mobile-foundation-rn';

// Emit an event
Broadcast.emit('cart:updated', { itemCount: 3 });

// Listen (manual cleanup)
const handler = (data) => console.log(data);
Broadcast.on('cart:updated', handler);
Broadcast.removeListener('cart:updated', handler);
```

`Broadcast` is an instance of Node's `EventEmitter`.

## useBroadcastEffect

Hook version with automatic cleanup on unmount:

```ts
import { useBroadcastEffect } from '@zyno-io/mobile-foundation-rn';

function CartBadge() {
    const [count, setCount] = useState(0);

    useBroadcastEffect('cart:updated', (data: { itemCount: number }) => {
        setCount(data.itemCount);
    });

    return <Text>{count}</Text>;
}
```

## Parameters

| Param | Type | Description |
|-------|------|-------------|
| `event` | `string` | Event name to listen for |
| `fn` | `(data: T) => void` | Handler called when event fires |

The listener is automatically removed when the component unmounts.
