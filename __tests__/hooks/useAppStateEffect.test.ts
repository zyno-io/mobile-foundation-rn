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
        const { render, act } = require('@testing-library/react-native/pure');

        const effect = jest.fn();

        function TestComponent() {
            mod.useAppStateEffect(effect);
            return null;
        }

        render(React.createElement(TestComponent));

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
        const { render, act } = require('@testing-library/react-native/pure');

        const effect = jest.fn();

        function TestComponent() {
            mod.useAppActivatedEffect(effect);
            return null;
        }

        render(React.createElement(TestComponent));

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
        const { render, act } = require('@testing-library/react-native/pure');

        const effect = jest.fn();

        function TestComponent() {
            mod.useAppDeactivatedEvent(effect);
            return null;
        }

        render(React.createElement(TestComponent));

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

    it('does not re-subscribe across renders when deps are stable', () => {
        const mod = require('../../src/hooks/useAppStateEffect');
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');

        function TestComponent({ effect }: { effect: () => void }) {
            // New effect identity each render, but a stable (empty) deps array.
            mod.useAppStateEffect(effect, []);
            return null;
        }

        const addEventListener = AppState.addEventListener as jest.Mock;
        const callsBeforeMount = addEventListener.mock.calls.length;
        const { rerender } = render(React.createElement(TestComponent, { effect: jest.fn() }));
        const callsAfterMount = addEventListener.mock.calls.length;

        // Re-render with a brand-new effect function — stable deps must NOT re-subscribe.
        rerender(React.createElement(TestComponent, { effect: jest.fn() }));
        const callsAfterRerender = addEventListener.mock.calls.length;

        expect(callsAfterMount).toBe(callsBeforeMount + 1); // subscribed once on mount
        expect(callsAfterRerender).toBe(callsAfterMount); // stable deps → no re-subscribe
    });

    it('re-subscribes when effect identity changes and no deps are given', () => {
        const mod = require('../../src/hooks/useAppStateEffect');
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');

        function TestComponent({ effect }: { effect: () => void }) {
            // No deps → falls back to [effect], preserving the original behavior.
            mod.useAppStateEffect(effect);
            return null;
        }

        const addEventListener = AppState.addEventListener as jest.Mock;
        const { rerender } = render(React.createElement(TestComponent, { effect: jest.fn() }));
        const callsAfterMount = addEventListener.mock.calls.length;

        rerender(React.createElement(TestComponent, { effect: jest.fn() }));
        const callsAfterRerender = addEventListener.mock.calls.length;

        expect(callsAfterRerender).toBe(callsAfterMount + 1); // effect changed → re-subscribed
    });

    it('re-subscribes only when a dep value changes', () => {
        const mod = require('../../src/hooks/useAppStateEffect');
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');

        const effect = jest.fn(); // stable effect; subscription keyed on deps
        function TestComponent({ dep }: { dep: number }) {
            mod.useAppStateEffect(effect, [dep]);
            return null;
        }

        const addEventListener = AppState.addEventListener as jest.Mock;
        const { rerender } = render(React.createElement(TestComponent, { dep: 1 }));
        const callsAfterMount = addEventListener.mock.calls.length;

        rerender(React.createElement(TestComponent, { dep: 2 }));
        const callsAfterChange = addEventListener.mock.calls.length;

        rerender(React.createElement(TestComponent, { dep: 2 }));
        const callsAfterSame = addEventListener.mock.calls.length;

        expect(callsAfterChange).toBe(callsAfterMount + 1); // dep changed → re-subscribe
        expect(callsAfterSame).toBe(callsAfterChange); // dep unchanged → no re-subscribe
    });

    it('useAppActivatedEffect forwards deps to the underlying subscription', () => {
        const mod = require('../../src/hooks/useAppStateEffect');
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');

        function TestComponent({ effect }: { effect: () => void }) {
            mod.useAppActivatedEffect(effect, []);
            return null;
        }

        const addEventListener = AppState.addEventListener as jest.Mock;
        const { rerender } = render(React.createElement(TestComponent, { effect: jest.fn() }));
        const callsAfterMount = addEventListener.mock.calls.length;

        rerender(React.createElement(TestComponent, { effect: jest.fn() }));
        expect(addEventListener.mock.calls.length).toBe(callsAfterMount); // stable deps → no re-subscribe
    });
});
