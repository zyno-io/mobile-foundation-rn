import { createMockConfig } from '../test-utils';

describe('MfButton', () => {
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

    it('renders text label', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfButton } = require('../../src/components/MfButton');

        const { toJSON } = render(
            React.createElement(MfButton, { text: 'Submit' }),
        );

        const json = toJSON();
        const texts = findAllByType(json, 'Text');
        const label = texts.find((t: any) => t.children?.includes('Submit'));
        expect(label).toBeDefined();
    });

    it('renders icon when icon prop provided', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfButton } = require('../../src/components/MfButton');

        const { toJSON } = render(
            React.createElement(MfButton, { icon: 'plus', text: 'Add' }),
        );

        const json = toJSON();
        const icon = findByType(json, 'FontAwesomeIcon');
        expect(icon).not.toBeNull();
    });

    it('renders children instead of text when provided', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfButton } = require('../../src/components/MfButton');

        const { toJSON } = render(
            React.createElement(
                MfButton,
                { text: 'Ignored' },
                React.createElement('View', { testID: 'custom-child' }),
            ),
        );

        const json = toJSON();
        // text should not render when children present
        const texts = findAllByType(json, 'Text');
        const label = texts.find((t: any) => t.children?.includes('Ignored'));
        expect(label).toBeUndefined();
    });

    it('applies primary button styles when primary prop is true', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfButton } = require('../../src/components/MfButton');

        const { toJSON } = render(
            React.createElement(MfButton, { primary: true, text: 'Primary' }),
        );

        const json = toJSON();
        // The button style should contain primaryButton background
        const flatStyle = [].concat(...[json.props.style].flat(Infinity).filter(Boolean));
        const hasPrimaryBg = flatStyle.some(
            (s: any) => s?.backgroundColor === '#007AFF',
        );
        expect(hasPrimaryBg).toBe(true);
    });

    it('applies disabled opacity when disabled', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfButton } = require('../../src/components/MfButton');

        const { toJSON } = render(
            React.createElement(MfButton, { disabled: true, text: 'Disabled' }),
        );

        const json = toJSON();
        const flatStyle = [].concat(...[json.props.style].flat(Infinity).filter(Boolean));
        const hasDisabled = flatStyle.some((s: any) => s?.opacity === 0.5);
        expect(hasDisabled).toBe(true);
    });
});
