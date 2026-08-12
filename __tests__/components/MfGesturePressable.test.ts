import { createMockConfig } from '../test-utils';

// The throttle itself is exhaustively covered in MfPressable.test.ts — both
// components share useThrottledPress. What matters here is that the guard is
// wired up and that it stays on react-native-gesture-handler's Pressable, since
// the two implementations are not interchangeable at the call site.
describe('MfGesturePressable', () => {
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
        const { MfGesturePressable } = require('../../src/components/MfGesturePressable');
        return render(React.createElement(MfGesturePressable, props));
    }

    it('fires the first press and swallows a rapid second press', () => {
        const onPress = jest.fn();
        const { toJSON } = renderPressable({ onPress });

        const press = toJSON().props.onPress;
        press();
        now += 120;
        press();

        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('allows a press again once the window has elapsed', () => {
        const onPress = jest.fn();
        const { toJSON } = renderPressable({ onPress });

        const press = toJSON().props.onPress;
        press();
        now += 500;
        press();

        expect(onPress).toHaveBeenCalledTimes(2);
    });

    it('opts out of throttling entirely when pressThrottleMs is 0', () => {
        const onPress = jest.fn();
        const { toJSON } = renderPressable({ onPress, pressThrottleMs: 0 });

        const press = toJSON().props.onPress;
        press();
        press();

        expect(onPress).toHaveBeenCalledTimes(2);
    });

    it('renders the gesture-handler Pressable, not the react-native one', () => {
        const gestureHandler = require('react-native-gesture-handler');
        const spy = jest.spyOn(gestureHandler, 'Pressable');

        renderPressable({ onPress: jest.fn() });

        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('passes gesture relation props straight through', () => {
        const simultaneousWith = { __gesture: true };
        const { toJSON } = renderPressable({ onPress: jest.fn(), simultaneousWith, testID: 'x' });

        const json = toJSON();
        expect(json.props.simultaneousWith).toBe(simultaneousWith);
        expect(json.props.testID).toBe('x');
    });

    it('leaves onPress unset when no handler is given', () => {
        const { toJSON } = renderPressable({ testID: 'bare' });
        expect(toJSON().props.onPress).toBeUndefined();
    });
});
