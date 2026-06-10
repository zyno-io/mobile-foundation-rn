import React from 'react';
import { AppState, AppStateStatus } from 'react-native';

type AppStateEffect = (state: AppStateStatus) => void;
let hasLaunched = false;

const hasLaunchedSub = AppState.addEventListener('change', nextState => {
    if (nextState === 'active') {
        setTimeout(() => {
            hasLaunched = true;
            hasLaunchedSub.remove();
        }, 100);
    }
});

export function useAppStateEffect(effect: AppStateEffect, deps?: React.DependencyList) {
    React.useEffect(() => {
        const subscription = AppState.addEventListener('change', nextState => {
            if (hasLaunched) setTimeout(() => effect(nextState), 0);
        });
        return () => subscription.remove();
        // When `deps` is omitted, behave exactly as before (re-subscribe on every `effect` change).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps ?? [effect]);
}

export function useAppActivatedEffect(effect: () => void, deps?: React.DependencyList) {
    useAppStateEffect(nextState => {
        if (nextState === 'active') effect();
    }, deps);
}

export function useAppDeactivatedEvent(effect: () => void, deps?: React.DependencyList) {
    useAppStateEffect(nextState => {
        if (nextState === 'background') effect();
    }, deps);
}
