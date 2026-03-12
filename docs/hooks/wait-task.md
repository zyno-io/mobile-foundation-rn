# useWaitTask

Wraps an async function to show the global loader overlay while it runs and handle errors via `interactiveError`.

## Usage

```tsx
import { useWaitTask } from '@zyno-io/mobile-foundation-rn';

function MyComponent() {
    const submitForm = useWaitTask(async (data: FormData) => {
        const result = await api.submit(data);
        return result;
    });

    return <MFButton text="Submit" onPress={() => submitForm(formData)} />;
}
```

## With Custom Logger

```tsx
import { useWaitTask, createLogger } from '@zyno-io/mobile-foundation-rn';

const logger = createLogger('checkout');

function CheckoutScreen() {
    const processPayment = useWaitTask(logger, async (amount: number) => {
        await paymentApi.charge(amount);
    });

    return <MFButton text="Pay" primary onPress={() => processPayment(99)} />;
}
```

## Overloads

```ts
useWaitTask(fn: (...args) => Promise<R>): (...args) => Promise<R | undefined>
useWaitTask(logger: Logger, fn: (...args) => Promise<R>): (...args) => Promise<R | undefined>
```

## Behavior

1. Increments `LoaderState.loaderCount` (shows `GlobalLoaderOverlay`)
2. Calls the wrapped async function
3. Decrements `LoaderState.loaderCount` (hides overlay when all tasks complete)
4. On success: returns the result
5. On error: calls `logger.interactiveError(err)` and returns `undefined`

Multiple concurrent `useWaitTask` calls stack — the overlay stays visible until all complete.
