import React from 'react';
import { View } from 'react-native';
import { MfWrapperView, MfText, MfTextInput } from '@zyno-io/mobile-foundation-rn';

export const FullViewBottomInputScreen: React.FC = () => (
    <MfWrapperView>
        <MfText style={{ padding: 12, fontSize: 12, color: '#888' }} testID="screen-label">1. Full View — Bottom Input</MfText>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <MfText>Content fills the screen</MfText>
        </View>
        <MfTextInput placeholder="Fixed to bottom" testID="bottom-input" />
    </MfWrapperView>
);
