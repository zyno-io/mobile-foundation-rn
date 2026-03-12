import React from 'react';
import { View } from 'react-native';
import { MFWrapperView, MFText, MFTextInput } from '@zyno-io/mobile-foundation-rn';

export const ModalWithHeaderInputScreen: React.FC = () => (
    <MFWrapperView>
        <MFText style={{ padding: 12, fontSize: 12, color: '#888' }} testID="screen-label">5. Modal + Header — Input</MFText>
        <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 20 }}>
            <MFTextInput placeholder="Modal input" testID="modal-input" />
        </View>
    </MFWrapperView>
);
