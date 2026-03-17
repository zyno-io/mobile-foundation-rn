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
