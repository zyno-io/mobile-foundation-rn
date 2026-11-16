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

// Every Updater instance created by setup(); released in afterEach so a held launch-gate timer
// from a real-timer test can't keep the Jest worker alive.
const createdUpdaters: { _releaseLaunchGate: (reason: string) => void }[] = [];

function setup(env: Record<string, string> = MUS_ENV) {
    jest.resetModules();
    jest.clearAllMocks();

    const Updates = require('expo-updates');
    const { Alert, Linking } = require('react-native');
    require('../../src/config').configureFoundation(createMockConfig({ env }));

    const { Updater } = require('../../src/services/Updater');
    createdUpdaters.push(Updater);
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
        createdUpdaters.splice(0).forEach(u => u._releaseLaunchGate('test-cleanup'));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (global as any).fetch;
    });

    describe('emergency launch diagnostics', () => {
        it('captures the Expo Updates database state on an emergency launch', async () => {
            const { Updater, Updates } = setup();
            const Diagnostics = require('../../src/native/MobileFoundationDiagnostics');
            const diagnostic = { nativeModuleAvailable: true, ok: true, updates: [] };
            const collect = jest.spyOn(Diagnostics, 'getExpoUpdatesDatabaseDiagnostics').mockResolvedValue(diagnostic);
            Object.defineProperty(Updates, 'isEmergencyLaunch', { value: true, configurable: true });

            await Updater._logNativeUpdateLog();

            expect(collect).toHaveBeenCalledTimes(1);
        });

        it('does not inspect the updates database after a normal launch', async () => {
            const { Updater } = setup();
            const Diagnostics = require('../../src/native/MobileFoundationDiagnostics');
            const collect = jest.spyOn(Diagnostics, 'getExpoUpdatesDatabaseDiagnostics');

            await Updater._logNativeUpdateLog();

            expect(collect).not.toHaveBeenCalled();
        });

        it('does not report a native-log read failure as an application exception', async () => {
            const { Updater, Updates } = setup();
            const Sentry = require('@sentry/react-native');
            (Updates.readLogEntriesAsync as jest.Mock).mockRejectedValueOnce(new Error('database busy'));

            await Updater._logNativeUpdateLog();

            expect(Sentry.captureException).not.toHaveBeenCalled();
        });
    });

    describe('protected background startup', () => {
        it('skips OTA APIs when initialization disabled updates', async () => {
            const { Updater, Updates } = setup();
            Object.defineProperty(Updates, 'isEnabled', { value: false, configurable: true });
            expect(await Updater.downloadUpdate()).toBe(false);
            await Updater.installUpdate();
            await Updater._syncUpdateParams();
            expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
            expect(Updates.fetchUpdateAsync).not.toHaveBeenCalled();
            expect(Updates.reloadAsync).not.toHaveBeenCalled();
            expect(Updates.setUpdateRequestHeadersOverride).not.toHaveBeenCalled();
            expect(Updates.setExtraParamAsync).not.toHaveBeenCalled();
        });

        it('skips a direct update request during a background cold start', async () => {
            const { Updater, Updates } = setup();
            require('react-native').AppState.currentState = 'background';
            expect(await Updater.downloadUpdate()).toBe(false);
            expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
        });
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

        it('immediately masks and restores the current updater status reactively', () => {
            const { Updater, Updates } = setup();
            const React = require('react');
            const { render, act } = require('@testing-library/react-native/pure');
            const { observable, runInAction } = require('mobx');
            const deferred = observable.box(false);

            (Updates.useUpdates as jest.Mock).mockReturnValue({
                isStartupProcedureRunning: false,
                isRestarting: false,
                isDownloading: true,
                isUpdatePending: false,
                isChecking: false
            });
            Updater.setUpdateDeferralListener(() => deferred.get());

            function Harness() {
                Updater._useHook(true);
                return null;
            }

            const view = render(React.createElement(Harness));
            expect(Updater.statusText).toBe('Downloading update...');

            act(() => runInAction(() => deferred.set(true)));
            expect(Updater.statusText).toBeNull();

            act(() => runInAction(() => deferred.set(false)));
            expect(Updater.statusText).toBe('Downloading update...');
            view.unmount();
        });
    });

    describe('automatic store-update status', () => {
        it('waits for ready foreground startup even with OTA disabled', () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates } = setup();
                const React = require('react');
                const { render, act } = require('@testing-library/react-native/pure');
                const { AppState } = require('react-native');
                Object.defineProperty(Updates, 'isEnabled', { value: false, configurable: true });
                AppState.currentState = 'background';
                const listeners: ((state: string) => void)[] = [];
                AppState.addEventListener.mockImplementation((_event: string, listener: (state: string) => void) => {
                    listeners.push(listener);
                    return { remove: jest.fn() };
                });
                const emit = (state: string) => { AppState.currentState = state; listeners.forEach(listener => listener(state)); };
                const load = jest.spyOn(Updater, 'loadNativeStatus').mockResolvedValue(undefined);
                function Harness({ ready }: { ready: boolean }) {
                    Updater._useHook(ready);
                    return null;
                }
                const view = render(React.createElement(Harness, { ready: false }));
                view.rerender(React.createElement(Harness, { ready: true }));
                expect(load).not.toHaveBeenCalled();
                act(() => emit('active'));
                expect(load).toHaveBeenCalledTimes(1);
                act(() => emit('background'));
                act(() => emit('active'));
                expect(load).toHaveBeenCalledTimes(1);
                view.unmount();
            } finally {
                jest.useRealTimers();
            }
        });
    });

    describe('OTA status timeouts', () => {
        it('uses the downloading phase while Expo startup is still running', () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates } = setup();
                const React = require('react');
                const { render, act } = require('@testing-library/react-native/pure');
                (Updates.useUpdates as jest.Mock).mockReturnValue({
                    isStartupProcedureRunning: true,
                    isRestarting: false,
                    isDownloading: true,
                    isUpdatePending: false,
                    isChecking: false
                });
                require('../../src/config').configureFoundation(createMockConfig({ updaterTimeout: 4000, launchUpdateGate: false }));

                function Harness() {
                    Updater._useHook(true);
                    return null;
                }

                const view = render(React.createElement(Harness));
                expect(Updater.statusText).toBe('Downloading update...');

                act(() => jest.advanceTimersByTime(4000));
                expect(Updater.statusText).toBe('Downloading update...');

                act(() => jest.advanceTimersByTime(6000));
                expect(Updater.statusText).toBeNull();
                view.unmount();
            } finally {
                jest.useRealTimers();
            }
        });

        it('shows a pending update but waits for Expo startup to finish before scheduling it', () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates } = setup();
                const React = require('react');
                const { render } = require('@testing-library/react-native/pure');
                let updateState = {
                    isStartupProcedureRunning: true,
                    isRestarting: false,
                    isDownloading: false,
                    isUpdatePending: true,
                    isChecking: false,
                    downloadedUpdate: { updateId: 'update-1' }
                };
                (Updates.useUpdates as jest.Mock).mockImplementation(() => updateState);
                const schedule = jest.spyOn(Updater, 'scheduleInstallUpdate');

                function Harness() {
                    Updater._useHook(true);
                    return null;
                }

                const view = render(React.createElement(Harness));
                expect(Updater.statusText).toBe('Installing update...');
                expect(schedule).not.toHaveBeenCalled();

                updateState = { ...updateState, isStartupProcedureRunning: false };
                view.rerender(React.createElement(Harness));

                expect(schedule).toHaveBeenCalledWith('update-1');
                expect(Updater._installTimeout).not.toBeNull();
                view.unmount();
            } finally {
                jest.useRealTimers();
            }
        });

        it('restarts the timeout for each phase and never times out installation', () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates } = setup();
                const React = require('react');
                const { render, act } = require('@testing-library/react-native/pure');
                let updateState = {
                    isStartupProcedureRunning: false,
                    isRestarting: false,
                    isDownloading: false,
                    isUpdatePending: false,
                    isChecking: true,
                    downloadedUpdate: undefined as { updateId: string } | undefined
                };
                (Updates.useUpdates as jest.Mock).mockImplementation(() => updateState);
                jest.spyOn(Updater, 'scheduleInstallUpdate').mockImplementation(() => undefined);

                require('../../src/config').configureFoundation(createMockConfig({ updaterTimeout: 4000, launchUpdateGate: false }));

                function Harness() {
                    Updater._useHook(true);
                    return null;
                }

                const view = render(React.createElement(Harness));
                expect(Updater.statusText).toBe('Checking for updates...');

                act(() => jest.advanceTimersByTime(3999));
                expect(Updater.statusText).toBe('Checking for updates...');
                act(() => jest.advanceTimersByTime(1));
                expect(Updater.statusText).toBeNull();

                updateState = {
                    ...updateState,
                    isChecking: false,
                    isDownloading: true
                };
                view.rerender(React.createElement(Harness));
                expect(Updater.statusText).toBe('Downloading update...');

                act(() => jest.advanceTimersByTime(9999));
                expect(Updater.statusText).toBe('Downloading update...');
                act(() => jest.advanceTimersByTime(1));
                expect(Updater.statusText).toBeNull();

                updateState = {
                    ...updateState,
                    isDownloading: false,
                    isUpdatePending: true,
                    downloadedUpdate: { updateId: 'update-1' }
                };
                view.rerender(React.createElement(Harness));
                expect(Updater.statusText).toBe('Installing update...');

                act(() => jest.advanceTimersByTime(60_000));
                expect(Updater.statusText).toBe('Installing update...');
                view.unmount();
            } finally {
                jest.useRealTimers();
            }
        });
    });

    describe('MUS device-id extra param', () => {
        it('never overrides request headers (embedded, OTA, or emergency launches)', async () => {
            for (const [embedded, emergency] of [
                [true, false],
                [false, false],
                [true, true]
            ]) {
                const { Updater, Updates } = setup();
                Object.defineProperty(Updates, 'isEmbeddedLaunch', { value: embedded, configurable: true });
                Object.defineProperty(Updates, 'isEmergencyLaunch', { value: emergency, configurable: true });
                await Updater.downloadUpdate();
                await Updater._syncUpdateParams();
                expect(Updates.setUpdateRequestHeadersOverride).not.toHaveBeenCalled();
                expect(Updates.setExtraParamAsync).toHaveBeenCalledWith('mus-device-id', 'unique-id-123');
            }
        });

        it('sets the extra param before checking for an update', async () => {
            const { Updater, Updates } = setup();
            await Updater.downloadUpdate();
            expect(Updates.setExtraParamAsync).toHaveBeenCalledTimes(1);
            expect(Updates.setExtraParamAsync).toHaveBeenCalledWith('mus-device-id', 'unique-id-123');
            expect((Updates.setExtraParamAsync as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
                (Updates.checkForUpdateAsync as jest.Mock).mock.invocationCallOrder[0]
            );
        });

        it('is memoized across checks', async () => {
            const { Updater, Updates } = setup();
            await Updater.downloadUpdate();
            await Updater.downloadUpdate();
            expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(2);
            expect(Updates.setExtraParamAsync).toHaveBeenCalledTimes(1);
        });

        it('is skipped without a MUS channel', async () => {
            const { Updater, Updates } = setup({ APP_ENV: 'test' });
            await Updater.downloadUpdate();
            expect(Updates.setExtraParamAsync).not.toHaveBeenCalled();
            expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
        });

        it('is skipped in development', async () => {
            const nodeEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';
            try {
                const { Updater, Updates } = setup();
                await Updater._syncUpdateParams();
                expect(Updates.setExtraParamAsync).not.toHaveBeenCalled();
            } finally {
                process.env.NODE_ENV = nodeEnv;
            }
        });

        it('does not block the check when the param cannot be set, and retries next time', async () => {
            const { Updater, Updates } = setup();
            (Updates.setExtraParamAsync as jest.Mock).mockRejectedValueOnce(new Error('db busy'));
            await Updater.downloadUpdate();
            expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
            await Updater.downloadUpdate();
            expect(Updates.setExtraParamAsync).toHaveBeenCalledTimes(2);
        });

        it('a direct downloadUpdate() awaits the param before checking', async () => {
            const { Updater, Updates } = setup();
            let resolveParam: () => void = () => undefined;
            (Updates.setExtraParamAsync as jest.Mock).mockImplementationOnce(
                () => new Promise<void>(resolve => (resolveParam = resolve))
            );
            const pending = Updater.downloadUpdate();
            await flushMicrotasks(30);
            expect(Updates.setExtraParamAsync).toHaveBeenCalledTimes(1);
            expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
            resolveParam();
            await pending;
            expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
        });
    });

    describe('launch gate', () => {
        function gateSetup(env?: Record<string, string>) {
            const ctx = setup(env);
            const release = jest.spyOn(ctx.Updater, '_releaseLaunchGate');
            const firstReason = () => release.mock.calls[0]?.[0];
            const available = (id = 'update-2') => {
                (ctx.Updates.checkForUpdateAsync as jest.Mock).mockResolvedValueOnce({ isAvailable: true, manifest: { id } });
            };
            const fetched = (id = 'update-2') => {
                (ctx.Updates.fetchUpdateAsync as jest.Mock).mockResolvedValueOnce({ isNew: true, isRollBackToEmbedded: false, manifest: { id } });
            };
            return { ...ctx, release, firstReason, available, fetched };
        }

        function hookHarness() {
            const React = require('react');
            const { render, act } = require('@testing-library/react-native/pure');
            const { Updater } = require('../../src/services/Updater');
            function Harness() {
                Updater._useHook(true);
                return null;
            }
            return { React, render, act, Harness };
        }

        function captureAppState() {
            const { AppState } = require('react-native');
            const listeners: ((state: string) => void)[] = [];
            AppState.addEventListener.mockImplementation((_event: string, listener: (state: string) => void) => {
                listeners.push(listener);
                return { remove: jest.fn() };
            });
            return {
                AppState,
                emit: (state: string) => {
                    AppState.currentState = state;
                    listeners.forEach(listener => listener(state));
                }
            };
        }

        it('holds a non-null status before the check starts', () => {
            const { Updater } = gateSetup();
            expect(Updater.isLaunchCheckPending).toBe(true);
            expect(Updater.statusText).toBe('Checking for updates...');
        });

        it('releases on no-update', async () => {
            const { Updater, firstReason } = gateSetup();
            await Updater.downloadUpdate();
            expect(firstReason()).toBe('no-update');
            expect(Updater.isLaunchCheckPending).toBe(false);
            expect(Updater.statusText).toBeNull();
        });

        it('releases on check-error', async () => {
            const { Updater, Updates, firstReason } = gateSetup();
            (Updates.checkForUpdateAsync as jest.Mock).mockRejectedValueOnce(new Error('offline'));
            await Updater.downloadUpdate();
            expect(firstReason()).toBe('check-error');
            expect(Updater.statusText).toBeNull();
        });

        it('releases on fetch-not-new', async () => {
            const { Updater, available, firstReason } = gateSetup();
            available();
            await Updater.downloadUpdate();
            expect(firstReason()).toBe('fetch-not-new');
        });

        it('releases on fetch-error', async () => {
            const { Updater, Updates, available, firstReason } = gateSetup();
            available();
            (Updates.fetchUpdateAsync as jest.Mock).mockRejectedValueOnce(new Error('boom'));
            await Updater.downloadUpdate();
            expect(firstReason()).toBe('fetch-error');
        });

        it('stays held after an installable fetch (the reload is expected)', async () => {
            const { Updater, available, fetched, release } = gateSetup();
            available();
            fetched();
            expect(await Updater.downloadUpdate()).toBe(true);
            expect(release).not.toHaveBeenCalled();
            expect(Updater.isLaunchCheckPending).toBe(true);
        });

        it('releases with install-timeout if the reload never happens', async () => {
            jest.useFakeTimers();
            try {
                const { Updater, available, fetched, firstReason } = gateSetup();
                available();
                fetched();
                await Updater.downloadUpdate();
                jest.advanceTimersByTime(6499);
                expect(Updater.isLaunchCheckPending).toBe(true);
                jest.advanceTimersByTime(1);
                expect(firstReason()).toBe('install-timeout');
            } finally {
                jest.useRealTimers();
            }
        });

        it('releases before the download on an emergency launch with an unknown failed id', async () => {
            const { Updater, Updates, available, firstReason } = gateSetup();
            Object.defineProperty(Updates, 'isEmergencyLaunch', { value: true, configurable: true });
            Object.defineProperty(Updates, 'isEmbeddedLaunch', { value: true, configurable: true });
            Updater._installCircuitReady = Promise.resolve();
            available();
            (Updates.fetchUpdateAsync as jest.Mock).mockImplementationOnce(() => new Promise(() => undefined));
            void Updater.downloadUpdate();
            await flushMicrotasks(40);
            expect(Updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
            expect(firstReason()).toBe('install-blocked');
            expect(Updater.isLaunchCheckPending).toBe(false);
        });

        it('releases with install-blocked when the fetched target is not auto-installable', async () => {
            const { Updater, available, fetched, firstReason } = gateSetup();
            Updater._circuitOpen = true;
            Updater._suppressedUpdateId = 'update-2';
            available('update-3'); // prospective target looks fine...
            fetched('update-2'); // ...but the fetched one is the looping update
            await Updater.downloadUpdate();
            expect(firstReason()).toBe('install-blocked');
        });

        it('releases when installUpdate bails out', async () => {
            const cases: [string, (ctx: ReturnType<typeof gateSetup>) => void][] = [
                ['install-circuit-open', ({ Updater }) => { Updater._circuitOpen = true; Updater._suppressedUpdateId = 'u'; }],
                ['install-emergency-launch', ({ Updates }) => Object.defineProperty(Updates, 'isEmergencyLaunch', { value: true, configurable: true })],
                ['install-reload-failures', ({ Updater }) => { Updater._reloadFailures = 3; }],
                ['install-deferred', ({ Updater }) => { Updater._shouldDeferUpdate = () => true; }]
            ];
            for (const [reason, arrange] of cases) {
                const ctx = gateSetup();
                arrange(ctx);
                await ctx.Updater.installUpdate('u');
                expect(ctx.firstReason()).toBe(reason);
                expect(ctx.Updates.reloadAsync).not.toHaveBeenCalled();
            }
        });

        it('releases with reload-failed when reloadAsync throws', async () => {
            const { Updater, Updates, firstReason } = gateSetup();
            (Updates.reloadAsync as jest.Mock).mockRejectedValueOnce(new Error('appContext not set'));
            await Updater.installUpdate('u');
            expect(firstReason()).toBe('reload-failed');
        });

        it('stays held after a successful reload dispatch', async () => {
            const { Updater, Updates, release } = gateSetup();
            await Updater.installUpdate('u');
            expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
            expect(release).not.toHaveBeenCalled();
            expect(Updater.isLaunchCheckPending).toBe(true);
        });

        it('stays held when the app is not active or not ready', async () => {
            const { Updater, Updates, release } = gateSetup();
            require('react-native').AppState.currentState = 'background';
            expect(await Updater.downloadUpdate()).toBe(false);
            await Updater.installUpdate('u');
            Updater._appReady = false;
            require('react-native').AppState.currentState = 'active';
            expect(await Updater.downloadUpdate()).toBe(false);
            await Updater.installUpdate('u');
            expect(release).not.toHaveBeenCalled();
            expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
            expect(Updater.statusText).toBe('Checking for updates...');
        });

        it('releases on check-timeout, then handles a late result normally', async () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates, release, firstReason } = gateSetup();
                let resolveCheck: (v: unknown) => void = () => undefined;
                (Updates.checkForUpdateAsync as jest.Mock).mockImplementationOnce(() => new Promise(resolve => (resolveCheck = resolve)));
                (Updates.fetchUpdateAsync as jest.Mock).mockResolvedValueOnce({ isNew: true, isRollBackToEmbedded: false, manifest: { id: 'late-update' } });

                const pending = Updater.downloadUpdate();
                await flushMicrotasks(40);
                expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
                jest.advanceTimersByTime(4999);
                expect(Updater.isLaunchCheckPending).toBe(true);
                jest.advanceTimersByTime(1);
                expect(firstReason()).toBe('check-timeout');
                expect(Updater.statusText).toBeNull();

                resolveCheck({ isAvailable: true, manifest: { id: 'late-update' } });
                expect(await pending).toBe(true);
                expect(Updater._lastDownloadedInstallTarget).toBe('late-update');
                expect(release.mock.calls.filter(c => c[0] !== 'check-timeout' && c[0] !== 'deferred')).toEqual([]);
            } finally {
                jest.useRealTimers();
            }
        });

        it('uses updaterTimeout as the launch check deadline', async () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates, firstReason } = gateSetup();
                require('../../src/config').configureFoundation(createMockConfig({ env: MUS_ENV, updaterTimeout: 4000 }));
                (Updates.checkForUpdateAsync as jest.Mock).mockImplementationOnce(() => new Promise(() => undefined));
                void Updater.downloadUpdate();
                await flushMicrotasks(40);
                jest.advanceTimersByTime(3999);
                expect(Updater.isLaunchCheckPending).toBe(true);
                jest.advanceTimersByTime(1);
                expect(firstReason()).toBe('check-timeout');
            } finally {
                jest.useRealTimers();
            }
        });

        it('releases on precheck-timeout and init-error from the hook', async () => {
            jest.useFakeTimers();
            try {
                const a = gateSetup();
                const { render, React, Harness } = hookHarness();
                jest.spyOn(a.AppMeta, 'load').mockImplementation(() => new Promise(() => undefined));
                const view = render(React.createElement(Harness));
                jest.advanceTimersByTime(2999);
                expect(a.Updater.isLaunchCheckPending).toBe(true);
                jest.advanceTimersByTime(1);
                expect(a.firstReason()).toBe('precheck-timeout');
                view.unmount();

                const b = gateSetup();
                jest.spyOn(b.AppMeta, 'load').mockRejectedValue(new Error('no device id'));
                const h2 = hookHarness();
                const view2 = h2.render(h2.React.createElement(h2.Harness));
                await flushMicrotasks(20);
                expect(b.firstReason()).toBe('init-error');
                view2.unmount();
            } finally {
                jest.useRealTimers();
            }
        });

        it('starts the launch check immediately from the hook', async () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates } = gateSetup();
                const { render, React, Harness } = hookHarness();
                jest.spyOn(Updater, 'loadNativeStatus').mockResolvedValue(undefined);
                const view = render(React.createElement(Harness));
                await flushMicrotasks(30);
                jest.advanceTimersByTime(0);
                await flushMicrotasks(30);
                expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
                view.unmount();
            } finally {
                jest.useRealTimers();
            }
        });

        it('non-launch foreground checks still wait for the settle delay', async () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates } = gateSetup();
                const { render, React, Harness } = hookHarness();
                jest.spyOn(Updater, 'loadNativeStatus').mockResolvedValue(undefined);
                Updater._releaseLaunchGate('test');
                const view = render(React.createElement(Harness));
                await flushMicrotasks(30);
                jest.advanceTimersByTime(499);
                await flushMicrotasks(30);
                expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
                jest.advanceTimersByTime(1);
                await flushMicrotasks(30);
                expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
                view.unmount();
            } finally {
                jest.useRealTimers();
            }
        });

        it('a background launch stays held and does not check until active', async () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates, release } = gateSetup();
                const { render, act, React, Harness } = hookHarness();
                const { AppState, emit } = captureAppState();
                AppState.currentState = 'background';
                jest.spyOn(Updater, 'loadNativeStatus').mockResolvedValue(undefined);
                const view = render(React.createElement(Harness));
                await flushMicrotasks(30);
                jest.advanceTimersByTime(20_000);
                await flushMicrotasks(30);
                expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
                expect(release).not.toHaveBeenCalled();
                expect(Updater.statusText).toBe('Checking for updates...');

                act(() => emit('active'));
                await flushMicrotasks(30);
                jest.advanceTimersByTime(0);
                await flushMicrotasks(30);
                expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
                view.unmount();
            } finally {
                jest.useRealTimers();
            }
        });

        it('never reports a null status across checking, downloading and installing', () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates } = gateSetup();
                const { render, React, Harness } = hookHarness();
                jest.spyOn(Updater, 'scheduleInstallUpdate').mockImplementation(() => undefined);
                const base = {
                    isStartupProcedureRunning: false,
                    isRestarting: false,
                    isDownloading: false,
                    isUpdatePending: false,
                    isChecking: false,
                    downloadedUpdate: undefined as { updateId: string } | undefined
                };
                let state = { ...base };
                (Updates.useUpdates as jest.Mock).mockImplementation(() => state);
                const seen: (string | null)[] = [];
                const { autorun } = require('mobx');
                const dispose = autorun(() => seen.push(Updater.statusText));

                const view = render(React.createElement(Harness));
                for (const next of [
                    { ...base, isChecking: true },
                    { ...base }, // gap between phases
                    { ...base, isDownloading: true },
                    { ...base }, // gap between phases
                    { ...base, isUpdatePending: true, downloadedUpdate: { updateId: 'update-2' } }
                ]) {
                    state = next;
                    view.rerender(React.createElement(Harness));
                }
                dispose();
                expect(seen.length).toBeGreaterThan(1);
                expect(seen).not.toContain(null);
                expect(Updater.statusText).toBe('Installing update...');
                view.unmount();
            } finally {
                jest.useRealTimers();
            }
        });

        it('releases on deferral and stays released after the deferral clears', () => {
            const { Updater, firstReason } = gateSetup();
            const { observable, runInAction } = require('mobx');
            const deferred = observable.box(false);
            Updater.setUpdateDeferralListener(() => deferred.get());
            expect(Updater.statusText).toBe('Checking for updates...');

            runInAction(() => deferred.set(true));
            expect(firstReason()).toBe('deferred');
            expect(Updater.statusText).toBeNull();

            runInAction(() => deferred.set(false));
            expect(Updater.isLaunchCheckPending).toBe(false);
            expect(Updater.statusText).toBeNull();
        });

        it('re-evaluates statusText observers when the deferral listener is swapped', () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates } = gateSetup();
                const { render, React, Harness } = hookHarness();
                Updater._releaseLaunchGate('test');
                (Updates.useUpdates as jest.Mock).mockImplementation(() => ({
                    isStartupProcedureRunning: false,
                    isRestarting: false,
                    isDownloading: true,
                    isUpdatePending: false,
                    isChecking: false,
                    downloadedUpdate: undefined
                }));
                const view = render(React.createElement(Harness));
                const seen: (string | null)[] = [];
                const { autorun } = require('mobx');
                const dispose = autorun(() => seen.push(Updater.statusText));
                expect(seen).toEqual(['Downloading update...']);

                Updater.setUpdateDeferralListener(() => true);
                expect(seen[seen.length - 1]).toBeNull();

                Updater.setUpdateDeferralListener(null);
                expect(seen[seen.length - 1]).toBe('Downloading update...');
                dispose();
                view.unmount();
            } finally {
                jest.useRealTimers();
            }
        });

        it('is never held in development, with OTA disabled, or when opted out', () => {
            const nodeEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';
            try {
                const { Updater } = gateSetup();
                expect(Updater.isLaunchCheckPending).toBe(false);
                expect(Updater.statusText).toBeNull();
            } finally {
                process.env.NODE_ENV = nodeEnv;
            }

            const disabled = gateSetup();
            Object.defineProperty(disabled.Updates, 'isEnabled', { value: false, configurable: true });
            expect(disabled.Updater.isLaunchCheckPending).toBe(false);
            expect(disabled.Updater.statusText).toBeNull();

            const optedOut = gateSetup();
            require('../../src/config').configureFoundation(createMockConfig({ env: MUS_ENV, launchUpdateGate: false }));
            expect(optedOut.Updater.isLaunchCheckPending).toBe(false);
            expect(optedOut.Updater.statusText).toBeNull();
        });

        it('releases with disabled when a check is requested with OTA disabled', async () => {
            const { Updater, Updates, firstReason } = gateSetup();
            Object.defineProperty(Updates, 'isEnabled', { value: false, configurable: true });
            await Updater.downloadUpdate();
            expect(firstReason()).toBe('disabled');
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
        it('waits for a stable foreground before checking after activation', async () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates } = setup();
                const { AppState } = require('react-native');

                Updater.scheduleForegroundUpdateCheck();
                jest.advanceTimersByTime(499);
                expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();

                AppState.currentState = 'background';
                jest.advanceTimersByTime(1);
                await flushMicrotasks();
                expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();

                AppState.currentState = 'active';
                Updater.scheduleForegroundUpdateCheck();
                jest.advanceTimersByTime(500);
                await flushMicrotasks();
                expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
            } finally {
                jest.useRealTimers();
            }
        });

        it('cancels a pending foreground check when the app deactivates', () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates } = setup();
                Updater.scheduleForegroundUpdateCheck();
                expect(Updater._cancelScheduledUpdateCheck()).toBe(true);
                jest.advanceTimersByTime(500);
                expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
            } finally {
                jest.useRealTimers();
            }
        });

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
            expect(Updater._lastDownloadedInstallTarget).toBe('fix-forward-update');
        });

        it('does not remember a fetched result without a launchable update id', async () => {
            const { Updater, Updates } = setup();
            Updater._lastDownloadedInstallTarget = 'stale-update';
            (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValueOnce({ isAvailable: true });
            (Updates.fetchUpdateAsync as jest.Mock).mockResolvedValueOnce({
                isNew: false,
                isRollBackToEmbedded: false,
                manifest: undefined
            });

            const result = await Updater.downloadUpdate();

            expect(result).toBe(false);
            expect(Updater._lastDownloadedInstallTarget).toBeNull();
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
            const Sentry = require('@sentry/react-native');
            (Updates.checkForUpdateAsync as jest.Mock).mockRejectedValueOnce(new Error('offline'));
            const result = await Updater.downloadUpdate();
            expect(result).toBe(false);
            expect(Updates.fetchUpdateAsync).not.toHaveBeenCalled();
            expect(Sentry.captureException).not.toHaveBeenCalled();
        });

        it('returns false when the fetch throws', async () => {
            const { Updater, Updates } = setup();
            const Sentry = require('@sentry/react-native');
            (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValueOnce({ isAvailable: true });
            (Updates.fetchUpdateAsync as jest.Mock).mockRejectedValueOnce(new Error('fetch failed'));
            const result = await Updater.downloadUpdate();
            expect(result).toBe(false);
            expect(Sentry.captureException).not.toHaveBeenCalled();
        });

        it('dedupes concurrent download calls', async () => {
            const { Updater, Updates } = setup();
            const [a, b] = await Promise.all([Updater.downloadUpdate(), Updater.downloadUpdate()]);
            expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
            expect(a).toBe(false);
            expect(b).toBe(false);
        });
    });

    describe('embedded rollback', () => {
        const rollbackTarget = { type: 'rollback' };

        it('fetches a rollback check with isAvailable=false and reloads without recording a failed OTA attempt', async () => {
            const { Updater, Updates } = setup();
            Updates.checkForUpdateAsync.mockResolvedValueOnce({ isAvailable: false, isRollBackToEmbedded: true });
            Updates.fetchUpdateAsync.mockResolvedValueOnce({ isNew: false, isRollBackToEmbedded: true, manifest: undefined });
            const record = jest.spyOn(Updater, '_recordInstallAttempt');

            const available = await Updater.downloadUpdate();
            expect(available).toBe(true);
            expect(Updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
            expect(Updater._lastDownloadedInstallTarget).toEqual(rollbackTarget);
            await Updater.installUpdate();
            expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
            expect(record).not.toHaveBeenCalled();
        });

        it('handles a rollback returned by fetch after a normal update check', async () => {
            const { Updater, Updates } = setup();
            Updater._lastDownloadedInstallTarget = 'stale-update';
            Updates.checkForUpdateAsync.mockResolvedValueOnce({ isAvailable: true, isRollBackToEmbedded: false });
            Updates.fetchUpdateAsync.mockResolvedValueOnce({ isNew: false, isRollBackToEmbedded: true, manifest: undefined });
            const available = await Updater.downloadUpdate();
            expect(available).toBe(true);
            expect(Updater._lastDownloadedInstallTarget).toEqual(rollbackTarget);
        });

        it('uses the actual fetch result when a fix-forward replaces a rollback between requests', async () => {
            const { Updater, Updates } = setup();
            Updates.checkForUpdateAsync.mockResolvedValueOnce({ isAvailable: false, isRollBackToEmbedded: true });
            Updates.fetchUpdateAsync.mockResolvedValueOnce({ isNew: true, isRollBackToEmbedded: false, manifest: { id: 'fix-forward' } });
            const available = await Updater.downloadUpdate();
            expect(available).toBe(true);
            expect(Updater._lastDownloadedInstallTarget).toBe('fix-forward');
        });

        it.each(['rollbackNoEmbeddedConfiguration', 'rollbackRejectedBySelectionPolicy'])(
            'leaves Expo in control when it rejects a directive: %s', async (reason) => {
                const { Updater, Updates } = setup();
                Updates.checkForUpdateAsync.mockResolvedValueOnce({ isAvailable: false, isRollBackToEmbedded: false, reason });
                const available = await Updater.downloadUpdate();
                expect(available).toBe(false);
                expect(Updates.fetchUpdateAsync).not.toHaveBeenCalled();
                expect(Updates.reloadAsync).not.toHaveBeenCalled();
            }
        );

        it('lets an explicit rollback pass the failed-update circuit while preserving suppression of unknown installs', async () => {
            const { Updater, Updates } = setup();
            Updater._circuitOpen = true;
            Updater._suppressedUpdateId = null;
            Object.defineProperty(Updates, 'isEmergencyLaunch', { value: true, configurable: true });
            expect(Updater._canAutoInstallPendingUpdate(null)).toBe(false);
            expect(Updater._canAutoInstallPendingUpdate(rollbackTarget)).toBe(true);
            await Updater.installUpdate(rollbackTarget);
            expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
        });

        it('does not reload an already embedded launch', async () => {
            const { Updater, Updates } = setup();
            Object.defineProperty(Updates, 'isEmbeddedLaunch', { value: true, configurable: true });
            expect(Updater._canAutoInstallPendingUpdate(rollbackTarget)).toBe(false);
            await Updater.installUpdate(rollbackTarget);
            expect(Updates.reloadAsync).not.toHaveBeenCalled();
        });

        it('keeps a hook rollback distinct from an unknown id, waits for startup/readiness and retries after call deferral clears', async () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates } = setup();
                const React = require('react');
                const { render, act } = require('@testing-library/react-native/pure');
                const { observable, runInAction } = require('mobx');
                const deferred = observable.box(true);
                Updater.setUpdateDeferralListener(() => deferred.get());
                let updateState = {
                    isStartupProcedureRunning: true, isRestarting: false, isDownloading: false,
                    isUpdatePending: true, isChecking: false,
                    downloadedUpdate: { type: Updates.UpdateInfoType.ROLLBACK, updateId: undefined }
                };
                Updates.useUpdates.mockImplementation(() => updateState);
                Updater._lastDownloadedInstallTarget = 'stale-download';
                const record = jest.spyOn(Updater, '_recordInstallAttempt');
                function Harness({ ready }: { ready: boolean }) {
                    Updater._useHook(ready);
                    return null;
                }
                const view = render(React.createElement(Harness, { ready: false }));
                expect(Updater._pendingInstallTarget).toEqual(rollbackTarget);
                expect(Updater._installTimeout).toBeNull();
                updateState = { ...updateState, isStartupProcedureRunning: false };
                view.rerender(React.createElement(Harness, { ready: true }));
                expect(Updater.statusText).toBeNull();
                expect(Updater._installTimeout).toBeNull();
                act(() => runInAction(() => deferred.set(false)));
                expect(Updater._installTimeout).not.toBeNull();
                act(() => jest.advanceTimersByTime(1500));
                await flushMicrotasks();
                expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
                expect(record).not.toHaveBeenCalled();
                view.unmount();
            } finally {
                jest.useRealTimers();
            }
        });

        it('waits until the app returns to the foreground before installing a pending rollback', async () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates } = setup();
                const { AppState } = require('react-native');
                Updater._pendingInstallTarget = rollbackTarget;
                AppState.currentState = 'background';
                Updater._trySchedulePendingInstall();
                expect(Updater._installTimeout).toBeNull();
                await Updater.installUpdate(rollbackTarget);
                expect(Updates.reloadAsync).not.toHaveBeenCalled();
                AppState.currentState = 'active';
                Updater._trySchedulePendingInstall();
                jest.advanceTimersByTime(1500);
                await flushMicrotasks();
                expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
            } finally {
                jest.useRealTimers();
            }
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
            Updater._lastDownloadedInstallTarget = 'fix-forward-update';
            const record = jest.spyOn(Updater, '_recordInstallAttempt');

            await Updater.installUpdate();

            expect(record).toHaveBeenCalledWith('fix-forward-update');
            expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
        });

        it('blocks a downloaded update on emergency launch when the failed id is unknown', async () => {
            const { Updater, Updates } = setup();
            Object.defineProperty(Updates, 'isEmergencyLaunch', { value: true, configurable: true });
            Updater._lastDownloadedInstallTarget = 'fix-forward-update';

            await Updater.installUpdate();

            expect(Updates.reloadAsync).not.toHaveBeenCalled();
            expect(Updater._reloadInFlight).toBe(false);
        });

        it('allows a no-arg emergency install to use the downloaded id when the hook pending id is unknown', async () => {
            const { Updater, Updates } = setup();
            Object.defineProperty(Updates, 'isEmergencyLaunch', { value: true, configurable: true });
            Updater._lastFailedUpdateId = 'failed-update';
            Updater._pendingInstallTarget = null;
            Updater._lastDownloadedInstallTarget = 'fix-forward-update';
            const record = jest.spyOn(Updater, '_recordInstallAttempt');

            await Updater.installUpdate();

            expect(record).toHaveBeenCalledWith('fix-forward-update');
            expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
        });

        it('uses a known hook pending id before a stale downloaded id', async () => {
            const { Updater, Updates } = setup();
            Updater._pendingInstallTarget = 'pending-update';
            Updater._lastDownloadedInstallTarget = 'stale-download';
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
                Updater._lastDownloadedInstallTarget = 'fix-forward-update';
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
            Updater._lastDownloadedInstallTarget = 'failed-update';

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
                Updater._lastDownloadedInstallTarget = 'fix-forward-update';

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
            Updater._lastDownloadedInstallTarget = 'fix-forward-update';

            await Updater.installUpdate(null);

            expect(Updates.reloadAsync).not.toHaveBeenCalled();
            expect(Updater._reloadInFlight).toBe(false);
        });

        it('does not auto-schedule a pending install while updates are deferred', () => {
            const { Updater } = setup();
            Updater._pendingInstallTarget = 'update-1';
            Updater.setUpdateDeferralListener(() => true);

            Updater._trySchedulePendingInstall();

            expect(Updater._installTimeout).toBeNull();
            expect(Updater._canAutoInstallPendingUpdate('update-1')).toBe(false);
        });

        it('cancels an already-scheduled install as soon as deferral begins', () => {
            jest.useFakeTimers();
            try {
                const { Updater } = setup();
                const { observable, runInAction } = require('mobx');
                const deferred = observable.box(false);
                Updater.setUpdateDeferralListener(() => deferred.get());
                Updater.scheduleInstallUpdate('update-1');
                expect(Updater._installTimeout).not.toBeNull();

                runInAction(() => deferred.set(true));

                expect(Updater._installTimeout).toBeNull();
            } finally {
                jest.useRealTimers();
            }
        });

        it('retries a pending install when deferral clears reactively', async () => {
            jest.useFakeTimers();
            try {
                const { Updater, Updates } = setup();
                const { observable, runInAction } = require('mobx');
                const deferred = observable.box(true);
                Updater._pendingInstallTarget = 'update-1';
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
