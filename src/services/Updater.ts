import * as Updates from 'expo-updates';
import { autorun, observable, runInAction } from 'mobx';
import { useEffect, useState } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';

import { getFoundationConfig } from '../config';
import { LoaderState } from '../helpers/observable';
import { useAppActivatedEffect } from '../hooks/useAppStateEffect';
import { AppMeta } from './AppMeta';
import { createLogger } from './Logger';

const logger = createLogger('Updater');

/** Native (app-store) update status returned by the MUS `native-status` endpoint. */
export interface INativeUpdateStatus {
    platform: 'ios' | 'android';
    channelName: string;
    nativeUpdateRequiredAt: string;
    nativeUpdateRequired: boolean;
    latestStoreVersion: string;
    latestStoreVersionDetectedAt: string;
    storeUrl: string;
}

const _statusText = observable.box<string | null>(null);
const _nativeStatus = observable.box<INativeUpdateStatus | null>(null);

function compareVersions(a: string, b: string): number {
    const ap = a.split('.').map(n => parseInt(n, 10) || 0);
    const bp = b.split('.').map(n => parseInt(n, 10) || 0);
    const len = Math.max(ap.length, bp.length);
    for (let i = 0; i < len; i++) {
        const av = ap[i] ?? 0;
        const bv = bp[i] ?? 0;
        if (av !== bv) return av - bv;
    }
    return 0;
}

let _nativeAlertShown = false;
let _nativeWatchStarted = false;
let _nativeAppStateListenerStarted = false;
let _headersSyncStarted = false;

export const Updater = {
    // ===================================================================
    // OTA updates
    // ===================================================================

    get statusText(): string | null {
        return _statusText.get();
    },

    _updateCheckPromise: null as Promise<boolean> | null,
    _shouldDeferUpdate: null as (() => boolean) | null,
    _installTimeout: null as ReturnType<typeof setTimeout> | null,
    _reloadInFlight: false,

    /**
     * Register a predicate that, while it returns true, defers BOTH an OTA reload
     * and the required-native-update alert (e.g. during an active call or in-progress
     * transaction). Read reactively, so if it reads observables the deferred work
     * re-evaluates when they change.
     */
    setUpdateDeferralListener(listener: (() => boolean) | null) {
        Updater._shouldDeferUpdate = listener;
    },

    shouldDeferUpdate() {
        return Updater._shouldDeferUpdate?.() ?? false;
    },

    /** @internal Called by useSetupFoundation */
    _useHook() {
        useEffect(() => {
            logger.info('Runtime info', {
                createdAt: Updates.createdAt,
                isEmbeddedLaunch: Updates.isEmbeddedLaunch,
                isEmergencyLaunch: Updates.isEmergencyLaunch,
                emergencyLaunchReason: Updates.emergencyLaunchReason,
                launchDuration: Updates.launchDuration,
                runtimeVersion: Updates.runtimeVersion,
                updateId: Updates.updateId
            });

            if (AppMeta.isDevelopment) return;

            AppMeta.load().then(() => {
                Updater.downloadUpdate();
            });

            // MUS-targeted OTA request headers + native binary-update check.
            Updater._startHeadersSync();
            Updater.loadNativeStatus();
        }, []);

        if (!AppMeta.isDevelopment) {
            useAppActivatedEffect(() => {
                Updater.downloadUpdate();
            });

            const updates = Updates.useUpdates();
            const timeout = getFoundationConfig().updaterTimeout;
            const [timedOut, setTimedOut] = useState(false);

            useEffect(() => {
                if (!timeout) return;
                const t = setTimeout(() => setTimedOut(true), timeout);
                return () => clearTimeout(t);
            }, []);

            useEffect(() => {
                let text: string | null = null;
                if (updates.isStartupProcedureRunning) {
                    text = 'Starting up...';
                } else if (updates.isRestarting) {
                    text = 'Restarting to install update...';
                } else if (updates.isDownloading) {
                    text = 'Downloading update...';
                } else if (updates.isUpdatePending) {
                    text = 'Installing update...';
                    Updater.scheduleInstallUpdate();
                } else if (updates.isChecking && !timedOut) {
                    text = 'Checking for updates...';
                }
                runInAction(() => _statusText.set(text));
            }, [updates, timedOut]);
        }
    },

    async downloadUpdate() {
        if (Updater._updateCheckPromise) return Updater._updateCheckPromise;
        Updater._updateCheckPromise = Updater._downloadUpdate().finally(() => {
            Updater._updateCheckPromise = null;
        });
        return Updater._updateCheckPromise;
    },

    async _downloadUpdate() {
        if (Updater.shouldDeferUpdate()) {
            logger.info('Skipping update check (deferred)');
            return false;
        }

        try {
            logger.info('Performing update check');
            const result = await Updates.checkForUpdateAsync();
            logger.info('Update check result', result);
            if (!result.isAvailable) return false;
        } catch (err) {
            logger.error('Failed to check for updates', err);
            return false;
        }

        try {
            const result = await Updates.fetchUpdateAsync();
            logger.info('Update fetch result', result);
        } catch (err) {
            logger.error('Failed to download update', err);
            return false;
        }

        return true;
    },

    scheduleInstallUpdate(delayMs = 250) {
        if (Updater._reloadInFlight) return;
        if (Updater._installTimeout) return;
        logger.info('Scheduling update install', { delayMs });
        Updater._installTimeout = setTimeout(() => {
            Updater._installTimeout = null;
            Updater.installUpdate();
        }, delayMs);
    },

    installUpdate: () => {
        if (Updater._reloadInFlight) return;
        if (Updater.shouldDeferUpdate()) {
            logger.info('Deferring update install');
            return;
        }
        if (AppState.currentState !== 'active') {
            logger.info('Deferring update install until app is active', { appState: AppState.currentState });
            return;
        }
        Updater._reloadInFlight = true;
        logger.info('Installing update');
        Updates.reloadAsync().catch(err => {
            Updater._reloadInFlight = false;
            logger.error('Failed to install update', err);
        });
    },

    // ===================================================================
    // MUS-targeted OTA request headers (channel / device / user identity)
    // ===================================================================

    _userIdProvider: null as (() => string | null | undefined) | null,

    /**
     * Register a provider for the current user id (e.g. `() => KeychainState.accountId`).
     * The OTA request-header override is kept in sync reactively, so as the provider's
     * observable changes (login/logout) the `mus-user-id` header updates. Calling this
     * also starts the header sync.
     */
    setUserIdProvider(provider: (() => string | null | undefined) | null) {
        Updater._userIdProvider = provider;
        if (_headersSyncStarted) {
            Updater._applyRequestHeaders();
        } else {
            Updater._startHeadersSync();
        }
    },

    _startHeadersSync() {
        if (AppMeta.isDevelopment) return;
        if (_headersSyncStarted) return;
        if (!getFoundationConfig().env.MUS_CHANNEL) return;
        _headersSyncStarted = true;

        // deviceId needs AppMeta loaded; the autorun then re-applies whenever the
        // user-id provider's observables change.
        AppMeta.load().then(() => {
            autorun(() => Updater._applyRequestHeaders());
        });
    },

    _applyRequestHeaders() {
        const env = getFoundationConfig().env;
        const headers: Record<string, string> = {
            'expo-channel-name': env.MUS_CHANNEL ?? '',
            'mus-device-id': AppMeta.deviceId,
            'mus-user-id': Updater._userIdProvider?.() ?? 'none'
        };
        try {
            Updates.setUpdateRequestHeadersOverride(headers);
        } catch (err) {
            logger.warn('Failed to set update request headers', err);
        }
    },

    // ===================================================================
    // Native (app-store) updates — required/available status via MUS
    // ===================================================================

    get nativeStatus(): INativeUpdateStatus | null {
        return _nativeStatus.get();
    },

    get hasNativeUpdate(): boolean {
        const s = _nativeStatus.get();
        if (!s?.latestStoreVersion) return false;
        return compareVersions(AppMeta.baseAppVersion, s.latestStoreVersion) < 0;
    },

    get nativeUpdateDeadline(): Date | null {
        const s = _nativeStatus.get();
        if (!s?.nativeUpdateRequiredAt) return null;
        const d = new Date(s.nativeUpdateRequiredAt);
        return isNaN(d.getTime()) ? null : d;
    },

    get isNativeUpdateRequired(): boolean {
        return _nativeStatus.get()?.nativeUpdateRequired === true;
    },

    get nativeUpdateDaysUntilRequired(): number | null {
        const d = Updater.nativeUpdateDeadline;
        if (!d) return null;
        const ms = d.getTime() - Date.now();
        if (ms <= 0) return null;
        return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    },

    get nativeDeadlineText(): string | null {
        if (Updater.isNativeUpdateRequired) return 'An update is required to continue.';
        const d = Updater.nativeUpdateDeadline;
        if (!d) return null;
        const days = Updater.nativeUpdateDaysUntilRequired;
        if (days !== null) return `This version will stop working in ${days} ${days === 1 ? 'day' : 'days'}.`;
        return 'This version will stop working in the near future.';
    },

    async loadNativeStatus() {
        const env = getFoundationConfig().env;
        if (!env.MUS_URL || !env.MUS_APP_ID || !env.MUS_CHANNEL) {
            logger.info('Native update status disabled (missing MUS_* config)');
            return;
        }
        if (!_nativeWatchStarted) {
            _nativeWatchStarted = true;
            autorun(() => {
                Updater._maybeShowNativeUpdateAlert();
            });
        }
        if (!_nativeAppStateListenerStarted) {
            _nativeAppStateListenerStarted = true;
            let lastAppState: string = AppState.currentState;
            AppState.addEventListener('change', state => {
                if (state === 'active' && lastAppState !== 'active') {
                    void Updater._fetchNativeStatus();
                }
                lastAppState = state;
            });
        }
        await Updater._fetchNativeStatus();
    },

    async _fetchNativeStatus() {
        const env = getFoundationConfig().env;
        if (!env.MUS_URL || !env.MUS_APP_ID || !env.MUS_CHANNEL) return;
        const platform = Platform.OS === 'ios' ? 'ios' : 'android';
        const url = `${env.MUS_URL}/api/manifest/${env.MUS_APP_ID}/native-status?channelId=${encodeURIComponent(env.MUS_CHANNEL)}&platform=${platform}`;
        try {
            const res = await fetch(url);
            if (!res.ok) {
                logger.warn('Native status fetch failed', { status: res.status });
                return;
            }
            const data = (await res.json()) as INativeUpdateStatus;
            logger.info('Native status received', data);
            runInAction(() => _nativeStatus.set(data));
            Updater._maybeShowNativeUpdateAlert();
        } catch (err) {
            logger.error('Native status fetch error', err);
        }
    },

    openStore() {
        const s = _nativeStatus.get();
        if (!s?.storeUrl) return;
        Linking.openURL(s.storeUrl).catch(err => logger.error('Failed to open store URL', err));
    },

    /** Show the global loader and never dismiss it — used after the user taps OK on
     *  the required-update alert so the app appears locked while they install from the store. */
    lockUiPermanently() {
        runInAction(() => {
            LoaderState.loaderCount++;
        });
    },

    _maybeShowNativeUpdateAlert() {
        if (_nativeAlertShown) return;
        if (!Updater.hasNativeUpdate) return;
        if (!Updater.isNativeUpdateRequired) return;
        if (Updater.shouldDeferUpdate()) {
            logger.info('Deferring required-update alert (deferral listener)');
            return;
        }
        _nativeAlertShown = true;
        Alert.alert(
            'Update Required',
            `This version of the app is obsolete and requires an update. Tap OK to launch the ${Platform.OS === 'ios' ? 'App Store' : 'Play Store'}.`,
            [
                {
                    text: 'OK',
                    onPress: () => {
                        Updater.openStore();
                        Updater.lockUiPermanently();
                    }
                }
            ],
            { cancelable: false }
        );
    },

    /** Reset native-update state (test helper). */
    _resetNative() {
        runInAction(() => _nativeStatus.set(null));
        _nativeAlertShown = false;
    }
};
