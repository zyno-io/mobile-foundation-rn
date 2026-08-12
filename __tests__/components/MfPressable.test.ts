import { createMockConfig } from '../test-utils';

describe('MfPressable', () => {
    let nowSpy: jest.SpyInstance<number, []>;
    let now = 0;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        now = 1_000_000;
        nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);

        const configModule = require('../../src/config');
        configModule.configureFoundation(createMockConfig());
    });

    afterEach(() => {
        nowSpy.mockRestore();
    });

    function renderPressable(props: any) {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfPressable } = require('../../src/components/MfPressable');
        return render(React.createElement(MfPressable, props));
    }

    it('fires the first press and swallows a rapid second press', () => {
        const onPress = jest.fn();
        const { toJSON } = renderPressable({ onPress });

        const press = toJSON().props.onPress;
        press();
        now += 120; // a real accidental double-tap lands ~100-300ms later
        press();

        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('fires the first press at time zero', () => {
        now = 0;
        const onPress = jest.fn();
        const { toJSON } = renderPressable({ onPress });

        toJSON().props.onPress();

        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('renders in isolation without reporting a configuration error', () => {
        jest.resetModules();
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfPressable } = require('../../src/components/MfPressable');
        const onPress = jest.fn();

        const { toJSON } = render(React.createElement(MfPressable, { onPress }));
        toJSON().props.onPress();

        expect(onPress).toHaveBeenCalledTimes(1);
        expect(errorSpy).not.toHaveBeenCalledWith(
            expect.stringContaining('configureFoundation() must be called before using foundation components'),
        );

        errorSpy.mockRestore();
    });

    it('swallows every press in a rapid triple-tap after the first', () => {
        const onPress = jest.fn();
        const { toJSON } = renderPressable({ onPress });

        const press = toJSON().props.onPress;
        press();
        now += 100;
        press();
        now += 100;
        press();

        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('allows a press again once the window has elapsed', () => {
        const onPress = jest.fn();
        const { toJSON } = renderPressable({ onPress });

        const press = toJSON().props.onPress;
        press();
        now += 500; // default window
        press();

        expect(onPress).toHaveBeenCalledTimes(2);
    });

    it('measures the window from the last press that fired, not the last attempt', () => {
        const onPress = jest.fn();
        const { toJSON } = renderPressable({ onPress });

        const press = toJSON().props.onPress;
        press(); // fires at t=0
        now += 400;
        press(); // swallowed
        now += 150; // t=550 — past the window opened at t=0
        press();

        expect(onPress).toHaveBeenCalledTimes(2);
    });

    it('opts out of throttling entirely when pressThrottleMs is 0', () => {
        const onPress = jest.fn();
        const { toJSON } = renderPressable({ onPress, pressThrottleMs: 0 });

        const press = toJSON().props.onPress;
        press();
        press();
        press();

        expect(onPress).toHaveBeenCalledTimes(3);
    });

    it('honors an explicit pressThrottleMs over the default', () => {
        const onPress = jest.fn();
        const { toJSON } = renderPressable({ onPress, pressThrottleMs: 2000 });

        const press = toJSON().props.onPress;
        press();
        now += 600; // past the 500ms default, inside the explicit 2000ms
        press();

        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('honors defaults.pressThrottleMs from the foundation config', () => {
        const { configureFoundation } = require('../../src/config');
        configureFoundation(createMockConfig({ defaults: { pressThrottleMs: 1500 } }));

        const onPress = jest.fn();
        const { toJSON } = renderPressable({ onPress });

        const press = toJSON().props.onPress;
        press();
        now += 600;
        press();

        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('guards each instance independently', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfPressable } = require('../../src/components/MfPressable');

        const onPressA = jest.fn();
        const onPressB = jest.fn();

        const { toJSON } = render(
            React.createElement(
                'View',
                null,
                React.createElement(MfPressable, { key: 'a', testID: 'a', onPress: onPressA }),
                React.createElement(MfPressable, { key: 'b', testID: 'b', onPress: onPressB }),
            ),
        );

        const [a, b] = toJSON().children;
        a.props.onPress();
        b.props.onPress();

        expect(onPressA).toHaveBeenCalledTimes(1);
        expect(onPressB).toHaveBeenCalledTimes(1);
    });

    it('calls the latest handler after a re-render, not a stale closure', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfPressable } = require('../../src/components/MfPressable');

        const first = jest.fn();
        const second = jest.fn();

        const { toJSON, rerender } = render(React.createElement(MfPressable, { onPress: first }));
        rerender(React.createElement(MfPressable, { onPress: second }));

        toJSON().props.onPress();

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('passes the press event through to the handler', () => {
        const onPress = jest.fn();
        const { toJSON } = renderPressable({ onPress });

        const event = { nativeEvent: { locationX: 5 } };
        toJSON().props.onPress(event);

        expect(onPress).toHaveBeenCalledWith(event);
    });

    it('leaves onPress unset when no handler is given', () => {
        const { toJSON } = renderPressable({ testID: 'bare' });
        expect(toJSON().props.onPress).toBeUndefined();
    });

    it('does not intercept other props', () => {
        const onLongPress = jest.fn();
        const { toJSON } = renderPressable({ onPress: jest.fn(), onLongPress, disabled: true, testID: 'x' });

        const json = toJSON();
        expect(json.props.onLongPress).toBe(onLongPress);
        expect(json.props.disabled).toBe(true);
        expect(json.props.testID).toBe('x');
    });
});
