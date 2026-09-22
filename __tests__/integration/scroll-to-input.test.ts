import { createMockConfig } from '../test-utils';

describe('MfScrollView + MfTextInput auto-scroll', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        const configModule = require('../../src/config');
        configModule.configureFoundation(createMockConfig());
    });

    it('sets active text input context on focus', () => {
        const { MfActiveTextInputContext, setMfActiveTextInput, unsetMfActiveTextInput } =
            require('../../src/hooks/useMfActiveInput');

        const mockInput = { focus: jest.fn() } as any;

        expect(MfActiveTextInputContext.input).toBeNull();

        setMfActiveTextInput(mockInput);
        expect(MfActiveTextInputContext.input).toBe(mockInput);

        unsetMfActiveTextInput(mockInput);
        expect(MfActiveTextInputContext.input).toBeNull();
    });

    it('unsetMfActiveTextInput only clears if same input', () => {
        const { MfActiveTextInputContext, setMfActiveTextInput, unsetMfActiveTextInput } =
            require('../../src/hooks/useMfActiveInput');

        const input1 = { focus: jest.fn() } as any;
        const input2 = { focus: jest.fn() } as any;

        setMfActiveTextInput(input1);
        unsetMfActiveTextInput(input2); // different input
        expect(MfActiveTextInputContext.input).toBe(input1); // should not clear
    });

    it('MfWrapperView measures layout on mount', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfWrapperView } = require('../../src/components/MfWrapperView');

        const { toJSON } = render(
            React.createElement(MfWrapperView, null,
                React.createElement('View', { testID: 'inner' }),
            ),
        );

        // The component should render without error
        expect(toJSON()).not.toBeNull();
    });

    function findNode(node: any, type: string): any {
        if (!node) return null;
        if (node.type === type) return node;
        if (node.children) {
            for (const child of node.children) {
                if (typeof child === 'object') {
                    const found = findNode(child, type);
                    if (found) return found;
                }
            }
        }
        return null;
    }

    /**
     * Renders an MfScrollView whose native ScrollView ref is a mock, with `input` registered as the
     * active text input. Returns the ScrollView's props plus the mock so tests can drive layout/scroll.
     */
    function renderScrollViewWithActiveInput(input: any, extraProps: Record<string, unknown> = {}) {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfScrollView } = require('../../src/components/MfScrollView');
        const { setMfActiveTextInput } = require('../../src/hooks/useMfActiveInput');

        const scrollTo = jest.fn();
        const { toJSON } = render(
            React.createElement(MfScrollView, extraProps, React.createElement('View', null)),
            { createNodeMock: (el: any) => (el.type === 'ScrollView' ? { scrollTo } : null) },
        );
        setMfActiveTextInput(input);

        const scrollView = findNode(toJSON(), 'ScrollView');
        return { props: scrollView.props, scrollTo };
    }

    const layoutEvent = (height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height } } });
    const scrollEvent = (y: number) => ({ nativeEvent: { contentOffset: { x: 0, y } } });

    it('scrolls an occluded input into view using content-relative coordinates (no double-counted offset)', () => {
        // input at content y=700, 50 tall; scroll view already scrolled to 300 and now 400 tall (keyboard open)
        const input = { measureLayout: jest.fn((_rel: any, cb: any) => cb(0, 700, 300, 50)) };
        const { props, scrollTo } = renderScrollViewWithActiveInput(input);

        props.onScroll(scrollEvent(300));
        props.onLayout(layoutEvent(400));

        // bottom (750) + 10px padding must land at the viewport bottom → offset 360, NOT 360 + 300
        expect(scrollTo).toHaveBeenCalledTimes(1);
        expect(scrollTo).toHaveBeenCalledWith({ y: 360, animated: true });
    });

    it('does not scroll when the active input is already fully visible', () => {
        // input at content y=400..450; viewport shows 300..700
        const input = { measureLayout: jest.fn((_rel: any, cb: any) => cb(0, 400, 300, 50)) };
        const { props, scrollTo } = renderScrollViewWithActiveInput(input);

        props.onScroll(scrollEvent(300));
        props.onLayout(layoutEvent(400));

        expect(scrollTo).not.toHaveBeenCalled();
    });

    it('does nothing on layout when no input is active', () => {
        const { props, scrollTo } = renderScrollViewWithActiveInput(null);
        props.onLayout(layoutEvent(400));
        expect(scrollTo).not.toHaveBeenCalled();
    });

    it('still forwards onLayout and onScroll to the consumer', () => {
        const onLayout = jest.fn();
        const onScroll = jest.fn();
        const input = { measureLayout: jest.fn() };
        const { props } = renderScrollViewWithActiveInput(input, { onLayout, onScroll });

        props.onScroll(scrollEvent(10));
        props.onLayout(layoutEvent(400));

        expect(onScroll).toHaveBeenCalledTimes(1);
        expect(onLayout).toHaveBeenCalledTimes(1);
    });

    it('MfScrollView renders with flex:1 by default', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfScrollView } = require('../../src/components/MfScrollView');

        const { toJSON } = render(
            React.createElement(MfScrollView, null,
                React.createElement('View', null),
            ),
        );

        const scrollView = findNode(toJSON(), 'ScrollView');
        expect(scrollView).not.toBeNull();
        const flatStyle = [].concat(...[scrollView.props.style].flat(Infinity));
        const hasFlex = flatStyle.some((s: any) => s?.flex === 1);
        expect(hasFlex).toBe(true);
    });

    it('MfScrollView sets keyboardShouldPersistTaps to handled', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfScrollView } = require('../../src/components/MfScrollView');

        const { toJSON } = render(
            React.createElement(MfScrollView, null,
                React.createElement('View', null),
            ),
        );

        const scrollView = findNode(toJSON(), 'ScrollView');
        expect(scrollView.props.keyboardShouldPersistTaps).toBe('handled');
    });

    it('MfScrollView disables overscroll by default', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfScrollView } = require('../../src/components/MfScrollView');

        const { toJSON } = render(
            React.createElement(MfScrollView, null,
                React.createElement('View', null),
            ),
        );

        const scrollView = findNode(toJSON(), 'ScrollView');
        expect(scrollView.props.overScrollMode).toBe('never');
        expect(scrollView.props.alwaysBounceVertical).toBe(false);
    });

    it('MfScrollView allows overscroll when allowOverscroll is true', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfScrollView } = require('../../src/components/MfScrollView');

        const { toJSON } = render(
            React.createElement(MfScrollView, { allowOverscroll: true },
                React.createElement('View', null),
            ),
        );

        const scrollView = findNode(toJSON(), 'ScrollView');
        expect(scrollView.props.overScrollMode).toBeUndefined();
    });
});
