import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import React, { useEffect, useState } from 'react';
import { AppState, ColorSchemeName, StatusBar, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getFoundationConfig } from '../config';
import { useColors } from '../helpers/styles';
import { getLinkingUrl } from '../hooks/useLinkingUrl';

import { GlobalLoaderOverlay } from './MFLoaderOverlay';
import { MfGlobalKeyboardProvider } from '../hooks/useMfKeyboardHeight';

interface FoundationProviderProps {
    colorScheme?: ColorSchemeName;
    children: React.ReactNode;
}

const FoundationProviderInner: React.FC<FoundationProviderProps> = ({ colorScheme: colorSchemeProp, children }) => {
    const systemColorScheme = useColorScheme();
    const colorScheme = colorSchemeProp ?? systemColorScheme;

    return (
        <ActionSheetProvider>
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
        </ActionSheetProvider>
    );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FoundationProvider = Sentry.wrap(FoundationProviderInner as any) as unknown as React.FC<FoundationProviderProps>;

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
    if (!config.deepLinkHandler) return null;

    const [linkingUrl, setLinkingUrl] = useState<string | null>(() => getLinkingUrl());

    useEffect(() => {
        const sub = AppState.addEventListener('change', state => {
            if (state === 'active') {
                const url = getLinkingUrl();
                if (url && url !== linkingUrl) {
                    setLinkingUrl(url);
                }
            }
        });
        return () => sub.remove();
    }, [linkingUrl]);

    useEffect(() => {
        if (linkingUrl) {
            config.deepLinkHandler!(linkingUrl);
        }
    }, [linkingUrl]);

    return null;
};
