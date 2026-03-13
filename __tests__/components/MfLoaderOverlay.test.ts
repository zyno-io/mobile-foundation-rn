import { createMockConfig } from '../test-utils';

describe('MfLoaderOverlay', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        const configModule = require('../../src/config');
        configModule.configureFoundation(createMockConfig());
    });

    it('GlobalLoaderOverlay returns null when loaderCount is 0', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { GlobalLoaderOverlay } = require('../../src/components/MfLoaderOverlay');
        const { LoaderState } = require('../../src/helpers/observable');
        LoaderState.loaderCount = 0;

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(React.createElement(GlobalLoaderOverlay));
        });

        expect(tree.toJSON()).toBeNull();
    });

    it('GlobalLoaderOverlay renders when loaderCount > 0', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { GlobalLoaderOverlay } = require('../../src/components/MfLoaderOverlay');
        const { LoaderState } = require('../../src/helpers/observable');
        LoaderState.loaderCount = 1;

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(React.createElement(GlobalLoaderOverlay));
        });

        expect(tree.toJSON()).not.toBeNull();
        // Reset
        LoaderState.loaderCount = 0;
    });

    it('MfLoaderOverlay has absolute positioning for full screen overlay', () => {
        const React = require('react');
        const renderer = require('react-test-renderer');
        const { MfLoaderOverlay } = require('../../src/components/MfLoaderOverlay');

        let tree: any;
        renderer.act(() => {
            tree = renderer.create(React.createElement(MfLoaderOverlay));
        });

        const json = tree.toJSON();
        const flatStyle = [].concat(...[json.props.style].flat(Infinity));
        expect(flatStyle).toContainEqual(
            expect.objectContaining({
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
            }),
        );
    });
});
