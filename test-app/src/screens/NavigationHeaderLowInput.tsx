import React from 'react';
import { View } from 'react-native';
import { MFWrapperView, MFText, MFTextInput } from '@zyno-io/mobile-foundation-rn';

export const NavigationHeaderLowInputScreen: React.FC = () => (
    <MFWrapperView>
        <MFText style={{ padding: 12, fontSize: 12, color: '#888' }} testID="screen-label">4. Nav Header — Low Input</MFText>
        <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 20 }}>
            <MFText>This input is just above keyboard line in a full view,</MFText>
            <MFText>but the nav header pushes it below the keyboard.</MFText>
            <MFTextInput placeholder="Tricky position" testID="tricky-input" />
        </View>
    </MFWrapperView>
);
