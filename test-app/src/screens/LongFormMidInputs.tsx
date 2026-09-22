import React, { useEffect, useState } from 'react';
import { Dimensions, Keyboard, PixelRatio, Pressable, Text, View } from 'react-native';
import { KeyboardEvents } from 'react-native-keyboard-controller';
import { MfWrapperView, MfScrollView, MfText, MfTextInput, MfTextArea } from '@zyno-io/mobile-foundation-rn';

/**
 * 10. Long form — inputs in the middle of a tall scroll view.
 *
 * The inputs sit well below the fold, so the scroll view is already offset when they're tapped, and there
 * is plenty of content below them, so an over-scroll is not masked by the scroll view clamping at the end
 * of its content. This is the geometry that "larger text" produces on real forms.
 *
 * A metrics readout (screen height, keyboard height, font scale, pixel ratio) is exposed via testID +
 * accessibilityLabel so E2E tests can compute the keyboard line precisely on both platforms. It sits
 * outside the scroll view so it is always on screen, and tapping it dismisses the keyboard.
 */
export const LongFormMidInputsScreen: React.FC = () => {
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        const show = KeyboardEvents.addListener('keyboardDidShow', e => setKeyboardHeight(e.height));
        const hide = KeyboardEvents.addListener('keyboardDidHide', () => setKeyboardHeight(0));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);

    const metrics = JSON.stringify({
        screenHeight: Dimensions.get('screen').height,
        keyboardHeight,
        fontScale: PixelRatio.getFontScale(),
        pixelRatio: PixelRatio.get(),
    });

    return (
        <MfWrapperView>
            <Pressable testID="metrics" accessibilityLabel={metrics} onPress={() => Keyboard.dismiss()}>
                <Text allowFontScaling={false} numberOfLines={1} style={{ fontSize: 10, color: '#888', paddingHorizontal: 12 }}>
                    {metrics}
                </Text>
            </Pressable>
            <MfScrollView testID="scroll-view">
                <MfText style={{ padding: 12, fontSize: 12, color: '#888' }} testID="screen-label">10. Long Form — Mid Inputs</MfText>
                <MfTextInput placeholder="Top input" testID="top-input" />
                {/* tall enough that the mid inputs start below the fold on the largest phones */}
                <View style={{ height: 900 }}>
                    <MfText>Spacer</MfText>
                </View>
                <MfTextInput placeholder="Mid input" testID="mid-input" />
                <View style={{ height: 120 }}>
                    <MfText testID="mid-spacer-label">Spacer</MfText>
                </View>
                <MfTextArea placeholder="Mid text area" testID="mid-textarea" />
                <View style={{ height: 900 }}>
                    <MfText>Spacer</MfText>
                </View>
            </MfScrollView>
        </MfWrapperView>
    );
};
