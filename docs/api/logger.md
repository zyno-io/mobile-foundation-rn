# Logger

Namespaced logging with Sentry integration and user-facing error alerts.

## Creating a Logger

```ts
import { createLogger } from '@zyno-io/mobile-foundation-rn';

const logger = createLogger('payments');
```

## Logger Interface

```ts
interface Logger {
    info(...args: any[]): void;
    error(...args: any[]): void;
    warn(...args: any[]): void;
    debug(...args: any[]): void;
    interactiveError(err: any, alertOpts?: AlertOptions): Promise<void>;
}
```

### `info` / `warn` / `debug`

Standard log levels. In development, output is prefixed with the namespace and platform.

### `error`

Logs an error. If the argument is an `Error` instance, it's automatically captured by Sentry.

```ts
logger.error('Payment failed', error);
// → Captured in Sentry + logged to console
```

### `interactiveError`

Shows an alert dialog to the user based on the error type:

```ts
try {
    await chargeCard();
} catch (err) {
    await logger.interactiveError(err);
}
```

See [Error Handling guide](../guide/error-handling) for the full behavior matrix.

## UserError

```ts
import { UserError } from '@zyno-io/mobile-foundation-rn';

throw new UserError('Please enter a valid email address.');
```

`UserError` messages are shown directly in alert dialogs. They are not sent to Sentry.

## Utility Functions

### `showAlertDialog`

```ts
import { showAlertDialog } from '@zyno-io/mobile-foundation-rn';

await showAlertDialog('Saved', 'Your changes have been saved.');
```

Returns a `Promise` that resolves when the user dismisses the alert.

### `showCommunicationError`

```ts
import { showCommunicationError } from '@zyno-io/mobile-foundation-rn';

showCommunicationError();
```

Shows a standard "communication error" alert. Only shows when the app is in the active state (not backgrounded).
