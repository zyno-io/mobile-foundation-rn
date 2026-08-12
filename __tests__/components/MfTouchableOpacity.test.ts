import { createMockConfig } from '../test-utils';

describe('MfTouchableOpacity', () => {
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

    function renderTouchable(props: any) {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfTouchableOpacity } = require('../../src/components/MfTouchableOpacity');
        return render(React.createElement(MfTouchableOpacity, props));
    }

    it('fires the first press and swallows a rapid second press', () => {
        const onPress = jest.fn();
        const { toJSON } = renderTouchable({ onPress });

        const press = toJSON().props.onPress;
        press();
        now += 120;
        press();

        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('allows a press again once the window has elapsed', () => {
        const onPress = jest.fn();
        const { toJSON } = renderTouchable({ onPress });

        const press = toJSON().props.onPress;
        press();
        now += 500;
        press();

        expect(onPress).toHaveBeenCalledTimes(2);
    });

    it('opts out of throttling entirely when pressThrottleMs is 0', () => {
        const onPress = jest.fn();
        const { toJSON } = renderTouchable({ onPress, pressThrottleMs: 0 });

        const press = toJSON().props.onPress;
        press();
        press();

        expect(onPress).toHaveBeenCalledTimes(2);
    });

    it('does not intercept other props', () => {
        const { toJSON } = renderTouchable({ onPress: jest.fn(), activeOpacity: 0.5, testID: 'x' });

        const json = toJSON();
        expect(json.props.activeOpacity).toBe(0.5);
        expect(json.props.testID).toBe('x');
    });

    it('leaves onPress unset when no handler is given', () => {
        const { toJSON } = renderTouchable({ testID: 'bare' });
        expect(toJSON().props.onPress).toBeUndefined();
    });
});
