import { createMockConfig } from '../test-utils';

describe('MfIcon', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        const configModule = require('../../src/config');
        configModule.configureFoundation(createMockConfig());
    });

    it('renders with theme default color', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfIcon } = require('../../src/components/MfIcon');

        const { toJSON } = render(
            React.createElement(MfIcon, { icon: 'star' }),
        );

        const json = toJSON();
        // FontAwesomeIcon is mocked as a string component
        expect(json.props.color).toBe('#000'); // light theme text color
    });

    it('uses custom color prop when provided', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfIcon } = require('../../src/components/MfIcon');

        const { toJSON } = render(
            React.createElement(MfIcon, { icon: 'star', color: 'red' }),
        );

        const json = toJSON();
        expect(json.props.color).toBe('red');
    });

    it('uses custom size prop when provided', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfIcon } = require('../../src/components/MfIcon');

        const { toJSON } = render(
            React.createElement(MfIcon, { icon: 'star', size: 32 }),
        );

        const json = toJSON();
        expect(json.props.size).toBe(32);
    });

    it('defaults to size 16', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfIcon } = require('../../src/components/MfIcon');

        const { toJSON } = render(
            React.createElement(MfIcon, { icon: 'star' }),
        );

        const json = toJSON();
        expect(json.props.size).toBe(16);
    });
});
