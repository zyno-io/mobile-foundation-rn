# SentryHelper

Wrapper around `@sentry/react-native` with foundation-specific configuration.

## Usage

Sentry is initialized automatically by `configureFoundation` (via `setImmediate`). You typically don't need to interact with `SentryHelper` directly.

## API

### `SentryHelper.init()`

Called automatically during `configureFoundation`. Initializes Sentry with:

- DSN from `FoundationConfig.env.SENTRY_DSN`
- TTID (Time To Initial Display) tracking enabled
- User ID set from `AppMeta.deviceIdEnv`

### `SentryHelper.useNavigationInstrumentation()`

Hook to instrument React Navigation for Sentry performance monitoring:

```tsx
import { SentryHelper } from '@zyno-io/mobile-foundation-rn';

function AppContent() {
    SentryHelper.useNavigationInstrumentation();
    return <NavigationContainer>{/* ... */}</NavigationContainer>;
}
```

### `SentryHelper.wrap`

Sentry's HOC wrapper for the root component:

```tsx
import { SentryHelper } from '@zyno-io/mobile-foundation-rn';

export default SentryHelper.wrap(App);
```

::: tip
`FoundationProvider` already wraps the app with Sentry's error boundary. You typically only need `SentryHelper.wrap` if you're not using `FoundationProvider`.
:::
