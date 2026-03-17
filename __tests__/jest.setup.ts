// ============================================================
// Global test setup
// ============================================================
// All module mocks are handled via moduleNameMapper in jest.config.ts
// pointing to files in __tests__/__mocks__/. This approach survives
// jest.resetModules() unlike jest.mock() with { virtual: true }.

// configureFoundation() uses setImmediate to defer Sentry/AppStateTracker init.
// We no-op setImmediate so these side effects don't fire during tests.
global.setImmediate = ((fn: Function, ...args: any[]) => {
    return { ref: () => {}, unref: () => {}, hasRef: () => false, _onImmediate: fn } as any;
}) as any;

// Suppress React act() environment warning
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Suppress react-test-renderer deprecation warning (React 19+).
// RTLRN still requires react-test-renderer internally; once RTLRN drops
// that dependency, remove react-test-renderer and this suppression.
const _origError = console.error;
console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('react-test-renderer is deprecated')) return;
    _origError.apply(console, args);
};
