import React from 'react';
import { Pressable, PressableProps } from 'react-native-gesture-handler';

import { useThrottledPress } from '../hooks/useThrottledPress';

export interface MfPressableProps extends PressableProps {
    /**
     * Window (ms) during which repeat presses are ignored after one fires.
     * Defaults to `defaults.pressThrottleMs` (500ms). Set `0` to opt out.
     */
    pressThrottleMs?: number;
}

/**
 * Drop-in replacement for `Pressable` with double-tap prevention wired by default.
 * Everything else — styling, `children` render prop, ref, gesture relations — is
 * passed straight through to `react-native-gesture-handler`'s `Pressable`.
 */
export const MfPressable: React.FC<MfPressableProps> = props => {
    const { pressThrottleMs, onPress, ...rest } = props;
    const throttledOnPress = useThrottledPress(onPress, pressThrottleMs);

    return <Pressable onPress={throttledOnPress} {...rest} />;
};
