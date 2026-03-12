import React from 'react';
import { View } from 'react-native';
import { MFWrapperView, MFText, MFTextInput } from '@zyno-io/mobile-foundation-rn';

export const FullViewBottomInputScreen: React.FC = () => (
    <MFWrapperView>
        <MFText style={{ padding: 12, fontSize: 12, color: '#888' }} testID="screen-label">1. Full View — Bottom Input</MFText>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <MFText>Content fills the screen</MFText>
        </View>
        <MFTextInput placeholder="Fixed to bottom" testID="bottom-input" />
    </MFWrapperView>
);
