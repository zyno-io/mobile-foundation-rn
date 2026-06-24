import { createMockConfig } from '../test-utils';

// Full env (createMockConfig's `...overrides` clobbers the nested env merge, so pass everything).
const MUS_ENV = {
    APP_ENV: 'test',
    BUILD_VERSION: '1.0.0-test',
    CDN_URL: 'https://cdn.test',
    MUS_URL: 'https://mus.test',
    MUS_APP_ID: 'app-1',
    MUS_CHANNEL: 'chan-1'
};

// device-info mock reports getVersion '1.2.3' -> AppMeta.baseAppVersion '1.2.3'
const baseStatus = {
    platform: 'ios' as const,
    channelName: 'chan-1',
    nativeUpdateRequiredAt: '',
    nativeUpdateRequired: false,
    latestStoreVersion: '2.0.0',
    latestStoreVersionDetectedAt: '2024-01-01T00:00:00Z',
    storeUrl: 'https://store.test/app'
};

function setup(env: Record<string, string> = MUS_ENV) {
    jest.resetModules();
    jest.clearAllMocks();

    const Updates = require('expo-updates');
    const { Alert, Linking } = require('react-native');
    require('../../src/config').configureFoundation(createMockConfig({ env }));

    const { Updater } = require('../../src/services/Updater');
    const { AppMeta } = require('../../src/services/AppMeta');
    const { LoaderState } = require('../../src/helpers/observable');
    return { Updates, Alert, Linking, Updater, AppMeta, LoaderState };
}

function mockFetch(body: unknown, ok = true) {
    global.fetch = jest.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(body) })) as unknown as typeof fetch;
}

describe('Updater', () => {
    afterEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (global as any).fetch;
    });

    describe('OTA deferral', () => {
        it('shouldDeferUpdate is false with no listener', () => {
            const { Updater } = setup();
            expect(Updater.shouldDeferUpdate()).toBe(false);
        });

        it('shouldDeferUpdate reflects the registered listener', () => {
            const { Updater } = setup();
            Updater.setUpdateDeferralListener(() => true);
            expect(Updater.shouldDeferUpdate()).toBe(true);
            Updater.setUpdateDeferralListener(() => false);
            expect(Updater.shouldDeferUpdate()).toBe(false);
            Updater.setUpdateDeferralListener(null);
            expect(Updater.shouldDeferUpdate()).toBe(false);
        });
    });

    describe('MUS request-header identity', () => {
        it('applies channel, device, and user headers', async () => {
            const { Updater, Updates, AppMeta } = setup();
            await AppMeta.load();
            Updater.setUserIdProvider(() => 'user-42');
            Updater._applyRequestHeaders();
            expect(Updates.setUpdateRequestHeadersOverride).toHaveBeenCalledWith({
                'expo-channel-name': 'chan-1',
                'mus-device-id': 'unique-id-123',
                'mus-user-id': 'user-42'
            });
        });

        it('defaults mus-user-id to "none" without a provider', async () => {
            const { Updater, Updates, AppMeta } = setup();
            await AppMeta.load();
            Updater._applyRequestHeaders();
            expect(Updates.setUpdateRequestHeadersOverride).toHaveBeenCalledWith(expect.objectContaining({ 'mus-user-id': 'none' }));
        });

        it('treats an undefined provider result as "none"', async () => {
            const { Updater, Updates, AppMeta } = setup();
            await AppMeta.load();
            Updater.setUserIdProvider(() => undefined);
            Updater._applyRequestHeaders();
            expect(Updates.setUpdateRequestHeadersOverride).toHaveBeenCalledWith(expect.objectContaining({ 'mus-user-id': 'none' }));
        });

        it('does not start header sync without a MUS channel', () => {
            const { Updater, Updates } = setup({ APP_ENV: 'test' }); // no MUS_CHANNEL
            Updater.setUserIdProvider(() => 'user-42');
            expect(Updates.setUpdateRequestHeadersOverride).not.toHaveBeenCalled();
        });
    });

    describe('native update status', () => {
        it('hasNativeUpdate is true when the store version is newer', async () => {
            const { Updater } = setup();
            mockFetch({ ...baseStatus, latestStoreVersion: '2.0.0' });
            await Updater._fetchNativeStatus();
            expect(Updater.hasNativeUpdate).toBe(true);
        });

        it('hasNativeUpdate is false when the store version is not newer', async () => {
            const { Updater } = setup();
            mockFetch({ ...baseStatus, latestStoreVersion: '1.2.3' });
            await Updater._fetchNativeStatus();
            expect(Updater.hasNativeUpdate).toBe(false);
        });

        it('isNativeUpdateRequired reflects the manifest flag', async () => {
            const { Updater } = setup();
            mockFetch({ ...baseStatus, nativeUpdateRequired: true });
            await Updater._fetchNativeStatus();
            expect(Updater.isNativeUpdateRequired).toBe(true);
        });

        it('nativeDeadlineText says required when required now', async () => {
            const { Updater } = setup();
            mockFetch({ ...baseStatus, nativeUpdateRequired: true });
            await Updater._fetchNativeStatus();
            expect(Updater.nativeDeadlineText).toBe('An update is required to continue.');
        });

        it('nativeDeadlineText counts days until a future deadline', async () => {
            const { Updater } = setup();
            const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
            mockFetch({ ...baseStatus, nativeUpdateRequired: false, nativeUpdateRequiredAt: future });
            await Updater._fetchNativeStatus();
            expect(Updater.nativeDeadlineText).toMatch(/stop working in \d+ days?\./);
        });

        it('nativeDeadlineText is null with no deadline and not required', async () => {
            const { Updater } = setup();
            mockFetch({ ...baseStatus, nativeUpdateRequired: false, nativeUpdateRequiredAt: '' });
            await Updater._fetchNativeStatus();
            expect(Updater.nativeDeadlineText).toBeNull();
        });
    });

    describe('loadNativeStatus', () => {
        it('is a no-op without MUS config', async () => {
            const { Updater } = setup({ APP_ENV: 'test' });
            global.fetch = jest.fn() as unknown as typeof fetch;
            await Updater.loadNativeStatus();
            expect(global.fetch).not.toHaveBeenCalled();
            expect(Updater.nativeStatus).toBeNull();
        });

        it('fetches the native-status endpoint and stores the result', async () => {
            const { Updater } = setup();
            const status = { ...baseStatus, nativeUpdateRequired: false };
            mockFetch(status);
            await Updater.loadNativeStatus();
            expect(global.fetch).toHaveBeenCalledWith(
                'https://mus.test/api/manifest/app-1/native-status?channelId=chan-1&platform=ios'
            );
            expect(Updater.nativeStatus).toEqual(status);
        });

        it('ignores non-ok responses', async () => {
            const { Updater } = setup();
            mockFetch({}, false);
            await Updater.loadNativeStatus();
            expect(Updater.nativeStatus).toBeNull();
        });
    });

    describe('openStore', () => {
        it('opens the store URL from the native status', async () => {
            const { Updater, Linking } = setup();
            mockFetch({ ...baseStatus, nativeUpdateRequired: false, storeUrl: 'https://store.test/x' });
            await Updater._fetchNativeStatus();
            Updater.openStore();
            expect(Linking.openURL).toHaveBeenCalledWith('https://store.test/x');
        });

        it('no-ops with no native status', () => {
            const { Updater, Linking } = setup();
            Updater.openStore();
            expect(Linking.openURL).not.toHaveBeenCalled();
        });
    });

    describe('required-update alert (unified deferral)', () => {
        const requiredStatus = { ...baseStatus, nativeUpdateRequired: true, latestStoreVersion: '2.0.0' };

        it('shows the alert when required and not deferred', async () => {
            const { Updater, Alert } = setup();
            mockFetch(requiredStatus);
            await Updater._fetchNativeStatus();
            expect(Alert.alert).toHaveBeenCalledWith(
                'Update Required',
                expect.any(String),
                expect.any(Array),
                expect.objectContaining({ cancelable: false })
            );
        });

        it('defers the alert while the OTA deferral listener returns true', async () => {
            const { Updater, Alert } = setup();
            Updater.setUpdateDeferralListener(() => true);
            mockFetch(requiredStatus);
            await Updater._fetchNativeStatus();
            expect(Alert.alert).not.toHaveBeenCalled();
        });

        it('does not alert when no native update is required', async () => {
            const { Updater, Alert } = setup();
            mockFetch({ ...baseStatus, nativeUpdateRequired: false });
            await Updater._fetchNativeStatus();
            expect(Alert.alert).not.toHaveBeenCalled();
        });

        it('shows the alert at most once', async () => {
            const { Updater, Alert } = setup();
            mockFetch(requiredStatus);
            await Updater._fetchNativeStatus();
            await Updater._fetchNativeStatus();
            expect(Alert.alert).toHaveBeenCalledTimes(1);
        });

        it('OK opens the store and locks the UI', async () => {
            const { Updater, Alert, Linking, LoaderState } = setup();
            const before = LoaderState.loaderCount;
            mockFetch({ ...requiredStatus, storeUrl: 'https://store.test/x' });
            await Updater._fetchNativeStatus();
            const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
            buttons[0].onPress();
            expect(Linking.openURL).toHaveBeenCalledWith('https://store.test/x');
            expect(LoaderState.loaderCount).toBe(before + 1);
        });
    });

    describe('OTA download', () => {
        it('downloads when an update is available (happy path)', async () => {
            const { Updater, Updates } = setup();
            (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValueOnce({ isAvailable: true });
            const result = await Updater.downloadUpdate();
            expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
            expect(Updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
            expect(result).toBe(true);
        });

        it('does not fetch when no update is available', async () => {
            const { Updater, Updates } = setup();
            (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValueOnce({ isAvailable: false });
            const result = await Updater.downloadUpdate();
            expect(Updates.fetchUpdateAsync).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('skips the check entirely when deferred', async () => {
            const { Updater, Updates } = setup();
            Updater.setUpdateDeferralListener(() => true);
            const result = await Updater.downloadUpdate();
            expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('returns false when the check throws', async () => {
            const { Updater, Updates } = setup();
            (Updates.checkForUpdateAsync as jest.Mock).mockRejectedValueOnce(new Error('offline'));
            const result = await Updater.downloadUpdate();
            expect(result).toBe(false);
            expect(Updates.fetchUpdateAsync).not.toHaveBeenCalled();
        });

        it('returns false when the fetch throws', async () => {
            const { Updater, Updates } = setup();
            (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValueOnce({ isAvailable: true });
            (Updates.fetchUpdateAsync as jest.Mock).mockRejectedValueOnce(new Error('fetch failed'));
            const result = await Updater.downloadUpdate();
            expect(result).toBe(false);
        });

        it('dedupes concurrent download calls', async () => {
            const { Updater, Updates } = setup();
            const [a, b] = await Promise.all([Updater.downloadUpdate(), Updater.downloadUpdate()]);
            expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
            expect(a).toBe(false);
            expect(b).toBe(false);
        });
    });

    describe('OTA install', () => {
        it('reloads when active and not deferred (happy path)', () => {
            const { Updater, Updates } = setup();
            Updater.installUpdate();
            expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
        });

        it('defers install while the deferral listener is true', () => {
            const { Updater, Updates } = setup();
            Updater.setUpdateDeferralListener(() => true);
            Updater.installUpdate();
            expect(Updates.reloadAsync).not.toHaveBeenCalled();
        });

        it('defers install while the app is not active', () => {
            const { Updater, Updates } = setup();
            require('react-native').AppState.currentState = 'background';
            Updater.installUpdate();
            expect(Updates.reloadAsync).not.toHaveBeenCalled();
        });

        it('does not reload twice while a reload is in flight', () => {
            const { Updater, Updates } = setup();
            Updater.installUpdate();
            Updater.installUpdate();
            expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
        });

        it('clears the in-flight flag when reload rejects', async () => {
            const { Updater, Updates } = setup();
            (Updates.reloadAsync as jest.Mock).mockRejectedValueOnce(new Error('reload failed'));
            Updater.installUpdate();
            await Promise.resolve();
            Updater.installUpdate();
            expect(Updates.reloadAsync).toHaveBeenCalledTimes(2);
        });

        it('scheduleInstallUpdate installs after the delay', () => {
            jest.useFakeTimers();
            const { Updater, Updates } = setup();
            Updater.scheduleInstallUpdate(250);
            expect(Updates.reloadAsync).not.toHaveBeenCalled();
            jest.advanceTimersByTime(250);
            expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
            jest.useRealTimers();
        });

        it('scheduleInstallUpdate does not double-schedule', () => {
            jest.useFakeTimers();
            const { Updater, Updates } = setup();
            Updater.scheduleInstallUpdate(250);
            Updater.scheduleInstallUpdate(250);
            jest.advanceTimersByTime(250);
            expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
            jest.useRealTimers();
        });
    });
});
