import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useNavigationFocusEffect(callback: (() => void) | (() => void), deps: any[] = []) {
    useFocusEffect(
        useCallback(() => {
            return callback();
        }, deps)
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useNavigationUnfocusEffect(callback: () => void, deps: any[] = []) {
    useFocusEffect(
        useCallback(() => {
            return () => callback();
        }, deps)
    );
}
