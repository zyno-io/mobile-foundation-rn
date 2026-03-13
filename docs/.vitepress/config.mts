import { defineConfig } from 'vitepress';

export default defineConfig({
    base: '/mobile-foundation-rn/',
    title: 'Mobile Foundation (RN)',
    description: 'Shared foundation library for React Native apps',
    themeConfig: {
        nav: [
            { text: 'Guide', link: '/guide/getting-started' },
            { text: 'Components', link: '/components/wrapper-view' },
            { text: 'Hooks', link: '/hooks/keyboard-height' },
            { text: 'API', link: '/api/config' },
        ],
        sidebar: [
            {
                text: 'Guide',
                items: [
                    { text: 'Getting Started', link: '/guide/getting-started' },
                    { text: 'Configuration', link: '/guide/configuration' },
                    { text: 'Theming', link: '/guide/theming' },
                    { text: 'Keyboard Avoidance', link: '/guide/keyboard-avoidance' },
                    { text: 'Form Navigation', link: '/guide/form-navigation' },
                    { text: 'Error Handling', link: '/guide/error-handling' },
                ],
            },
            {
                text: 'Components',
                items: [
                    { text: 'FoundationProvider', link: '/components/foundation-provider' },
                    { text: 'MFWrapperView', link: '/components/wrapper-view' },
                    { text: 'MFScrollView', link: '/components/scroll-view' },
                    { text: 'MFFlatList', link: '/components/flat-list' },
                    { text: 'MFText', link: '/components/text' },
                    { text: 'MFTextInput', link: '/components/text-input' },
                    { text: 'MFTextArea', link: '/components/text-area' },
                    { text: 'MFButton', link: '/components/button' },
                    { text: 'MFIcon', link: '/components/icon' },
                    { text: 'MFCheckbox', link: '/components/checkbox' },
                    { text: 'MFLoader', link: '/components/loader' },
                    { text: 'Form', link: '/components/form' },
                ],
            },
            {
                text: 'Hooks',
                items: [
                    { text: 'useMfKeyboardHeight', link: '/hooks/keyboard-height' },
                    { text: 'useMFSafeAreaInsets', link: '/hooks/safe-area-insets' },
                    { text: 'useSetupFoundation', link: '/hooks/setup-foundation' },
                    { text: 'useWaitTask', link: '/hooks/wait-task' },
                    { text: 'useNextTextInputRef', link: '/hooks/next-text-input-ref' },
                    { text: 'useAppStateEffect', link: '/hooks/app-state-effect' },
                    { text: 'useNavigationFocusEffect', link: '/hooks/navigation-focus-effect' },
                    { text: 'useNavigationWithOptions', link: '/hooks/navigation-with-options' },
                    { text: 'useMountEffect', link: '/hooks/mount-effect' },
                    { text: 'useBroadcastEffect', link: '/hooks/broadcast-effect' },
                ],
            },
            {
                text: 'API Reference',
                items: [
                    { text: 'configureFoundation', link: '/api/config' },
                    { text: 'AppMeta', link: '/api/app-meta' },
                    { text: 'AppStorage', link: '/api/app-storage' },
                    { text: 'Logger', link: '/api/logger' },
                    { text: 'Sentry', link: '/api/sentry' },
                    { text: 'Updater', link: '/api/updater' },
                    { text: 'Helpers', link: '/api/helpers' },
                ],
            },
        ],
        socialLinks: [
            { icon: 'github', link: 'https://github.com/zyno-io/mobile-foundation-rn' },
        ],
    },
});
