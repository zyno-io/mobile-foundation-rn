import React from 'react';
import { TouchableOpacity, TouchableOpacityProps } from 'react-native';

import { useThrottledPress } from '../hooks/useThrottledPress';

export interface MfTouchableOpacityProps extends TouchableOpacityProps {
    /**
     * Window (ms) during which repeat presses are ignored after one fires.
     * Defaults to `defaults.pressThrottleMs` (500ms). Set `0` to opt out.
     */
    pressThrottleMs?: number;
}

/**
 * Drop-in replacement for `TouchableOpacity` with double-tap prevention wired by
 * default. Use this where you want the built-in opacity feedback; use
 * {@link MfPressable} otherwise.
 */
export const MfTouchableOpacity = React.forwardRef<React.ComponentRef<typeof TouchableOpacity>, MfTouchableOpacityProps>((props, ref) => {
    const { pressThrottleMs, onPress, ...rest } = props;
    const throttledOnPress = useThrottledPress(onPress, pressThrottleMs);

    return <TouchableOpacity ref={ref} onPress={throttledOnPress} {...rest} />;
});

MfTouchableOpacity.displayName = 'MfTouchableOpacity';
