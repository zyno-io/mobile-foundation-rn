import { createMockConfig } from '../test-utils';

describe('useSetupFoundation lifecycle', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    /** Shared setup: configures foundation + creates AppStorage so getAppStorage() won't throw */
    function setup(configOverrides: Record<string, any> = {}) {
        const configModule = require('../../src/config');
        configModule.configureFoundation(createMockConfig(configOverrides));

        const { createAppStorage } = require('../../src/services/AppStorage');
        createAppStorage({});

        return {
            useSetupFoundation: require('../../src/hooks/useSetupFoundation').useSetupFoundation,
            React: require('react'),
            rtl: require('@testing-library/react-native/pure'),
            SplashScreen: require('expo-splash-screen'),
        };
    }

    it('keeps failed hydration unready and retries it on foreground activation', async () => {
        const { useSetupFoundation, React, rtl } = setup();
        const storage = require('@react-native-async-storage/async-storage').default;
        storage.getItem.mockRejectedValueOnce(new Error('Failed to read storage file.'))
            .mockResolvedValueOnce(JSON.stringify({ token: 'restored' }));
        const { AppState } = require('react-native');
        const states: boolean[] = [];
        function TestComponent() { states.push(useSetupFoundation()); return null; }
        const view = rtl.render(React.createElement(TestComponent));
        await rtl.act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
        expect(states.at(-1)).toBe(false);
        const listeners = AppState.addEventListener.mock.calls.map((call: any[]) => call[1]);
        await rtl.act(async () => {
            listeners.forEach((listener: Function) => listener('active'));
            await new Promise(resolve => setTimeout(resolve, 0));
        });
        expect(states.at(-1)).toBe(true);
        expect(storage.getItem).toHaveBeenCalledTimes(2);
        view.unmount();
    });

    it('defers updater disk reads during a background cold start until foreground', async () => {
        const { useSetupFoundation, React, rtl } = setup();
        const { AppState } = require('react-native');
        AppState.currentState = 'background';
        const { Updater } = require('../../src/services/Updater');
        const evaluate = jest.spyOn(Updater, '_evaluateInstallCircuit').mockResolvedValue(undefined);
        const logs = jest.spyOn(Updater, '_logNativeUpdateLog').mockResolvedValue(undefined);
        jest.spyOn(Updater, 'scheduleForegroundUpdateCheck').mockImplementation(() => {});
        function TestComponent() { useSetupFoundation(); return null; }
        const view = rtl.render(React.createElement(TestComponent));
        await rtl.act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
        expect(evaluate).not.toHaveBeenCalled();
        expect(logs).not.toHaveBeenCalled();
        AppState.currentState = 'active';
        await rtl.act(async () => {
            AppState.addEventListener.mock.calls.forEach((call: any[]) => call[1]('active'));
            await new Promise(resolve => setTimeout(resolve, 0));
        });
        expect(evaluate).toHaveBeenCalledTimes(1);
        expect(logs).toHaveBeenCalledTimes(1);
        view.unmount();
    });

    it('retries when activation arrives before an in-flight hydration fails', async () => {
        const { useSetupFoundation, React, rtl } = setup();
        const storage = require('@react-native-async-storage/async-storage').default;
        let fail!: (error: Error) => void;
        storage.getItem.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }))
            .mockResolvedValueOnce(JSON.stringify({ token: 'restored' }));
        const { AppState } = require('react-native');
        const states: boolean[] = [];
        function TestComponent() { states.push(useSetupFoundation()); return null; }
        const view = rtl.render(React.createElement(TestComponent));
        await rtl.act(async () => {
            AppState.addEventListener.mock.calls.forEach((call: any[]) => call[1]('active'));
            fail(new Error('Failed to read storage file.'));
            await new Promise(resolve => setTimeout(resolve, 0));
        });
        expect(states.at(-1)).toBe(true);
        expect(storage.getItem).toHaveBeenCalledTimes(2);
        view.unmount();
    });

    it('waits for both failed startup reads to settle before consuming a queued activation', async () => {
        const { useSetupFoundation, React, rtl } = setup();
        const storage = require('@react-native-async-storage/async-storage').default;
        const { AppMeta } = require('../../src/services/AppMeta');
        const { memoizeAsync } = require('../../src/helpers/memoize');
        let failMeta!: (error: Error) => void;
        let failStorage!: (error: Error) => void;
        const metaRead = jest.fn().mockImplementationOnce(() => new Promise((_resolve, reject) => { failMeta = reject; }))
            .mockResolvedValue(undefined);
        jest.spyOn(AppMeta, 'load').mockImplementation(memoizeAsync(metaRead));
        storage.getItem.mockImplementationOnce(() => new Promise((_resolve, reject) => { failStorage = reject; }))
            .mockResolvedValueOnce('{}');
        const { AppState } = require('react-native');
        const states: boolean[] = [];
        function TestComponent() { states.push(useSetupFoundation()); return null; }
        const view = rtl.render(React.createElement(TestComponent));
        await rtl.act(async () => {
            AppState.addEventListener.mock.calls.forEach((call: any[]) => call[1]('active'));
            failMeta(new Error('User interaction is not allowed.'));
            await new Promise(resolve => setTimeout(resolve, 0));
        });
        await rtl.act(async () => {
            failStorage(new Error('Failed to read storage file.'));
            await new Promise(resolve => setTimeout(resolve, 0));
        });
        expect(states.at(-1)).toBe(true);
        expect(metaRead).toHaveBeenCalledTimes(2);
        expect(storage.getItem).toHaveBeenCalledTimes(2);
        view.unmount();
    });

    it('returns false initially before services load', () => {
        const { useSetupFoundation, React, rtl } = setup();

        const results: boolean[] = [];
        function TestComponent() {
            results.push(useSetupFoundation());
            return null;
        }

        rtl.render(React.createElement(TestComponent));

        expect(results[0]).toBe(false);
    });

    it('returns true after services and fonts load', async () => {
        const { useSetupFoundation, React, rtl } = setup();

        const results: boolean[] = [];
        function TestComponent() {
            results.push(useSetupFoundation());
            return null;
        }

        rtl.render(React.createElement(TestComponent));

        await rtl.act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        expect(results[results.length - 1]).toBe(true);
    });

    it('calls SplashScreen.hideAsync when ready and splashScreen mode is auto', async () => {
        const { useSetupFoundation, React, rtl, SplashScreen } = setup();

        function TestComponent() {
            useSetupFoundation();
            return null;
        }

        rtl.render(React.createElement(TestComponent));

        await rtl.act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        expect(SplashScreen.hideAsync).toHaveBeenCalled();
    });

    it('does not call SplashScreen.hideAsync when splashScreen is manual', async () => {
        const { useSetupFoundation, React, rtl, SplashScreen } = setup({ splashScreen: 'manual' });

        function TestComponent() {
            useSetupFoundation();
            return null;
        }

        rtl.render(React.createElement(TestComponent));

        await rtl.act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
    });

    it('appIsReady callback delays readiness', async () => {
        const { useSetupFoundation, React, rtl } = setup();

        let ready = false;
        const results: boolean[] = [];

        function TestComponent() {
            results.push(useSetupFoundation(() => ready));
            return null;
        }

        const { rerender } = rtl.render(React.createElement(TestComponent));

        await rtl.act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        // Services loaded but appIsReady returns false
        expect(results[results.length - 1]).toBe(false);

        // Now set ready and re-render
        ready = true;
        await rtl.act(async () => {
            rerender(React.createElement(TestComponent));
        });

        expect(results[results.length - 1]).toBe(true);
    });

    it('handles font loading error gracefully', async () => {
        const useFonts = require('expo-font').useFonts;
        useFonts.mockReturnValue([false, new Error('Font load failed')]);

        const { useSetupFoundation, React, rtl } = setup();

        const results: boolean[] = [];
        function TestComponent() {
            results.push(useSetupFoundation());
            return null;
        }

        rtl.render(React.createElement(TestComponent));

        await rtl.act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        // Should still become ready despite font error (fontsError is truthy)
        expect(results[results.length - 1]).toBe(true);
    });
});
