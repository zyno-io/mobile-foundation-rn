import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo, useState } from 'react';

import { getFoundationConfig } from '../config';
import { getAppStorage } from '../services/AppStorage';
import { AppMeta } from '../services/AppMeta';
import { SentryHelper } from '../services/Sentry';
import { Updater } from '../services/Updater';

SplashScreen.preventAutoHideAsync();

/**
 * Consolidates foundation setup: Sentry nav instrumentation, updater, fonts,
 * AppMeta, AppStorage, and splash screen management.
 *
 * @param appIsReady Optional callback that must return true for the foundation
 *   to be considered ready (e.g. for app-specific async loading).
 * @returns true when all foundation services are loaded and ready.
 */
export function useSetupFoundation(appIsReady?: () => boolean): boolean {
    SentryHelper.useNavigationInstrumentation();
    Updater._useHook();

    const config = getFoundationConfig();

    const [fontsLoaded, fontsError] = useFonts(config.fonts ?? {});

    const [servicesLoaded, setServicesLoaded] = useState(false);
    useEffect(() => {
        Promise.all([AppMeta.load(), getAppStorage().$load()]).then(() => setServicesLoaded(true));
    }, []);

    const isReady = useMemo(
        () => (fontsLoaded || !!fontsError) && servicesLoaded && (appIsReady?.() ?? true),
        [fontsLoaded, fontsError, servicesLoaded, appIsReady]
    );

    useEffect(() => {
        if (isReady && (config.splashScreen ?? 'auto') === 'auto') {
            SplashScreen.hideAsync();
        }
    }, [isReady]);

    return isReady;
}
