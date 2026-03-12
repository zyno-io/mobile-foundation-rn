import { observable, runInAction } from 'mobx';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';

import { getFoundationConfig } from '../config';
import { useAppActivatedEffect } from '../hooks/useAppStateEffect';

import { AppMeta } from './AppMeta';
import { createLogger } from './Logger';

const logger = createLogger('Updater');

const _statusText = observable.box<string | null>(null);

export const Updater = {
    get statusText(): string | null {
        return _statusText.get();
    },

    _updateCheckPromise: null as Promise<boolean> | null,
    _shouldDeferUpdate: null as (() => boolean) | null,

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
                Updates.setExtraParamAsync('deviceid', AppMeta.deviceId)
                    .catch(err => {
                        logger.error('Failed to set extra param', err);
                    })
                    .finally(() => {
                        Updater.downloadUpdate();
                    });
            });
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
                if (updates.isDownloading) {
                    text = 'Downloading update...';
                } else if (updates.isUpdatePending) {
                    text = 'Installing update...';
                    Updater.installUpdate();
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

    installUpdate: () => {
        if (Updater.shouldDeferUpdate()) {
            logger.info('Deferring update install');
            return;
        }
        logger.info('Installing update');
        Updates.reloadAsync();
    }
};
