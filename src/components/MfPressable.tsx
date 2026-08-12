import React from 'react';
import { Pressable, PressableProps } from 'react-native';

import { useThrottledPress } from '../hooks/useThrottledPress';

export interface MfPressableProps extends PressableProps {
    /**
     * Window (ms) during which repeat presses are ignored after one fires.
     * Defaults to `defaults.pressThrottleMs` (500ms). Set `0` to opt out.
     */
    pressThrottleMs?: number;
}

/**
 * Drop-in replacement for React Native's `Pressable` with double-tap prevention
 * wired by default. Everything else — styling, the `children` render prop, ref —
 * is passed straight through.
 *
 * Use {@link MfGesturePressable} instead where the call site currently uses
 * `react-native-gesture-handler`'s `Pressable`; the two are not interchangeable.
 */
export const MfPressable = React.forwardRef<React.ComponentRef<typeof Pressable>, MfPressableProps>((props, ref) => {
    const { pressThrottleMs, onPress, ...rest } = props;
    const throttledOnPress = useThrottledPress(onPress, pressThrottleMs);

    return <Pressable ref={ref} onPress={throttledOnPress} {...rest} />;
});

MfPressable.displayName = 'MfPressable';
