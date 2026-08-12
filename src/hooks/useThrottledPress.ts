import { useCallback, useRef } from 'react';

import { getFoundationConfigIfConfigured } from '../config';

/** Window used when neither the call site nor `defaults.pressThrottleMs` specifies one. */
export const DEFAULT_PRESS_THROTTLE_MS = 500;

type PressHandler<E> = ((event: E) => void) | null | undefined;

function resolveDefaultThrottleMs(): number {
    return getFoundationConfigIfConfigured()?.defaults?.pressThrottleMs ?? DEFAULT_PRESS_THROTTLE_MS;
}

/**
 * Wraps a press handler so that repeat presses within `throttleMs` are dropped —
 * the fix for "I tapped the row twice and it pushed two screens".
 *
 * Leading edge: the first press fires immediately, subsequent presses inside the
 * window are ignored outright (never queued or replayed). The window is measured
 * from the last press that actually fired, so a rapid triple-tap fires once.
 *
 * The guard is per hook instance, so two different rows each get their own window
 * and things like a dialer keypad keep working when each key has its own handler.
 *
 * @param handler   The press handler to guard. `null`/`undefined` passes through as `undefined`.
 * @param throttleMs Window in ms. Omit for `defaults.pressThrottleMs` (500ms). `0` disables.
 */
export function useThrottledPress<E>(handler: PressHandler<E>, throttleMs?: number): ((event: E) => void) | undefined {
    const windowMs = throttleMs ?? resolveDefaultThrottleMs();

    // Refs so the returned callback is referentially stable (it is handed to
    // Pressable/TouchableOpacity, which memoize on it) while still calling the
    // latest handler and honoring a changed window.
    const handlerRef = useRef(handler);
    handlerRef.current = handler;

    const windowRef = useRef(windowMs);
    windowRef.current = windowMs;

    const lastFiredAtRef = useRef<number | undefined>(undefined);

    const throttled = useCallback((event: E) => {
        const fn = handlerRef.current;
        if (!fn) return;

        const currentWindow = windowRef.current;
        if (currentWindow > 0) {
            const now = Date.now();
            const lastFiredAt = lastFiredAtRef.current;
            if (lastFiredAt !== undefined && now - lastFiredAt < currentWindow) return;
            lastFiredAtRef.current = now;
        }

        fn(event);
    }, []);

    return handler ? throttled : undefined;
}
