import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import React, { useEffect } from 'react';
import { ColorSchemeName, StatusBar, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getFoundationConfig } from '../config';
import { ColorSchemeOverrideContext, useColors } from '../helpers/styles';
import { subscribeToLinkingUrls } from '../hooks/useLinkingUrl';

import { GlobalLoaderOverlay } from './MfLoaderOverlay';
import { MfGlobalKeyboardProvider } from '../hooks/useMfKeyboardHeight';

interface MfProviderProps {
    colorScheme?: ColorSchemeName;
    children: React.ReactNode;
}

const MfProviderInner: React.FC<MfProviderProps> = ({ colorScheme: colorSchemeProp, children }) => {
    const systemColorScheme = useColorScheme();
    const colorScheme = colorSchemeProp ?? systemColorScheme;
    const overrideColorScheme = colorSchemeProp === 'dark' || colorSchemeProp === 'light' ? colorSchemeProp : null;

    return (
        <ActionSheetProvider>
            <ColorSchemeOverrideContext.Provider value={overrideColorScheme}>
                <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                    <KeyboardProvider>
                        <MfGlobalKeyboardProvider>
                            <GestureHandlerRootView>
                                <SafeAreaProvider>
                                    <FoundationStatusBar />
                                    <DeepLinkingHandler />
                                    {children}
                                </SafeAreaProvider>
                            </GestureHandlerRootView>
                            <GlobalLoaderOverlay />
                        </MfGlobalKeyboardProvider>
                    </KeyboardProvider>
                </ThemeProvider>
            </ColorSchemeOverrideContext.Provider>
        </ActionSheetProvider>
    );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MfProvider = Sentry.wrap(MfProviderInner as any) as unknown as React.FC<MfProviderProps>;

const FoundationStatusBar: React.FC = () => {
    const config = getFoundationConfig();
    const statusBarConfig = config.statusBar;
    const colors = useColors();

    if (!statusBarConfig) return null;

    const barStyle =
        statusBarConfig.barStyle === 'auto'
            ? colors === config.colors.dark
                ? 'light-content'
                : 'dark-content'
            : statusBarConfig.barStyle;

    const backgroundColor = statusBarConfig.backgroundColorKey ? colors[statusBarConfig.backgroundColorKey] : undefined;

    return <StatusBar barStyle={barStyle} backgroundColor={backgroundColor} />;
};

const DeepLinkingHandler: React.FC = () => {
    const config = getFoundationConfig();
    const handler = config.deepLinkHandler;

    useEffect(() => {
        if (!handler) return;
        return subscribeToLinkingUrls(handler);
    }, [handler]);

    return null;
};
