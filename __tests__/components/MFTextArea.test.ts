import { createMockConfig } from '../test-utils';

describe('MFTextArea', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        const configModule = require('../../src/config');
        configModule.configureFoundation(createMockConfig());
    });

    it('renders as multiline', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFTextArea } = require('../../src/components/MFTextArea');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(React.createElement(MFTextArea));
        });

        const json = tree.toJSON();
        expect(json.props.multiline).toBe(true);
    });

    it('sets editable false when disabled', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFTextArea } = require('../../src/components/MFTextArea');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MFTextArea, { disabled: true }),
            );
        });

        const json = tree.toJSON();
        expect(json.props.editable).toBe(false);
    });

    it('applies disabled opacity style when disabled', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFTextArea } = require('../../src/components/MFTextArea');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MFTextArea, { disabled: true }),
            );
        });

        const json = tree.toJSON();
        const flatStyle = [].concat(...[json.props.style].flat(Infinity));
        const hasDisabledStyle = flatStyle.some((s: any) => s?.opacity === 0.5);
        expect(hasDisabledStyle).toBe(true);
    });

    it('renders placeholder text', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFTextArea } = require('../../src/components/MFTextArea');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MFTextArea, { placeholder: 'Write here...' }),
            );
        });

        const json = tree.toJSON();
        expect(json.props.placeholder).toBe('Write here...');
    });
});
