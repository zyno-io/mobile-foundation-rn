import React from 'react';
import { Pressable, PressableProps } from 'react-native-gesture-handler';

import { useThrottledPress } from '../hooks/useThrottledPress';

export interface MfGesturePressableProps extends PressableProps {
    /**
     * Window (ms) during which repeat presses are ignored after one fires.
     * Defaults to `defaults.pressThrottleMs` (500ms). Set `0` to opt out.
     */
    pressThrottleMs?: number;
}

/**
 * Drop-in replacement for `react-native-gesture-handler`'s `Pressable` with
 * double-tap prevention wired by default. Gesture relations (`simultaneousWith`,
 * `requireToFail`, `block`), styling, the `children` render prop, and ref are
 * passed straight through.
 *
 * Use this inside gesture contexts — RNGH scroll views and lists, swipeables,
 * bottom sheets — where RN's `Pressable` loses to the parent gesture. Use
 * {@link MfPressable} everywhere else; in particular, RNGH gestures do not fire
 * inside a React Native `<Modal>` unless the modal content is wrapped in its own
 * `GestureHandlerRootView`.
 */
export const MfGesturePressable: React.FC<MfGesturePressableProps> = props => {
    const { pressThrottleMs, onPress, ...rest } = props;
    const throttledOnPress = useThrottledPress(onPress, pressThrottleMs);

    return <Pressable onPress={throttledOnPress} {...rest} />;
};
