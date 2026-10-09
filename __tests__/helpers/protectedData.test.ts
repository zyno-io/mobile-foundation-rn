import { createMockConfig } from '../test-utils';
import { flushProtectedData, mockProtectedDataNative } from './protectedDataMock';

describe('protected-data policy', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        jest.useFakeTimers();
        require('../__mocks__/react-native').Platform.OS = 'ios';
        require('../__mocks__/react-native').AppState.currentState = 'background';
        require('../../src/config').configureFoundation(createMockConfig());
    });
    afterEach(() => jest.useRealTimers());

    const wrapper = () => require('../../src/helpers/protectedData').withProtectedDataRecovery;

    it('attempts successful locked reads without a native availability query or wait', async () => {
        const native = mockProtectedDataNative();
        const read = jest.fn().mockResolvedValue('saved');
        expect(await wrapper()(read)).toBe('saved');
        expect(native.getAvailabilityAsync).not.toHaveBeenCalled();
        expect(native.waitForAvailabilityAsync).not.toHaveBeenCalled();
    });

    it('strict policy waits before the first operation', async () => {
        require('../../src/config').getFoundationConfig().requireProtectedDataAvailability = true;
        let unlock!: () => void;
        const native = mockProtectedDataNative(jest.fn(() => new Promise<void>(resolve => { unlock = resolve; })));
        const read = jest.fn().mockResolvedValue('saved');
        const pending = wrapper()(read);
        expect(native.waitForAvailabilityAsync).toHaveBeenCalledTimes(1);
        expect(read).not.toHaveBeenCalled();
        unlock();
        expect(await pending).toBe('saved');
    });

    it('strict policy checks each new operation after a later lock', async () => {
        require('../../src/config').getFoundationConfig().requireProtectedDataAvailability = true;
        const native = mockProtectedDataNative();
        await wrapper()(() => Promise.resolve('first'));
        let unlock!: () => void;
        native.waitForAvailabilityAsync.mockImplementationOnce(() => new Promise<void>(resolve => { unlock = resolve; }));
        const read = jest.fn().mockResolvedValue('second');
        const pending = wrapper()(read);
        expect(read).not.toHaveBeenCalled();
        unlock();
        expect(await pending).toBe('second');
        expect(native.waitForAvailabilityAsync).toHaveBeenCalledTimes(2);
    });

    it.each([
        new Error('User interaction is not allowed.'),
        { code: '-25308' },
        { domain: 'NSCocoaErrorDomain', code: 257 },
        { domain: 'NSCocoaErrorDomain', code: 513 },
        { domain: 'NSPOSIXErrorDomain', code: 1 },
        new Error('Failed to read storage file.'),
        new Error('Permission to view manifest.json'),
        new Error('native wrapper', { cause: { code: '-25308' } }),
    ])('waits and retries a likely protection failure: %p', async error => {
        let unlock!: () => void;
        const native = mockProtectedDataNative(jest.fn(() => new Promise<void>(resolve => { unlock = resolve; })));
        const read = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('saved');
        const pending = wrapper()(read);
        await flushProtectedData();
        expect(read).toHaveBeenCalledTimes(1);
        expect(native.waitForAvailabilityAsync).toHaveBeenCalledTimes(1);
        unlock();
        expect(await pending).toBe('saved');
        expect(read).toHaveBeenCalledTimes(2);
    });

    it.each(['No space left on device', 'Invalid JSON', 'errSecMissingEntitlement', 'Authentication failed', 'Invalid encrypted payload'])('propagates unrelated failures without waiting: %s', async message => {
        const native = mockProtectedDataNative();
        const error = new Error(message);
        const read = jest.fn().mockRejectedValue(error);
        await expect(wrapper()(read)).rejects.toBe(error);
        expect(read).toHaveBeenCalledTimes(1);
        expect(native.getAvailabilityAsync).not.toHaveBeenCalled();
        expect(native.waitForAvailabilityAsync).not.toHaveBeenCalled();
    });

    it('retries once when unlock preceded the availability query', async () => {
        const native = mockProtectedDataNative();
        native.getAvailabilityAsync.mockResolvedValue(true);
        const read = jest.fn().mockRejectedValueOnce({ code: '-25308' }).mockResolvedValueOnce('saved');
        expect(await wrapper()(read)).toBe('saved');
        expect(read).toHaveBeenCalledTimes(2);
        expect(native.waitForAvailabilityAsync).toHaveBeenCalledTimes(1);
    });

    it('propagates persistent failure after one retry', async () => {
        const native = mockProtectedDataNative();
        const error = new Error('Operation not permitted');
        const read = jest.fn().mockRejectedValue(error);
        await expect(wrapper()(read)).rejects.toBe(error);
        expect(read).toHaveBeenCalledTimes(2);
        expect(native.waitForAvailabilityAsync).toHaveBeenCalledTimes(1);
    });

    it('handles a lock after strict preflight without looping', async () => {
        require('../../src/config').getFoundationConfig().requireProtectedDataAvailability = true;
        const native = mockProtectedDataNative();
        const read = jest.fn().mockRejectedValue(new Error('Operation not permitted'));
        await expect(wrapper()(read)).rejects.toThrow('Operation not permitted');
        expect(read).toHaveBeenCalledTimes(2);
        expect(native.waitForAvailabilityAsync).toHaveBeenCalledTimes(2);
    });

    it('does not retry if the native wait itself rejects without an error value', async () => {
        mockProtectedDataNative(jest.fn().mockRejectedValue(undefined));
        const read = jest.fn().mockRejectedValue(new Error('Operation not permitted'));
        await expect(wrapper()(read)).rejects.toBeUndefined();
        expect(read).toHaveBeenCalledTimes(1);
    });

    it('cancels only the aborted caller and consumes later native rejection', async () => {
        const waiters = new Map<string, { resolve: () => void; reject: (error: Error) => void }>();
        const native = mockProtectedDataNative(jest.fn((id: string) => new Promise<void>((resolve, reject) => { waiters.set(id, { resolve, reject }); })));
        native.cancelWaitAsync.mockImplementation((id: string) => { waiters.get(id)?.reject(new Error('native cancellation')); return Promise.resolve(); });
        const controller = new AbortController();
        const first = jest.fn().mockRejectedValueOnce({ code: '-25308' }).mockResolvedValueOnce('first');
        const second = jest.fn().mockRejectedValueOnce({ code: '-25308' }).mockResolvedValueOnce('second');
        const aborted = wrapper()(first, { signal: controller.signal });
        const pending = wrapper()(second);
        await flushProtectedData();
        const ids = [...waiters.keys()];
        controller.abort();
        await expect(aborted).rejects.toMatchObject({ name: 'AbortError' });
        // The second waiter remains usable after cancellation of the first.
        waiters.get(ids[1])!.resolve();
        expect(await pending).toBe('second');
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(2);
        expect(native.cancelWaitAsync).toHaveBeenCalledWith(ids[0]);
    });

    it('does not attempt an already aborted operation', async () => {
        const controller = new AbortController();
        controller.abort();
        const read = jest.fn();
        await expect(wrapper()(read, { signal: controller.signal })).rejects.toBe(controller.signal.reason);
        expect(read).not.toHaveBeenCalled();
    });

    it('older binaries retry on foreground without claiming native availability', async () => {
        const { AppState } = require('react-native');
        const read = jest.fn().mockRejectedValueOnce({ code: '-25308' }).mockResolvedValueOnce('saved');
        const pending = wrapper()(read);
        await flushProtectedData();
        expect(read).toHaveBeenCalledTimes(1);
        AppState.currentState = 'active';
        AppState.addEventListener.mock.calls.at(-1)[1]('active');
        expect(await pending).toBe('saved');
        const Sentry = require('@sentry/react-native');
        expect(Sentry.addBreadcrumb.mock.calls.at(-1)[0].data.nativeAvailable).toBeNull();
    });

    it('does not lose a foreground transition during fallback registration', async () => {
        const { AppState } = require('react-native');
        const remove = jest.fn();
        AppState.addEventListener.mockImplementation(() => { AppState.currentState = 'active'; return { remove }; });
        const read = jest.fn().mockRejectedValueOnce({ code: '-25308' }).mockResolvedValueOnce('saved');
        expect(await wrapper()(read)).toBe('saved');
        expect(remove).toHaveBeenCalledTimes(1);
    });

    it('cleans up an aborted foreground fallback', async () => {
        const { AppState } = require('react-native');
        const remove = jest.fn();
        AppState.addEventListener.mockReturnValue({ remove });
        const controller = new AbortController();
        const read = jest.fn().mockRejectedValue({ code: '-25308' });
        const pending = wrapper()(read, { signal: controller.signal });
        await flushProtectedData();
        controller.abort();
        await expect(pending).rejects.toBe(controller.signal.reason);
        expect(remove).toHaveBeenCalledTimes(1);
        expect(read).toHaveBeenCalledTimes(1);
    });

    it.each([null, { getAvailabilityAsync: jest.fn() }])('strict mode rejects missing native capability before reading: %p', async native => {
        require('expo').requireOptionalNativeModule.mockReturnValue(native);
        require('../../src/config').getFoundationConfig().requireProtectedDataAvailability = true;
        const read = jest.fn();
        await expect(wrapper()(read)).rejects.toThrow('requires a new iOS binary');
        expect(read).not.toHaveBeenCalled();
    });

    it('Android does not wait under the iOS strict policy', async () => {
        require('react-native').Platform.OS = 'android';
        require('../../src/config').getFoundationConfig().requireProtectedDataAvailability = true;
        const read = jest.fn().mockResolvedValue('saved');
        expect(await wrapper()(read)).toBe('saved');
        expect(require('expo').requireOptionalNativeModule).not.toHaveBeenCalled();
    });
});
