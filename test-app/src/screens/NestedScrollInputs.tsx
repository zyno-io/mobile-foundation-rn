import React from 'react';
import { View } from 'react-native';
import { MFWrapperView, MFScrollView, MFText, MFTextInput } from '@zyno-io/mobile-foundation-rn';

export const NestedScrollInputsScreen: React.FC = () => (
    <MFWrapperView>
        <MFScrollView testID="scroll-view">
            <MFText style={{ padding: 12, fontSize: 12, color: '#888' }} testID="screen-label">9. Nested Scroll Inputs</MFText>
            <MFTextInput placeholder="Input in outer scroll" testID="outer-input" />
            <View style={{ height: 600 }} />
            <MFTextInput placeholder="Low input in outer scroll" testID="outer-low-input" />
        </MFScrollView>
    </MFWrapperView>
);
