import { createMockConfig } from '../test-utils';

describe('MFLoader', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        const configModule = require('../../src/config');
        configModule.configureFoundation(createMockConfig());
    });

    it('renders spinner icon from config', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFLoader } = require('../../src/components/MFLoader');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(React.createElement(MFLoader));
        });

        const json = tree.toJSON();
        // Look for the FontAwesomeIcon in the tree
        const findIcon = (node: any): any => {
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
        };
        const icon = findIcon(json);
        expect(icon).not.toBeNull();
        expect(icon.props.icon).toBe('spinner');
    });

    it('uses primaryButtonBackground color by default', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFLoader } = require('../../src/components/MFLoader');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(React.createElement(MFLoader));
        });

        const findIcon = (node: any): any => {
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
        };
        const icon = findIcon(tree.toJSON());
        expect(icon.props.color).toBe('#007AFF');
    });

    it('accepts custom color prop', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFLoader } = require('../../src/components/MFLoader');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MFLoader, { color: 'green' }),
            );
        });

        const findIcon = (node: any): any => {
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
        };
        const icon = findIcon(tree.toJSON());
        expect(icon.props.color).toBe('green');
    });

    it('MFLoaderView centers loader', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFLoaderView } = require('../../src/components/MFLoader');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(React.createElement(MFLoaderView));
        });

        const json = tree.toJSON();
        // Outer view should have centering styles
        const flatStyle = [].concat(...[json.props.style].flat(Infinity));
        expect(flatStyle).toContainEqual(
            expect.objectContaining({
                justifyContent: 'center',
                alignItems: 'center',
            }),
        );
    });
});
