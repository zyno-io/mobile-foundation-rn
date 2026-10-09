import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { withProtectedDataRecovery } from "../helpers/protectedData";
import { createLogger } from "../services/Logger";

import { getFoundationConfig } from "../config";
import { getAppStorage } from "../services/AppStorage";
import { AppMeta } from "../services/AppMeta";
import { SentryHelper } from "../services/Sentry";
import { Updater } from "../services/Updater";

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

  const config = getFoundationConfig();

  const [fontsLoaded, fontsError] = useFonts(config.fonts ?? {});

  const [servicesLoaded, setServicesLoaded] = useState(false);
  useEffect(() => {
    let disposed = false;
    let loading = false;
    let loaded = false;
    let retryRequested = false;
    const load = async () => {
      if (disposed || loaded) return;
      if (loading) { retryRequested = true; return; }
      retryRequested = false;
      loading = true;
      try {
        // A queued activation must retry both reads after their failed memoized
        // promises have cleared, rather than reusing a second still-pending read.
        const results = await Promise.allSettled([withProtectedDataRecovery(() => AppMeta.load()), getAppStorage().$load()]);
        for (const result of results) {
          if (result.status === "rejected") throw result.reason;
        }
        loaded = true;
        if (!disposed) setServicesLoaded(true);
      } catch (error) {
        if (!disposed) createLogger("Setup").error("Failed to load foundation services", error);
      } finally {
        loading = false;
        // Coalesce an activation received while the denied read was in flight.
        if (retryRequested && !disposed && !loaded) void load();
      }
    };
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active") void load();
    });
    void load();
    return () => { disposed = true; subscription.remove(); };
  }, []);

  const isReady = useMemo(
    () => (fontsLoaded || !!fontsError) && servicesLoaded && (appIsReady?.() ?? true),
    [fontsLoaded, fontsError, servicesLoaded, appIsReady],
  );

  Updater._useHook(isReady);

  useEffect(() => {
    if (isReady && (config.splashScreen ?? "auto") === "auto") {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  return isReady;
}
