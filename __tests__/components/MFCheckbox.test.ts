import { createMockConfig } from '../test-utils';

describe('MFCheckbox', () => {
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

    it('renders label text', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFCheckbox } = require('../../src/components/MFCheckbox');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MFCheckbox, { label: 'Accept terms' }),
            );
        });

        const json = tree.toJSON();
        const texts = findAllByType(json, 'Text');
        const labelText = texts.find((t: any) =>
            t.children?.includes('Accept terms'),
        );
        expect(labelText).toBeDefined();
    });

    it('shows check icon when value is true', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFCheckbox } = require('../../src/components/MFCheckbox');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MFCheckbox, { value: true, label: 'Check' }),
            );
        });

        const json = tree.toJSON();
        const icon = findByType(json, 'FontAwesomeIcon');
        expect(icon).not.toBeNull();
    });

    it('hides check icon when value is false', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFCheckbox } = require('../../src/components/MFCheckbox');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(MFCheckbox, { value: false, label: 'Check' }),
            );
        });

        const json = tree.toJSON();
        const icon = findByType(json, 'FontAwesomeIcon');
        expect(icon).toBeNull();
    });

    it('renders children with margin wrapper', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MFCheckbox } = require('../../src/components/MFCheckbox');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(
                React.createElement(
                    MFCheckbox,
                    { label: 'Parent' },
                    React.createElement('View', { testID: 'child' }),
                ),
            );
        });

        const json = tree.toJSON();
        // Find the children wrapper view with marginLeft
        const views = findAllByType(json, 'View');
        const childWrapper = views.find((v: any) => {
            const style = v.props?.style;
            if (!style) return false;
            const flatStyle = [].concat(...[style].flat(Infinity));
            return flatStyle.some((s: any) => s?.marginLeft === 32);
        });
        expect(childWrapper).toBeDefined();
    });
});
