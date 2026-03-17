import { createMockConfig } from '../test-utils';

describe('MfTextArea', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        const configModule = require('../../src/config');
        configModule.configureFoundation(createMockConfig());
    });

    it('renders as multiline', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfTextArea } = require('../../src/components/MfTextArea');

        const { toJSON } = render(React.createElement(MfTextArea));

        const json = toJSON();
        expect(json.props.multiline).toBe(true);
    });

    it('sets editable false when disabled', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfTextArea } = require('../../src/components/MfTextArea');

        const { toJSON } = render(
            React.createElement(MfTextArea, { disabled: true }),
        );

        const json = toJSON();
        expect(json.props.editable).toBe(false);
    });

    it('applies disabled opacity style when disabled', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfTextArea } = require('../../src/components/MfTextArea');

        const { toJSON } = render(
            React.createElement(MfTextArea, { disabled: true }),
        );

        const json = toJSON();
        const flatStyle = [].concat(...[json.props.style].flat(Infinity));
        const hasDisabledStyle = flatStyle.some((s: any) => s?.opacity === 0.5);
        expect(hasDisabledStyle).toBe(true);
    });

    it('renders placeholder text', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfTextArea } = require('../../src/components/MfTextArea');

        const { toJSON } = render(
            React.createElement(MfTextArea, { placeholder: 'Write here...' }),
        );

        const json = toJSON();
        expect(json.props.placeholder).toBe('Write here...');
    });
});
