import AsyncStorage from '@react-native-async-storage/async-storage';
import { debounce, pick } from 'lodash';
import { makeAutoObservable, makeObservable, observable, runInAction } from 'mobx';

import { memoizeAsync } from '../helpers/memoize';
import { getFoundationConfig } from '../config';
import { withProtectedDataRecovery } from '../helpers/protectedData';
import { createLogger } from './Logger';

export interface AppStorageMethods {
    $load(): Promise<void>;
    $persist(): void;
    $clear(): void;
}

let _appStorage: AppStorageMethods | null = null;

export function getAppStorage(): AppStorageMethods {
    if (!_appStorage) {
        throw new Error('@zyno-io/mobile-foundation-rn: createAppStorage() must be called before using foundation features that depend on AppStorage');
    }
    return _appStorage;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createProp(target: Record<string | symbol, any>, key: string | symbol, value: any) {
    Object.assign(target, { [key]: value });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    makeObservable(target as any, { [key]: observable });
}

/**
 * Creates an AppStorage instance with management methods layered on the proxy.
 *
 * Usage:
 *   interface IAppStorage { deviceToken?: string; ... }
 *   export const AppStorage = createAppStorage<IAppStorage>({});
 *   await AppStorage.$load();
 *   AppStorage.deviceToken = 'abc'; // auto-persists (debounced)
 *   AppStorage.$clear();
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAppStorage<T extends Record<string, any>>(defaults: Partial<T> = {}): T & AppStorageMethods {
    const target = defaults as T;
    makeAutoObservable(target);

    const getAsyncStorageKey = () => {
        const env = getFoundationConfig().env.APP_ENV;
        return `${env}:session`;
    };

    let hydrated = false;
    let persistenceRequested = false;
    let clearRequested = false;
    const changedKeys = new Set<string | symbol>();
    let writeQueue = Promise.resolve();

    const persist = debounce(
        () => {
            persistenceRequested = true;
            if (!hydrated) return;
            writeQueue = writeQueue.then(async () => {
                await withProtectedDataRecovery(() =>
                    AsyncStorage.setItem(getAsyncStorageKey(), JSON.stringify(pick(target, Object.keys(target))))
                );
            }).catch(error => createLogger('AppStorage').error('Failed to persist stored configuration', error));
        },
        250,
        { trailing: true }
    );

    const methods: Record<string, Function> = {
        $load: memoizeAsync(async () => {
            const data = await withProtectedDataRecovery(() => AsyncStorage.getItem(getAsyncStorageKey()));
            if (data !== null) {
                const loaded = JSON.parse(data);
                if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) {
                    throw new Error('Stored configuration must be an object');
                }
                if (!clearRequested) {
                    // Hydration must not schedule a write or overwrite explicit changes
                    // made while the protected read was pending.
                    for (const [key, value] of Object.entries(loaded)) {
                        if (changedKeys.has(key)) continue;
                        if (!(key in target)) createProp(target, key, value);
                        else runInAction(() => { (target as Record<string, unknown>)[key] = value; });
                    }
                }
            }
            hydrated = true;
            if (persistenceRequested || changedKeys.size || clearRequested) persist();
        }),

        $persist: () => persist(),

        $clear: () => {
            clearRequested = true;
            for (const key of Object.keys(target)) {
                runInAction(() => {
                    (target as Record<string, unknown>)[key] = undefined;
                });
            }
            persist();
        }
    };

    const proxy = new Proxy(target, {
        get(obj, prop) {
            if (typeof prop === 'string' && prop in methods) {
                return methods[prop];
            }
            if (!(prop in obj)) {
                createProp(target, prop, undefined);
            }
            return obj[prop as keyof T];
        },

        set(obj, prop, value) {
            changedKeys.add(prop);
            if (!(prop in obj)) {
                createProp(target, prop, value);
            }
            runInAction(() => {
                obj[prop as keyof T] = value;
            });
            persist();
            return true;
        }
    });

    const result = proxy as T & AppStorageMethods;
    _appStorage = result;
    return result;
}
