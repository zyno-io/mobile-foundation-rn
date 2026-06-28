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

async function flushMicrotasks(times = 10) {
    for (let i = 0; i < times; i++) await Promise.resolve();
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

    describe('MUS request headers', () => {
        it('applies channel and device headers', async () => {
            const { Updater, Updates, AppMeta } = setup();
            await AppMeta.load();
            Updater._applyRequestHeaders();
            expect(Updates.setUpdateRequestHeadersOverride).toHaveBeenCalledWith({
                'expo-channel-name': 'chan-1',
                'mus-device-id': 'unique-id-123'
            });
        });

        it('starts header sync on embedded launches when a MUS channel is configured', async () => {
            const { Updater, Updates } = setup();
            Object.defineProperty(Updates, 'isEmbeddedLaunch', { value: true, configurable: true });
            await Updater._startHeadersSync();
            expect(Updates.setUpdateRequestHeadersOverride).toHaveBeenCalledWith({
                'expo-channel-name': 'chan-1',
                'mus-device-id': 'unique-id-123'
            });
        });

        it('preserves existing header overrides on OTA launches', async () => {
            const { Updater, Updates } = setup();
            await Updater._startHeadersSync();
            expect(Updates.setUpdateRequestHeadersOverride).not.toHaveBeenCalled();
        });

        it('preserves existing header overrides on emergency launches', async () => {
            const { Updater, Updates } = setup();
            Object.defineProperty(Updates, 'isEmbeddedLaunch', { value: true, configurable: true });
            Object.defineProperty(Updates, 'isEmergencyLaunch', { value: true, configurable: true });
            await Updater._startHeadersSync();
            expect(Updates.setUpdateRequestHeadersOverride).not.toHaveBeenCalled();
        });

        it('does not start header sync without a MUS channel', () => {
            const { Updater, Updates } = setup({ APP_ENV: 'test' }); // no MUS_CHANNEL
            Updater._startHeadersSync();
            expect(Updates.setUpdateRequestHeadersOverride).not.toHaveBeenCalled();
        });

        it('does not recheck or cancel a scheduled install when headers are applied', async () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates, AppMeta } = setup();
                await AppMeta.load();

                Updater.scheduleInstallUpdate('generic-update', 250);
                Updater._applyRequestHeaders();

                expect(Updater._installTimeout).not.toBeNull();
                expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
                jest.advanceTimersByTime(250);
                await flushMicrotasks();
                expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
            } finally {
                jest.useRealTimers();
            }
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
            (Updates.fetchUpdateAsync as jest.Mock).mockResolvedValueOnce({
                isNew: true,
                isRollBackToEmbedded: false,
                manifest: { id: 'downloaded-update' }
            });
            const result = await Updater.downloadUpdate();
            expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
            expect(Updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
            expect(result).toBe(true);
        });

        it('remembers the downloaded update id from the fetched manifest', async () => {
            const { Updater, Updates } = setup();
            (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValueOnce({ isAvailable: true });
            (Updates.fetchUpdateAsync as jest.Mock).mockResolvedValueOnce({
                isNew: true,
                isRollBackToEmbedded: false,
                manifest: { id: 'fix-forward-update' }
            });

            const result = await Updater.downloadUpdate();

            expect(result).toBe(true);
            expect(Updater._lastDownloadedUpdateId).toBe('fix-forward-update');
        });

        it('does not remember a fetched result without a launchable update id', async () => {
            const { Updater, Updates } = setup();
            Updater._lastDownloadedUpdateId = 'stale-update';
            (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValueOnce({ isAvailable: true });
            (Updates.fetchUpdateAsync as jest.Mock).mockResolvedValueOnce({
                isNew: false,
                isRollBackToEmbedded: false,
                manifest: undefined
            });

            const result = await Updater.downloadUpdate();

            expect(result).toBe(false);
            expect(Updater._lastDownloadedUpdateId).toBeNull();
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
        it('reloads when active and not deferred (happy path)', async () => {
            const { Updater, Updates } = setup();
            await Updater.installUpdate();
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

        it('rechecks deferral after recording an install attempt', async () => {
            const { Updater, Updates } = setup();
            let resolveRecord!: () => void;
            jest.spyOn(Updater, '_recordInstallAttempt').mockImplementationOnce(
                () => new Promise<void>((resolve) => {
                    resolveRecord = resolve;
                })
            );
            const undo = jest.spyOn(Updater, '_undoInstallAttempt').mockResolvedValueOnce(undefined);

            const install = Updater.installUpdate('update-1');
            Updater.setUpdateDeferralListener(() => true);
            resolveRecord();
            await install;

            expect(Updates.reloadAsync).not.toHaveBeenCalled();
            expect(undo).toHaveBeenCalledWith('update-1');
        });

        it('rechecks app state after recording an install attempt', async () => {
            const { Updater, Updates } = setup();
            let resolveRecord!: () => void;
            jest.spyOn(Updater, '_recordInstallAttempt').mockImplementationOnce(
                () => new Promise<void>((resolve) => {
                    resolveRecord = resolve;
                })
            );
            const undo = jest.spyOn(Updater, '_undoInstallAttempt').mockResolvedValueOnce(undefined);

            const install = Updater.installUpdate('update-1');
            require('react-native').AppState.currentState = 'background';
            resolveRecord();
            await install;

            expect(Updates.reloadAsync).not.toHaveBeenCalled();
            expect(undo).toHaveBeenCalledWith('update-1');
        });

        it('allows a downloaded fix-forward through installUpdate on emergency launch', async () => {
            const { Updater, Updates } = setup();
            Object.defineProperty(Updates, 'isEmergencyLaunch', { value: true, configurable: true });
            Updater._lastFailedUpdateId = 'failed-update';
            Updater._lastDownloadedUpdateId = 'fix-forward-update';
            const record = jest.spyOn(Updater, '_recordInstallAttempt');

            await Updater.installUpdate();

            expect(record).toHaveBeenCalledWith('fix-forward-update');
            expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
        });

        it('blocks a downloaded update on emergency launch when the failed id is unknown', async () => {
            const { Updater, Updates } = setup();
            Object.defineProperty(Updates, 'isEmergencyLaunch', { value: true, configurable: true });
            Updater._lastDownloadedUpdateId = 'fix-forward-update';

            await Updater.installUpdate();

            expect(Updates.reloadAsync).not.toHaveBeenCalled();
            expect(Updater._reloadInFlight).toBe(false);
        });

        it('allows a no-arg emergency install to use the downloaded id when the hook pending id is unknown', async () => {
            const { Updater, Updates } = setup();
            Object.defineProperty(Updates, 'isEmergencyLaunch', { value: true, configurable: true });
            Updater._lastFailedUpdateId = 'failed-update';
            Updater._pendingInstallUpdateId = null;
            Updater._lastDownloadedUpdateId = 'fix-forward-update';
            const record = jest.spyOn(Updater, '_recordInstallAttempt');

            await Updater.installUpdate();

            expect(record).toHaveBeenCalledWith('fix-forward-update');
            expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
        });

        it('uses a known hook pending id before a stale downloaded id', async () => {
            const { Updater, Updates } = setup();
            Updater._pendingInstallUpdateId = 'pending-update';
            Updater._lastDownloadedUpdateId = 'stale-download';
            const record = jest.spyOn(Updater, '_recordInstallAttempt');

            await Updater.installUpdate();

            expect(record).toHaveBeenCalledWith('pending-update');
            expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
        });

        it('allows a downloaded fix-forward through scheduleInstallUpdate on emergency launch', async () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates } = setup();
                Object.defineProperty(Updates, 'isEmergencyLaunch', { value: true, configurable: true });
                Updater._lastFailedUpdateId = 'failed-update';
                Updater._lastDownloadedUpdateId = 'fix-forward-update';
                const record = jest.spyOn(Updater, '_recordInstallAttempt');

                Updater.scheduleInstallUpdate(250);
                jest.advanceTimersByTime(250);
                await flushMicrotasks();

                expect(record).toHaveBeenCalledWith('fix-forward-update');
                expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
            } finally {
                jest.useRealTimers();
            }
        });

        it('blocks an emergency no-arg install when the downloaded id matches the failed id', async () => {
            const { Updater, Updates } = setup();
            Object.defineProperty(Updates, 'isEmergencyLaunch', { value: true, configurable: true });
            Updater._lastFailedUpdateId = 'failed-update';
            Updater._lastDownloadedUpdateId = 'failed-update';

            await Updater.installUpdate();

            expect(Updates.reloadAsync).not.toHaveBeenCalled();
            expect(Updater._reloadInFlight).toBe(false);
        });

        it('does not fall back to a stale downloaded id for scheduled explicit null pending ids', async () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates } = setup();
                Object.defineProperty(Updates, 'isEmergencyLaunch', { value: true, configurable: true });
                Updater._lastFailedUpdateId = 'failed-update';
                Updater._lastDownloadedUpdateId = 'fix-forward-update';

                Updater.scheduleInstallUpdate(null, 250);
                jest.advanceTimersByTime(250);
                await flushMicrotasks();

                expect(Updates.reloadAsync).not.toHaveBeenCalled();
                expect(Updater._reloadInFlight).toBe(false);
            } finally {
                jest.useRealTimers();
            }
        });

        it('does not fall back to a stale downloaded id for explicit null pending ids', async () => {
            const { Updater, Updates } = setup();
            Object.defineProperty(Updates, 'isEmergencyLaunch', { value: true, configurable: true });
            Updater._lastFailedUpdateId = 'failed-update';
            Updater._lastDownloadedUpdateId = 'fix-forward-update';

            await Updater.installUpdate(null);

            expect(Updates.reloadAsync).not.toHaveBeenCalled();
            expect(Updater._reloadInFlight).toBe(false);
        });

        it('does not auto-schedule a pending install while updates are deferred', () => {
            const { Updater } = setup();
            Updater._pendingInstallUpdateId = 'update-1';
            Updater.setUpdateDeferralListener(() => true);

            Updater._trySchedulePendingInstall();

            expect(Updater._installTimeout).toBeNull();
            expect(Updater._canAutoInstallPendingUpdate('update-1')).toBe(false);
        });

        it('retries a pending install when deferral clears reactively', async () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates } = setup();
                const { observable, runInAction } = require('mobx');
                const deferred = observable.box(true);
                Updater._pendingInstallUpdateId = 'update-1';
                Updater.setUpdateDeferralListener(() => deferred.get());

                Updater._trySchedulePendingInstall();
                expect(Updater._installTimeout).toBeNull();

                runInAction(() => deferred.set(false));
                await flushMicrotasks();
                expect(Updater._installTimeout).not.toBeNull();

                jest.advanceTimersByTime(1500);
                await flushMicrotasks();
                expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
            } finally {
                jest.useRealTimers();
            }
        });

        it('does not reload twice while a reload is in flight', async () => {
            const { Updater, Updates } = setup();
            const firstInstall = Updater.installUpdate();
            Updater.installUpdate();
            await firstInstall;
            expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
        });

        it('clears the in-flight flag when reload rejects', async () => {
            const { Updater, Updates } = setup();
            (Updates.reloadAsync as jest.Mock).mockRejectedValueOnce(new Error('reload failed'));
            await Updater.installUpdate();
            await Updater.installUpdate();
            expect(Updates.reloadAsync).toHaveBeenCalledTimes(2);
        });

        it('scheduleInstallUpdate installs after the delay', async () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates } = setup();
                Updater.scheduleInstallUpdate(250);
                expect(Updates.reloadAsync).not.toHaveBeenCalled();
                jest.advanceTimersByTime(250);
                await flushMicrotasks();
                expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
            } finally {
                jest.useRealTimers();
            }
        });

        it('scheduleInstallUpdate does not double-schedule', async () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates } = setup();
                Updater.scheduleInstallUpdate(250);
                Updater.scheduleInstallUpdate(250);
                jest.advanceTimersByTime(250);
                await flushMicrotasks();
                expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
            } finally {
                jest.useRealTimers();
            }
        });
    });
});
