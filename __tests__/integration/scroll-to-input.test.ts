import { createMockConfig } from '../test-utils';

describe('MFScrollView + MFTextInput auto-scroll', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        const configModule = require('../../src/config');
        configModule.configureFoundation(createMockConfig());
    });

    it('sets active text input context on focus', () => {
        const { MFActiveTextInputContext, setMFActiveTextInput, unsetMFActiveTextInput } =
            require('../../src/hooks/useMfActiveInput');

        const mockInput = { focus: jest.fn() } as any;

        expect(MFActiveTextInputContext.input).toBeNull();

        setMFActiveTextInput(mockInput);
        expect(MFActiveTextInputContext.input).toBe(mockInput);

        unsetMFActiveTextInput(mockInput);
        expect(MFActiveTextInputContext.input).toBeNull();
    });

    it('unsetMFActiveTextInput only clears if same input', () => {
        const { MFActiveTextInputContext, setMFActiveTextInput, unsetMFActiveTextInput } =
            require('../../src/hooks/useMfActiveInput');

        const input1 = { focus: jest.fn() } as any;
        const input2 = { focus: jest.fn() } as any;

        setMFActiveTextInput(input1);
        unsetMFActiveTextInput(input2); // different input
        expect(MFActiveTextInputContext.input).toBe(input1); // should not clear
    });

    it('MFWrapperView measures layout on mount', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFWrapperView } = require('../../src/components/MFWrapperView');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MFWrapperView, null,
                    React.createElement('View', { testID: 'inner' }),
                ),
            );
        });

        // The component should render without error
        expect(tree.toJSON()).not.toBeNull();
    });

    it('MFScrollView renders with flex:1 by default', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFScrollView } = require('../../src/components/MFScrollView');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MFScrollView, null,
                    React.createElement('View', null),
                ),
            );
        });

        const json = tree.toJSON();
        // Find the ScrollView in the tree
        const findNode = (node: any, type: string): any => {
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
        };

        const scrollView = findNode(json, 'ScrollView');
        expect(scrollView).not.toBeNull();
        const flatStyle = [].concat(...[scrollView.props.style].flat(Infinity));
        const hasFlex = flatStyle.some((s: any) => s?.flex === 1);
        expect(hasFlex).toBe(true);
    });

    it('MFScrollView sets keyboardShouldPersistTaps to handled', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFScrollView } = require('../../src/components/MFScrollView');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MFScrollView, null,
                    React.createElement('View', null),
                ),
            );
        });

        const findNode = (node: any, type: string): any => {
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
        };

        const scrollView = findNode(tree.toJSON(), 'ScrollView');
        expect(scrollView.props.keyboardShouldPersistTaps).toBe('handled');
    });

    it('MFScrollView disables overscroll by default', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFScrollView } = require('../../src/components/MFScrollView');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MFScrollView, null,
                    React.createElement('View', null),
                ),
            );
        });

        const findNode = (node: any, type: string): any => {
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
        };

        const scrollView = findNode(tree.toJSON(), 'ScrollView');
        expect(scrollView.props.overScrollMode).toBe('never');
        expect(scrollView.props.alwaysBounceVertical).toBe(false);
    });

    it('MFScrollView allows overscroll when allowOverscroll is true', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFScrollView } = require('../../src/components/MFScrollView');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MFScrollView, { allowOverscroll: true },
                    React.createElement('View', null),
                ),
            );
        });

        const findNode = (node: any, type: string): any => {
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
        };

        const scrollView = findNode(tree.toJSON(), 'ScrollView');
        expect(scrollView.props.overScrollMode).toBeUndefined();
    });
});
