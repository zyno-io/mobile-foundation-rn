import { createContext, useContext, useMemo } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import { getFoundationConfig } from '../config';
import { ColorScheme } from '../types';

export type StyleGenerator<T extends StyleSheet.NamedStyles<T>> = (colors: ColorScheme) => T;
export function createStyles<T extends StyleSheet.NamedStyles<T>>(fn: StyleGenerator<T>): StyleGenerator<T> {
    return (colors: ColorScheme) => StyleSheet.create(fn(colors));
}

export function useStyles<T extends StyleSheet.NamedStyles<T>>(generator: StyleGenerator<T>): T {
    const systemScheme = useColorScheme();
    const overrideScheme = useColorSchemeOverride();
    const scheme = overrideScheme ?? systemScheme;
    const config = getFoundationConfig();
    return useMemo(() => generator(scheme === 'dark' ? config.colors.dark : config.colors.light), [scheme, generator]);
}

export function useColors(): ColorScheme {
    const systemScheme = useColorScheme();
    const overrideScheme = useColorSchemeOverride();
    const scheme = overrideScheme ?? systemScheme;
    const config = getFoundationConfig();
    return scheme === 'dark' ? config.colors.dark : config.colors.light;
}

export const ColorSchemeOverrideContext = createContext<null | 'light' | 'dark'>(null);
export const useColorSchemeOverride = () => useContext(ColorSchemeOverrideContext);
