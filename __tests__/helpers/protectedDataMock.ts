export function mockProtectedDataNative(wait = jest.fn().mockResolvedValue(undefined)) {
    const native = {
        getAvailabilityAsync: jest.fn().mockResolvedValue(false),
        waitForAvailabilityAsync: wait,
        cancelWaitAsync: jest.fn().mockResolvedValue(undefined),
    };
    require('expo').requireOptionalNativeModule.mockReturnValue(native);
    return native;
}

export async function flushProtectedData() {
    for (let i = 0; i < 8; i++) await Promise.resolve();
}
