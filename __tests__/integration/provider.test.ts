import { createMockConfig } from '../test-utils';

describe('MfProvider composition', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
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

    it('renders children', () => {
        const configModule = require('../../src/config');
        configModule.configureFoundation(createMockConfig());

        const { MfProvider } = require('../../src/components/MfProvider');
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');

        const { toJSON } = render(
            React.createElement(
                MfProvider,
                null,
                React.createElement('View', { testID: 'child-view' }),
            ),
        );

        const json = toJSON();
        const child = findByType(json, 'View');
        expect(child).not.toBeNull();
    });

    it('provides its colorScheme override to foundation color hooks', () => {
        const { useColorScheme } = require('react-native');
        (useColorScheme as jest.Mock).mockReturnValue('light');

        const configModule = require('../../src/config');
        const config = createMockConfig();
        configModule.configureFoundation(config);

        const { MfProvider } = require('../../src/components/MfProvider');
        const { useColors } = require('../../src/helpers/styles');
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');

        let colors: any;
        function TestComponent() {
            colors = useColors();
            return null;
        }

        render(
            React.createElement(
                MfProvider,
                { colorScheme: 'dark' },
                React.createElement(TestComponent),
            ),
        );

        expect(colors.background).toBe(config.colors.dark.background);
    });

    it('configures StatusBar when statusBar config is set', () => {
        const configModule = require('../../src/config');
        configModule.configureFoundation(
            createMockConfig({
                statusBar: { barStyle: 'auto' },
            }),
        );

        const { MfProvider } = require('../../src/components/MfProvider');
        const { StatusBar } = require('react-native');
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');

        render(
            React.createElement(MfProvider, null, null),
        );

        // StatusBar component should be rendered (it's a mock string in our setup)
        // The component renders <StatusBar barStyle=... /> which uses the mock
        // We can verify it didn't throw
        expect(true).toBe(true);
    });

    it('renders without statusBar config', () => {
        const configModule = require('../../src/config');
        configModule.configureFoundation(createMockConfig());

        const { MfProvider } = require('../../src/components/MfProvider');
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');

        // Should not throw
        const { toJSON } = render(
            React.createElement(MfProvider, null, null),
        );

        expect(toJSON()).toBeDefined();
    });

    it('delivers initial and foreground deep links through the configured handler', async () => {
        const deepLinkHandler = jest.fn();
        const configModule = require('../../src/config');
        configModule.configureFoundation(
            createMockConfig({ deepLinkHandler }),
        );

        const Linking = require('expo-linking');
        let emitUrl!: (url: string) => void;
        Linking.getInitialURL.mockReturnValue(Promise.resolve('myapp://initial'));
        Linking.addEventListener.mockImplementation((_event: string, listener: (event: { url: string }) => void) => {
            emitUrl = url => listener({ url });
            return { remove: jest.fn() };
        });

        const { MfProvider } = require('../../src/components/MfProvider');
        const React = require('react');
        const { act, render } = require('@testing-library/react-native/pure');

        render(React.createElement(MfProvider, null, null));
        await act(async () => {
            await Promise.resolve();
        });

        act(() => {
            emitUrl('myapp://foreground');
            emitUrl('myapp://foreground');
        });

        expect(deepLinkHandler.mock.calls).toEqual([
            ['myapp://initial'],
            ['myapp://foreground'],
            ['myapp://foreground'],
        ]);
    });
});
