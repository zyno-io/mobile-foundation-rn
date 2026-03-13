import React from 'react';
import { View } from 'react-native';
import { MfWrapperView, MfText, MfTextInput } from '@zyno-io/mobile-foundation-rn';

export const NavigationHeaderLowInputScreen: React.FC = () => (
    <MfWrapperView>
        <MfText style={{ padding: 12, fontSize: 12, color: '#888' }} testID="screen-label">4. Nav Header — Low Input</MfText>
        <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 20 }}>
            <MfText>This input is just above keyboard line in a full view,</MfText>
            <MfText>but the nav header pushes it below the keyboard.</MfText>
            <MfTextInput placeholder="Tricky position" testID="tricky-input" />
        </View>
    </MfWrapperView>
);
