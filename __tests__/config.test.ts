describe('config', () => {
    let configModule: typeof import('../src/config');

    beforeEach(() => {
        jest.resetModules();
        configModule = require('../src/config');
    });

    it('throws if getFoundationConfig called before configureFoundation', () => {
        expect(() => configModule.getFoundationConfig()).toThrow(
            'configureFoundation() must be called before using foundation components',
        );
    });

    it('returns config after configureFoundation is called', () => {
        const mockConfig = {
            colors: {
                light: makeMockColorScheme(),
                dark: makeMockColorScheme(),
            },
            env: { APP_ENV: 'test' },
            icons: { check: 'check', spinner: 'spinner' },
        } as any;

        configModule.configureFoundation(mockConfig);

        const result = configModule.getFoundationConfig();
        expect(result.env.APP_ENV).toBe('test');
        expect(result.icons.check).toBe('check');
    });
});

function makeMockColorScheme() {
    return {
        transparent: 'transparent',
        white: '#fff',
        black: '#000',
        background: '#fff',
        surface: '#f5f5f5',
        text: '#000',
        secondaryText: '#666',
        accent: '#007AFF',
        primaryButtonBackground: '#007AFF',
        primaryButtonText: '#fff',
        secondaryButtonBackground: '#e5e5e5',
        secondaryButtonText: '#000',
        cardBackground: '#fff',
        cardBorder: '#ddd',
        cardText: '#000',
        cardSecondaryText: '#666',
        cardTertiaryText: '#999',
        fieldLabel: '#666',
        inputBackground: '#f5f5f5',
        inputInvalidBackground: '#fee',
        inputText: '#000',
        inputIcon: '#999',
        inputPlaceholderText: '#999',
        selectedItemBackground: '#007AFF',
        selectedItemBorder: '#007AFF',
        selectedItemText: '#fff',
        infoText: '#666',
        dangerBackground: '#fee',
        dangerButtonBackground: '#ff3b30',
        dangerButtonText: '#fff',
    };
}
