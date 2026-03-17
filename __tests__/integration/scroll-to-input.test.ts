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
