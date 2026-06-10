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

    it('round-trips optional component defaults', () => {
        const mockConfig = {
            colors: {
                light: makeMockColorScheme(),
                dark: makeMockColorScheme(),
            },
            env: { APP_ENV: 'test' },
            icons: { check: 'check', spinner: 'spinner' },
            defaults: {
                fontFamily: 'Roboto',
                button: { gap: 8, iconColorKey: 'accent' },
                input: { borderRadius: 16 },
            },
        } as any;

        configModule.configureFoundation(mockConfig);

        const result = configModule.getFoundationConfig();
        expect(result.defaults?.fontFamily).toBe('Roboto');
        expect(result.defaults?.button?.gap).toBe(8);
        expect(result.defaults?.button?.iconColorKey).toBe('accent');
        expect(result.defaults?.input?.borderRadius).toBe(16);
    });

    it('leaves defaults undefined when not configured', () => {
        const mockConfig = {
            colors: {
                light: makeMockColorScheme(),
                dark: makeMockColorScheme(),
            },
            env: { APP_ENV: 'test' },
            icons: { check: 'check', spinner: 'spinner' },
        } as any;

        configModule.configureFoundation(mockConfig);

        expect(configModule.getFoundationConfig().defaults).toBeUndefined();
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
