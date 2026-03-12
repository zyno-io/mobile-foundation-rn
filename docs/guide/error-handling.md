# Error Handling

The foundation provides a structured error handling system that distinguishes between user-facing errors and unexpected errors, with Sentry integration for crash reporting.

## Logger

Create namespaced loggers for different parts of your app:

```ts
import { createLogger } from '@zyno-io/mobile-foundation-rn';

const logger = createLogger('payments');

logger.info('Payment initiated', { amount: 100 });
logger.warn('Retrying payment');
logger.error('Payment failed', error);
```

In development, logs are prefixed with the namespace and platform. `Error` objects are automatically captured by Sentry.

## Interactive Errors

`logger.interactiveError()` displays an alert to the user and optionally reports to Sentry:

```ts
try {
    await submitPayment();
} catch (err) {
    await logger.interactiveError(err);
}
```

The behavior depends on the error type:

| Error Type | Alert Shown | Sentry Report |
|-----------|-------------|---------------|
| `UserError` | Shows error message directly | No |
| Custom class in `userErrorClasses` | Shows error message directly | No |
| Network error | "Communication error" dialog | No |
| Any other `Error` | Generic error with support contact | Yes |

## UserError

Throw `UserError` for expected validation or business logic errors that should be shown to the user:

```ts
import { UserError } from '@zyno-io/mobile-foundation-rn';

async function validateAge(age: number) {
    if (age < 18) {
        throw new UserError('You must be 18 or older to continue.');
    }
}
```

The message is shown directly in an alert — no stack trace, no Sentry report.

## Custom Error Classes

Register custom error classes to be treated like `UserError`:

```ts
class InsufficientFundsError extends Error {
    constructor(balance: number) {
        super(`Insufficient funds. Current balance: $${balance}`);
    }
}

configureFoundation({
    // ...
    userErrorClasses: [InsufficientFundsError],
});
```

## Support Contact

When `supportContact` is configured, unexpected error alerts include the contact string:

```ts
configureFoundation({
    // ...
    supportContact: 'support@example.com',
});
```

The string is interpolated directly into the alert message.

## useWaitTask

Combines error handling with a loading indicator. Wraps an async function to show the global loader overlay and handle errors:

```ts
import { useWaitTask } from '@zyno-io/mobile-foundation-rn';

function MyComponent() {
    const submitForm = useWaitTask(async (data: FormData) => {
        await api.submit(data);
    });

    return <MFButton text="Submit" onPress={() => submitForm(formData)} />;
}
```

While the task runs, `GlobalLoaderOverlay` shows a spinner. If the task throws, `interactiveError` handles it. See [useWaitTask](../hooks/wait-task) for details.

## Alert Helpers

For manual alert dialogs:

```ts
import { showAlertDialog, showCommunicationError } from '@zyno-io/mobile-foundation-rn';

// Show a custom alert (returns a Promise that resolves when dismissed)
await showAlertDialog('Success', 'Your changes have been saved.');

// Show the standard network error alert (only fires when app is active)
showCommunicationError();
```
