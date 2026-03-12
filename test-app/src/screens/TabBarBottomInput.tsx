import React from 'react';
import { View } from 'react-native';
import { MFWrapperView, MFText, MFTextInput } from '@zyno-io/mobile-foundation-rn';

export const TabBarBottomInputScreen: React.FC = () => (
    <MFWrapperView>
        <MFText style={{ padding: 12, fontSize: 12, color: '#888' }} testID="screen-label">2. Tab Bar — Bottom Input</MFText>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <MFText>Tab content</MFText>
        </View>
        <MFTextInput placeholder="Above tab bar" testID="tab-input" />
    </MFWrapperView>
);
