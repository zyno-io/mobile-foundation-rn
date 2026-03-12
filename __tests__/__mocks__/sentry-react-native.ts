export const init = jest.fn();
export const wrap = jest.fn((c: any) => c);
export const captureException = jest.fn();
export const setUser = jest.fn();
export const reactNavigationIntegration = jest.fn(() => ({
    registerNavigationContainer: jest.fn(),
}));
export const ReactNavigationInstrumentation = jest.fn(() => ({
    registerNavigationContainer: jest.fn(),
}));
export const ReactNativeTracing = jest.fn();
