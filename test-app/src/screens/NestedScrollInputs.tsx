import React from 'react';
import { View } from 'react-native';
import { MfWrapperView, MfScrollView, MfText, MfTextInput } from '@zyno-io/mobile-foundation-rn';

export const NestedScrollInputsScreen: React.FC = () => (
    <MfWrapperView>
        <MfScrollView testID="scroll-view">
            <MfText style={{ padding: 12, fontSize: 12, color: '#888' }} testID="screen-label">9. Nested Scroll Inputs</MfText>
            <MfTextInput placeholder="Input in outer scroll" testID="outer-input" />
            <View style={{ height: 600 }} />
            <MfTextInput placeholder="Low input in outer scroll" testID="outer-low-input" />
        </MfScrollView>
    </MfWrapperView>
);
