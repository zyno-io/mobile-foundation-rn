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

export function useAppStateEffect(effect: AppStateEffect) {
    React.useEffect(() => {
        const subscription = AppState.addEventListener('change', nextState => {
            if (hasLaunched) setTimeout(() => effect(nextState), 0);
        });
        return () => subscription.remove();
    }, [effect]);
}

export function useAppActivatedEffect(effect: () => void) {
    useAppStateEffect(nextState => {
        if (nextState === 'active') effect();
    });
}

export function useAppDeactivatedEvent(effect: () => void) {
    useAppStateEffect(nextState => {
        if (nextState === 'background') effect();
    });
}
