import React, { createContext, useContext, useMemo } from 'react';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';

export const MfGlobalKeyboardContext = createContext<{
    height: SharedValue<number>;
}>({
    height: undefined as unknown as SharedValue<number>
});

export const MfGlobalKeyboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { height: rawHeight } = useReanimatedKeyboardAnimation();
    // useReanimatedKeyboardAnimation returns negative values; normalize to positive
    const height = useDerivedValue(() => Math.abs(rawHeight.value));

    const contextValue = useMemo(() => ({ height }), [height]);

    return <MfGlobalKeyboardContext.Provider value={contextValue}>{children}</MfGlobalKeyboardContext.Provider>;
};

const MfKeyboardContext = createContext({
    appliedByAncestor: false
});
type IMfKeyboardHeightProvider = React.FC<{ children: React.ReactNode }>;

export const useMfKeyboardHeight = (
    enabled = true
): {
    keyboardOverlapsView: boolean;
    keyboardHeight: SharedValue<number>;
    KeyboardHeightProvider: IMfKeyboardHeightProvider;
} => {
    const context = useContext(MfKeyboardContext);
    const globalContext = useContext(MfGlobalKeyboardContext);

    const providerValue = useMemo(() => ({ appliedByAncestor: context.appliedByAncestor || enabled }), [context, enabled]);
    const KeyboardHeightProvider: IMfKeyboardHeightProvider = useMemo(
        () => props => <MfKeyboardContext.Provider value={providerValue}>{props.children}</MfKeyboardContext.Provider>,
        [providerValue]
    );

    const keyboardOverlapsView = enabled && !context.appliedByAncestor;
    return {
        keyboardOverlapsView: keyboardOverlapsView,
        keyboardHeight: globalContext.height,
        KeyboardHeightProvider
    };
};
