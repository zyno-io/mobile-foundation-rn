import { createMockConfig } from '../test-utils';

describe('Theming integration', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    it('useColors returns light scheme when system is light', () => {
        const { useColorScheme } = require('react-native');
        (useColorScheme as jest.Mock).mockReturnValue('light');

        const configModule = require('../../src/config');
        const config = createMockConfig();
        configModule.configureFoundation(config);

        const { useColors } = require('../../src/helpers/styles');
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');

        let colors: any;
        function TestComponent() {
            colors = useColors();
            return null;
        }

        render(React.createElement(TestComponent));

        expect(colors.background).toBe(config.colors.light.background);
    });

    it('useColors returns dark scheme when system is dark', () => {
        const { useColorScheme } = require('react-native');
        (useColorScheme as jest.Mock).mockReturnValue('dark');

        const configModule = require('../../src/config');
        const config = createMockConfig();
        configModule.configureFoundation(config);

        const { useColors } = require('../../src/helpers/styles');
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');

        let colors: any;
        function TestComponent() {
            colors = useColors();
            return null;
        }

        render(React.createElement(TestComponent));

        expect(colors.background).toBe(config.colors.dark.background);
    });

    it('ColorSchemeOverrideContext overrides system scheme', () => {
        const { useColorScheme } = require('react-native');
        (useColorScheme as jest.Mock).mockReturnValue('light');

        const configModule = require('../../src/config');
        const config = createMockConfig();
        configModule.configureFoundation(config);

        const { useColors, ColorSchemeOverrideContext } = require('../../src/helpers/styles');
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');

        let colors: any;
        function TestComponent() {
            colors = useColors();
            return null;
        }

        render(
            React.createElement(
                ColorSchemeOverrideContext.Provider,
                { value: 'dark' },
                React.createElement(TestComponent),
            ),
        );

        // Should use dark despite system being light
        expect(colors.background).toBe(config.colors.dark.background);
    });

    it('useStyles memoizes styles for same scheme', () => {
        const { useColorScheme } = require('react-native');
        (useColorScheme as jest.Mock).mockReturnValue('light');

        const configModule = require('../../src/config');
        configModule.configureFoundation(createMockConfig());

        const { createStyles, useStyles } = require('../../src/helpers/styles');
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');

        const gen = createStyles((colors: any) => ({
            container: { backgroundColor: colors.background },
        }));

        const results: any[] = [];
        function TestComponent() {
            results.push(useStyles(gen));
            return null;
        }

        const { rerender } = render(React.createElement(TestComponent));

        // Force re-render
        rerender(React.createElement(TestComponent));

        // Same reference since scheme didn't change
        expect(results[0]).toBe(results[1]);
    });
});
