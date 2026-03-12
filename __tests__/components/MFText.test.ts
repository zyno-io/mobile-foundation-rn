import { createMockConfig } from '../test-utils';

describe('MFText', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        const configModule = require('../../src/config');
        configModule.configureFoundation(createMockConfig());
    });

    it('renders with text color from theme', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFText } = require('../../src/components/MFText');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(React.createElement(MFText, null, 'Hello'));
        });

        const json = tree.toJSON();
        expect(json.type).toBe('Text');
        expect(json.children).toContain('Hello');
        // Default light theme text color
        const flatStyle = [].concat(...[json.props.style].flat(Infinity));
        const colorStyle = flatStyle.find((s: any) => s?.color);
        expect(colorStyle.color).toBe('#000');
    });

    it('applies maxFontSizeMultiplier of 1.5', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFText } = require('../../src/components/MFText');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(React.createElement(MFText, null, 'Test'));
        });

        const json = tree.toJSON();
        expect(json.props.maxFontSizeMultiplier).toBe(1.5);
    });

    it('merges custom style with defaults', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFText } = require('../../src/components/MFText');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MFText, { style: { fontSize: 24 } }, 'Big'),
            );
        });

        const json = tree.toJSON();
        const flatStyle = [].concat(...[json.props.style].flat(Infinity));
        const customStyle = flatStyle.find((s: any) => s?.fontSize === 24);
        expect(customStyle).toBeDefined();
    });

    it('MFStatusTextView centers content', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFStatusTextView } = require('../../src/components/MFText');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MFStatusTextView, null, 'Status'),
            );
        });

        const json = tree.toJSON();
        // Outer View should have centering styles
        expect(json.type).toBe('View');
        expect(json.props.style.alignItems).toBe('center');
        expect(json.props.style.justifyContent).toBe('center');
    });
});
