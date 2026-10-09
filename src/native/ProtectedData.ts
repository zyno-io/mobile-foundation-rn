import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

interface ProtectedDataNativeModule {
    getAvailabilityAsync(): Promise<boolean>;
    waitForAvailabilityAsync(id: string): Promise<void>;
    cancelWaitAsync(id: string): Promise<void>;
}

let nextWaitId = 0;

export function getProtectedDataNativeModule(): ProtectedDataNativeModule | null {
    if (Platform.OS !== 'ios') return null;
    const native = requireOptionalNativeModule<Partial<ProtectedDataNativeModule>>('MobileFoundationProtectedData');
    return native && typeof native.getAvailabilityAsync === 'function'
        && typeof native.waitForAvailabilityAsync === 'function' && typeof native.cancelWaitAsync === 'function'
        ? native as ProtectedDataNativeModule : null;
}

export function throwIfAborted(signal?: AbortSignal): void {
    if (!signal?.aborted) return;
    const error = new Error('Protected-data operation was aborted');
    error.name = 'AbortError';
    throw signal.reason ?? error;
}

export function waitForNativeProtectedData(native: ProtectedDataNativeModule, signal?: AbortSignal): Promise<void> {
    throwIfAborted(signal);
    const id = String(++nextWaitId);
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (success: boolean, error?: unknown) => {
            if (settled) return;
            settled = true;
            signal?.removeEventListener('abort', abort);
            if (!success) reject(error);
            else resolve();
        };
        const abort = () => {
            try { throwIfAborted(signal); } catch (error) { finish(false, error); }
            void native.cancelWaitAsync(id).catch(() => {});
        };
        signal?.addEventListener('abort', abort, { once: true });
        // Dispatch the wait before cancellation so both reach the native main
        // queue in order. Always consume native rejection after JS cancellation.
        try { void native.waitForAvailabilityAsync(id).then(() => finish(true), error => finish(false, error)); }
        catch (error) { finish(false, error); }
        if (signal?.aborted) abort();
    });
}
