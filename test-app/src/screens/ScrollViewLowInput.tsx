import React from 'react';
import { View } from 'react-native';
import { MFWrapperView, MFScrollView, MFText, MFTextInput } from '@zyno-io/mobile-foundation-rn';

export const ScrollViewLowInputScreen: React.FC = () => (
    <MFWrapperView>
        <MFScrollView testID="scroll-view">
            <MFText style={{ padding: 12, fontSize: 12, color: '#888' }} testID="screen-label">3. ScrollView — Low Input</MFText>
            <View style={{ height: 200 }}>
                <MFText>Spacer</MFText>
            </View>
            <MFTextInput placeholder="Input 1" testID="input-1" />
            <View style={{ height: 400 }}>
                <MFText>Spacer</MFText>
            </View>
            <MFTextInput placeholder="Low input" testID="low-input" />
        </MFScrollView>
    </MFWrapperView>
);
