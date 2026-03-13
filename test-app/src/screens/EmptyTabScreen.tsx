import React from 'react';
import { View } from 'react-native';
import { MfText } from '@zyno-io/mobile-foundation-rn';

export const EmptyTabScreen: React.FC = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <MfText>Empty Tab</MfText>
    </View>
);
