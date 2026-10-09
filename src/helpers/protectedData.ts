import * as Sentry from '@sentry/react-native';
import { AppState, Platform } from 'react-native';

import { getFoundationConfigIfConfigured } from '../config';
import { getProtectedDataNativeModule, throwIfAborted, waitForNativeProtectedData } from '../native/ProtectedData';

export interface ProtectedDataRecoveryOptions {
    /** Cancels this caller's wait; does not cancel an already executing operation. */
    signal?: AbortSignal;
}

function isLikelyProtectedDataError(error: unknown): boolean {
    const visited = new Set<unknown>();
    const matches = (value: unknown): boolean => {
        if (visited.has(value)) return false;
        visited.add(value);
        const native = value as { code?: unknown; domain?: unknown; message?: unknown; cause?: unknown; nativeError?: unknown } | null;
        if (String(native?.code) === '-25308') return true;
        if (native?.domain === 'NSCocoaErrorDomain' && [257, 513].includes(Number(native.code))) return true;
        if (native?.domain === 'NSPOSIXErrorDomain' && [1, 13].includes(Number(native.code))) return true;
        if (/-25308|User interaction is not allowed|Operation not permitted|permission (?:denied|to (?:view|read|write))|Failed to read storage file/i.test(String(native?.message ?? value))) return true;
        return native?.cause !== undefined && matches(native.cause)
            || native?.nativeError !== undefined && matches(native.nativeError);
    };
    return matches(error);
}

function waitForForeground(signal?: AbortSignal): Promise<void> {
    throwIfAborted(signal);
    if (AppState.currentState === 'active') return Promise.resolve();
    return new Promise((resolve, reject) => {
        let subscription: ReturnType<typeof AppState.addEventListener> | undefined;
        let settled = false;
        const finish = (error?: unknown) => {
            if (settled) return;
            settled = true;
            subscription?.remove();
            signal?.removeEventListener('abort', abort);
            if (error !== undefined) reject(error);
            else resolve();
        };
        const abort = () => { try { throwIfAborted(signal); } catch (error) { finish(error); } };
        signal?.addEventListener('abort', abort, { once: true });
        subscription = AppState.addEventListener('change', state => { if (state === 'active') finish(); });
        if (settled) subscription.remove();
        // Covers activation during registration on binaries without the module.
        if (AppState.currentState === 'active') finish();
        if (signal?.aborted) abort();
    });
}

/** Apply the configured iOS availability policy and retry a denied operation once. */
export async function withProtectedDataRecovery<T>(operation: () => Promise<T>, { signal }: ProtectedDataRecoveryOptions = {}): Promise<T> {
    throwIfAborted(signal);
    if (Platform.OS !== 'ios') return operation();
    const required = getFoundationConfigIfConfigured()?.requireProtectedDataAvailability ?? false;
    const native = getProtectedDataNativeModule();
    if (required) {
        if (!native) throw new Error('requireProtectedDataAvailability requires a new iOS binary with the Foundation protected-data native module');
        await waitForNativeProtectedData(native, signal);
        throwIfAborted(signal);
    }
    try {
        return await operation();
    } catch (error) {
        throwIfAborted(signal);
        if (!isLikelyProtectedDataError(error)) throw error;
        const started = Date.now();
        const available = native ? await native.getAvailabilityAsync() : null;
        Sentry.addBreadcrumb({ category: 'protected-data', level: 'info', message: 'Waiting to retry a denied operation', data: { required, nativeAvailable: available } });
        if (native) await waitForNativeProtectedData(native, signal);
        else await waitForForeground(signal);
        throwIfAborted(signal);
        Sentry.addBreadcrumb({ category: 'protected-data', level: 'info', message: 'Retrying a denied operation', data: { required, nativeAvailable: native ? true : null, waitMs: Date.now() - started } });
        // Retry even if availability returned before the native query. A second
        // failure propagates, and failed memoized loads remain retryable later.
        return operation();
    }
}
