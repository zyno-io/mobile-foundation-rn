import { createMockConfig } from '../test-utils';

describe('MfLoader', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        const configModule = require('../../src/config');
        configModule.configureFoundation(createMockConfig());
    });

    function findIcon(node: any): any {
        if (!node) return null;
        if (node.type === 'FontAwesomeIcon') return node;
        if (node.children) {
            for (const child of node.children) {
                if (typeof child === 'object') {
                    const found = findIcon(child);
                    if (found) return found;
                }
            }
        }
        return null;
    }

    it('renders spinner icon from config', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfLoader } = require('../../src/components/MfLoader');

        const { toJSON } = render(React.createElement(MfLoader));

        const icon = findIcon(toJSON());
        expect(icon).not.toBeNull();
        expect(icon.props.icon).toBe('spinner');
    });

    it('uses primaryButtonBackground color by default', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfLoader } = require('../../src/components/MfLoader');

        const { toJSON } = render(React.createElement(MfLoader));

        const icon = findIcon(toJSON());
        expect(icon.props.color).toBe('#007AFF');
    });

    it('accepts custom color prop', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfLoader } = require('../../src/components/MfLoader');

        const { toJSON } = render(
            React.createElement(MfLoader, { color: 'green' }),
        );

        const icon = findIcon(toJSON());
        expect(icon.props.color).toBe('green');
    });

    it('MfLoaderView centers loader', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfLoaderView } = require('../../src/components/MfLoader');

        const { toJSON } = render(React.createElement(MfLoaderView));

        const json = toJSON();
        // Outer view should have centering styles
        const flatStyle = [].concat(...[json.props.style].flat(Infinity));
        expect(flatStyle).toContainEqual(
            expect.objectContaining({
                justifyContent: 'center',
                alignItems: 'center',
            }),
        );
    });

    it('defaults the background wrapper color when none configured', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { MfLoader } = require('../../src/components/MfLoader');

        const { toJSON } = render(
            React.createElement(MfLoader, { background: true }),
        );

        const json = toJSON();
        const flatStyle = [].concat(...[json.props.style].flat(Infinity).filter(Boolean));
        const bgStyle = flatStyle.find((s: any) => s?.backgroundColor);
        expect(bgStyle.backgroundColor).toBe('rgba(255, 255, 255, 0.25)');
    });

    it('uses configured loader background color', () => {
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');
        const { configureFoundation } = require('../../src/config');
        configureFoundation(
            createMockConfig({
                defaults: { loader: { backgroundColor: 'rgba(10, 20, 30, 0.5)' } },
            }),
        );
        const { MfLoader } = require('../../src/components/MfLoader');

        const { toJSON } = render(
            React.createElement(MfLoader, { background: true }),
        );

        const json = toJSON();
        const flatStyle = [].concat(...[json.props.style].flat(Infinity).filter(Boolean));
        const bgStyle = flatStyle.find((s: any) => s?.backgroundColor);
        expect(bgStyle.backgroundColor).toBe('rgba(10, 20, 30, 0.5)');
    });
});
