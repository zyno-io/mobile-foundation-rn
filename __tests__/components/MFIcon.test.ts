import { createMockConfig } from '../test-utils';

describe('MFIcon', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        const configModule = require('../../src/config');
        configModule.configureFoundation(createMockConfig());
    });

    it('renders with theme default color', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFIcon } = require('../../src/components/MFIcon');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MFIcon, { icon: 'star' }),
            );
        });

        const json = tree.toJSON();
        // FontAwesomeIcon is mocked as a string component
        expect(json.props.color).toBe('#000'); // light theme text color
    });

    it('uses custom color prop when provided', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFIcon } = require('../../src/components/MFIcon');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MFIcon, { icon: 'star', color: 'red' }),
            );
        });

        const json = tree.toJSON();
        expect(json.props.color).toBe('red');
    });

    it('uses custom size prop when provided', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFIcon } = require('../../src/components/MFIcon');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MFIcon, { icon: 'star', size: 32 }),
            );
        });

        const json = tree.toJSON();
        expect(json.props.size).toBe(32);
    });

    it('defaults to size 16', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFIcon } = require('../../src/components/MFIcon');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MFIcon, { icon: 'star' }),
            );
        });

        const json = tree.toJSON();
        expect(json.props.size).toBe(16);
    });
});
