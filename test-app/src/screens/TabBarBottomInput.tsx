import React from 'react';
import { View } from 'react-native';
import { MfWrapperView, MfText, MfTextInput } from '@zyno-io/mobile-foundation-rn';

export const TabBarBottomInputScreen: React.FC = () => (
    <MfWrapperView>
        <MfText style={{ padding: 12, fontSize: 12, color: '#888' }} testID="screen-label">2. Tab Bar — Bottom Input</MfText>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <MfText>Tab content</MfText>
        </View>
        <MfTextInput placeholder="Above tab bar" testID="tab-input" />
    </MfWrapperView>
);
