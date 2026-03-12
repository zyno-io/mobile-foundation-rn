import AsyncStorage from '@react-native-async-storage/async-storage';
import { debounce, pick } from 'lodash';
import { makeAutoObservable, makeObservable, observable, runInAction } from 'mobx';

import { memoizeAsync } from '../helpers/memoize';
import { getFoundationConfig } from '../config';

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

    const persist = debounce(
        () => {
            const persisted = pick(target, Object.keys(target));
            AsyncStorage.setItem(getAsyncStorageKey(), JSON.stringify(persisted));
        },
        250,
        { trailing: true }
    );

    const methods: Record<string, Function> = {
        $load: memoizeAsync(async () => {
            try {
                const data = await AsyncStorage.getItem(getAsyncStorageKey());
                if (!data) {
                    throw new Error('no data stored');
                }
                const loaded = JSON.parse(data);
                Object.assign(proxy, loaded);
            } catch {
                // we expect a throw if there was no session
            }
        }),

        $persist: () => persist(),

        $clear: () => {
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
