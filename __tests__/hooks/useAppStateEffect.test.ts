// @ts-ignore — set React act environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('useAppStateEffect', () => {
    let changeListeners: ((state: string) => void)[];
    let AppState: typeof import('react-native').AppState;

    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers();
        changeListeners = [];

        // Get the fresh AppState mock and override addEventListener
        AppState = require('react-native').AppState;
        (AppState.addEventListener as jest.Mock).mockImplementation(
            (_event: string, listener: (state: string) => void) => {
                changeListeners.push(listener);
                return {
                    remove: jest.fn(() => {
                        const idx = changeListeners.indexOf(listener);
                        if (idx >= 0) changeListeners.splice(idx, 1);
                    }),
                };
            },
        );
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('registers an AppState change listener on module import', () => {
        require('../../src/hooks/useAppStateEffect');
        expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('useAppStateEffect fires effect after hasLaunched is true', () => {
        const mod = require('../../src/hooks/useAppStateEffect');
        const React = require('react');
        const renderer = require('react-test-renderer');

        const effect = jest.fn();

        function TestComponent() {
            mod.useAppStateEffect(effect);
            return null;
        }

        renderer.act(() => {
            renderer.create(React.createElement(TestComponent));
        });

        // First, trigger 'active' to set hasLaunched (module-level listener)
        for (const l of [...changeListeners]) l('active');
        jest.advanceTimersByTime(200);

        // Now trigger a real change — effect should fire
        for (const l of [...changeListeners]) l('background');
        jest.advanceTimersByTime(100);

        expect(effect).toHaveBeenCalledWith('background');
    });

    it('useAppActivatedEffect only fires on active state', () => {
        const mod = require('../../src/hooks/useAppStateEffect');
        const React = require('react');
        const renderer = require('react-test-renderer');

        const effect = jest.fn();

        function TestComponent() {
            mod.useAppActivatedEffect(effect);
            return null;
        }

        renderer.act(() => {
            renderer.create(React.createElement(TestComponent));
        });

        // Set hasLaunched
        for (const l of [...changeListeners]) l('active');
        jest.advanceTimersByTime(200);

        // background should NOT trigger activated effect
        effect.mockClear();
        for (const l of [...changeListeners]) l('background');
        jest.advanceTimersByTime(100);
        expect(effect).not.toHaveBeenCalled();

        // active SHOULD trigger
        for (const l of [...changeListeners]) l('active');
        jest.advanceTimersByTime(100);
        expect(effect).toHaveBeenCalled();
    });

    it('useAppDeactivatedEvent only fires on background state', () => {
        const mod = require('../../src/hooks/useAppStateEffect');
        const React = require('react');
        const renderer = require('react-test-renderer');

        const effect = jest.fn();

        function TestComponent() {
            mod.useAppDeactivatedEvent(effect);
            return null;
        }

        renderer.act(() => {
            renderer.create(React.createElement(TestComponent));
        });

        // Set hasLaunched
        for (const l of [...changeListeners]) l('active');
        jest.advanceTimersByTime(200);

        // active should NOT trigger deactivated effect
        effect.mockClear();
        for (const l of [...changeListeners]) l('active');
        jest.advanceTimersByTime(100);
        expect(effect).not.toHaveBeenCalled();

        // background SHOULD trigger
        for (const l of [...changeListeners]) l('background');
        jest.advanceTimersByTime(100);
        expect(effect).toHaveBeenCalled();
    });
});
