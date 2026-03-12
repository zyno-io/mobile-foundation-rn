import type { Config } from 'jest';

const m = '<rootDir>/__tests__/__mocks__';

const config: Config = {
    testEnvironment: 'node',
    roots: ['<rootDir>/__tests__'],
    setupFiles: ['<rootDir>/__tests__/jest.setup.ts'],
    testMatch: ['**/*.test.ts', '**/*.test.tsx'],
    testPathIgnorePatterns: ['/node_modules/', '/test-app/'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        // Map all peer/virtual dependencies to mock files
        '^react-native$': `${m}/react-native.ts`,
        '^@react-native-async-storage/async-storage$': `${m}/async-storage.ts`,
        '^expo-file-system/legacy$': `${m}/expo-file-system-legacy.ts`,
        '^expo-file-system/next$': `${m}/expo-file-system-next.ts`,
        '^react-native-device-info$': `${m}/react-native-device-info.ts`,
        '^@sentry/react-native$': `${m}/sentry-react-native.ts`,
        '^expo-updates$': `${m}/expo-updates.ts`,
        '^expo-testflight$': `${m}/expo-testflight.ts`,
        '^expo-splash-screen$': `${m}/expo-splash-screen.ts`,
        '^expo-font$': `${m}/expo-font.ts`,
        '^expo-linking$': `${m}/expo-linking.ts`,
        '^react-native-gesture-handler$': `${m}/react-native-gesture-handler.ts`,
        '^react-native-keyboard-controller$': `${m}/react-native-keyboard-controller.ts`,
        '^react-native-reanimated$': `${m}/react-native-reanimated.ts`,
        '^react-native-safe-area-context$': `${m}/react-native-safe-area-context.ts`,
        '^react-native-logs$': `${m}/react-native-logs.ts`,
        '^@fortawesome/react-native-fontawesome$': `${m}/fortawesome-fontawesome.ts`,
        '^@fortawesome/fontawesome-svg-core$': `${m}/fortawesome-core.ts`,
        '^@expo/react-native-action-sheet$': `${m}/react-native-action-sheet.ts`,
        '^@react-navigation/native$': `${m}/react-navigation-native.ts`,
        '^@react-navigation/stack$': `${m}/react-navigation-stack.ts`,
        '^mobx-react-lite$': `${m}/mobx-react-lite.ts`,
    },
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            // Disable type-checking diagnostics — peer dependencies aren't installed
            // in the library's node_modules, so TS can't resolve their types.
            // Runtime resolution is handled by moduleNameMapper above.
            diagnostics: false,
        }],
    },
};

export default config;
