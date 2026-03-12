import type { FoundationConfig } from '../src/config';

/**
 * Creates a mock FoundationConfig with sensible defaults.
 * Pass partial overrides to customize specific fields.
 */
export function createMockConfig(overrides: Partial<FoundationConfig> = {}): FoundationConfig {
    return {
        colors: {
            light: makeMockColorScheme(),
            dark: makeMockColorScheme('#333', '#fff'),
        },
        env: {
            APP_ENV: 'test',
            BUILD_VERSION: '1.0.0-test',
            CDN_URL: 'https://cdn.test.com',
            ...overrides.env,
        },
        icons: {
            check: 'check' as any,
            spinner: 'spinner' as any,
            ...overrides.icons,
        },
        ...overrides,
        // Re-apply env/icons so top-level overrides don't clobber nested merges
    };
}

function makeMockColorScheme(bg = '#fff', text = '#000') {
    return {
        transparent: 'transparent',
        white: '#fff',
        black: '#000',
        background: bg,
        surface: '#f5f5f5',
        text,
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
    } as any;
}
