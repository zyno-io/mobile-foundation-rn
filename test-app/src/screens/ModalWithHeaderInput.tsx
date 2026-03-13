import React from 'react';
import { View } from 'react-native';
import { MfWrapperView, MfText, MfTextInput } from '@zyno-io/mobile-foundation-rn';

export const ModalWithHeaderInputScreen: React.FC = () => (
    <MfWrapperView>
        <MfText style={{ padding: 12, fontSize: 12, color: '#888' }} testID="screen-label">5. Modal + Header — Input</MfText>
        <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 20 }}>
            <MfTextInput placeholder="Modal input" testID="modal-input" />
        </View>
    </MfWrapperView>
);
