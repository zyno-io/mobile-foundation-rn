import { makeAutoObservable, makeObservable, observable, runInAction } from 'mobx';

type Hooks<T, K extends keyof T = keyof T> = {
    [P in K]?: {
        get?: (target: T) => T[P];
        afterSet?: () => void;
    };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createProp(target: Record<string | symbol, any>, key: string | symbol, value: any) {
    Object.assign(target, {
        [key]: value
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    makeObservable(target as any, {
        [key]: observable
    });
}

export const LoaderState = makeAutoObservable({ loaderCount: 0 });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createObservableProxy<T extends Record<string | symbol, any>>(target: T, hooks?: Hooks<T>): T {
    makeAutoObservable(target);
    return new Proxy(target, {
        get(obj, prop) {
            if (hooks?.[prop]?.get) {
                return hooks[prop].get(target);
            }
            if (!(prop in obj)) {
                createProp(target, prop, undefined);
            }
            return obj[prop];
        },

        set(obj, prop, value) {
            if (!(prop in obj)) {
                createProp(target, prop, value);
            }
            runInAction(() => {
                obj[prop as keyof T] = value;
            });
            hooks?.[prop]?.afterSet?.();
            return true;
        }
    });
}
