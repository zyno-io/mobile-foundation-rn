import { createMockConfig } from '../test-utils';

describe('MfTextInput', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        const configModule = require('../../src/config');
        configModule.configureFoundation(createMockConfig());
    });

    function findByType(node: any, type: string): any {
        if (!node) return null;
        if (node.type === type) return node;
        if (node.children) {
            for (const child of node.children) {
                if (typeof child === 'object') {
                    const found = findByType(child, type);
                    if (found) return found;
                }
            }
        }
        return null;
    }

    function findAllByType(node: any, type: string): any[] {
        const results: any[] = [];
        if (!node) return results;
        if (node.type === type) results.push(node);
        if (node.children) {
            for (const child of node.children) {
                if (typeof child === 'object') {
                    results.push(...findAllByType(child, type));
                }
            }
        }
        return results;
    }

    it('renders placeholder', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MfTextInput } = require('../../src/components/MfTextInput');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MfTextInput, { placeholder: 'Enter name' }),
            );
        });

        const input = findByType(tree.toJSON(), 'TextInput');
        expect(input.props.placeholder).toBe('Enter name');
    });

    it('renders label above input', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MfTextInput } = require('../../src/components/MfTextInput');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MfTextInput, { label: 'Name' }),
            );
        });

        const texts = findAllByType(tree.toJSON(), 'Text');
        const label = texts.find((t: any) => t.children?.includes('Name'));
        expect(label).toBeDefined();
    });

    it('sets editable to false when disabled', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MfTextInput } = require('../../src/components/MfTextInput');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MfTextInput, { disabled: true }),
            );
        });

        const input = findByType(tree.toJSON(), 'TextInput');
        expect(input.props.editable).toBe(false);
    });

    it('applies maxFontSizeMultiplier of 1.5', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MfTextInput } = require('../../src/components/MfTextInput');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(React.createElement(MfTextInput));
        });

        const input = findByType(tree.toJSON(), 'TextInput');
        expect(input.props.maxFontSizeMultiplier).toBe(1.5);
    });

    it('phone mask formats input via onChangeText', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MfTextInput } = require('../../src/components/MfTextInput');

        const onChangeText = jest.fn();
        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MfTextInput, {
                    mask: 'phone',
                    onChangeText,
                }),
            );
        });

        const input = findByType(tree.toJSON(), 'TextInput');
        // Simulate text change
        renderer.act(() => {
            input.props.onChangeText('5551234567');
        });

        expect(onChangeText).toHaveBeenCalledWith('(555) 123-4567');
    });

    it('currency mask formats input via onChangeText', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MfTextInput } = require('../../src/components/MfTextInput');

        const onChangeText = jest.fn();
        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MfTextInput, {
                    mask: 'currency',
                    onChangeText,
                }),
            );
        });

        const input = findByType(tree.toJSON(), 'TextInput');
        renderer.act(() => {
            input.props.onChangeText('12345');
        });

        expect(onChangeText).toHaveBeenCalledWith('$12345');
    });

    it('renders icon with padding when icon prop provided', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MfTextInput } = require('../../src/components/MfTextInput');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MfTextInput, { icon: 'search' }),
            );
        });

        const json = tree.toJSON();
        const icon = findByType(json, 'FontAwesomeIcon');
        expect(icon).not.toBeNull();

        // Input should have icon padding style
        const input = findByType(json, 'TextInput');
        const flatStyle = [].concat(...[input.props.style].flat(Infinity));
        const hasIconPadding = flatStyle.some((s: any) => s?.paddingLeft === 36);
        expect(hasIconPadding).toBe(true);
    });
});
