import React from 'react';
import { View } from 'react-native';
import { MfWrapperView, MfScrollView, MfText, MfTextInput } from '@zyno-io/mobile-foundation-rn';

export const ScrollViewLowInputScreen: React.FC = () => (
    <MfWrapperView>
        <MfScrollView testID="scroll-view">
            <MfText style={{ padding: 12, fontSize: 12, color: '#888' }} testID="screen-label">3. ScrollView — Low Input</MfText>
            <View style={{ height: 200 }}>
                <MfText>Spacer</MfText>
            </View>
            <MfTextInput placeholder="Input 1" testID="input-1" />
            <View style={{ height: 400 }}>
                <MfText>Spacer</MfText>
            </View>
            <MfTextInput placeholder="Low input" testID="low-input" />
        </MfScrollView>
    </MfWrapperView>
);
