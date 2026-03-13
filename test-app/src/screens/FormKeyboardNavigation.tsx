import React, { useState } from 'react';
import { View } from 'react-native';
import {
    MfWrapperView,
    MfScrollView,
    MfText,
    MfTextInput,
    MfTextArea,
    MfForm,
} from '@zyno-io/mobile-foundation-rn';

export const FormKeyboardNavigationScreen: React.FC = () => {
    const [phone, setPhone] = useState('');

    return (
        <MfWrapperView>
            <MfScrollView testID="scroll-view">
                <MfText style={{ padding: 12, fontSize: 12, color: '#888' }} testID="screen-label">6. Form Keyboard Navigation</MfText>
                <MfForm>
                    <MfTextInput placeholder="First name" testID="first-name" returnKeyType="next" />
                    <MfTextInput placeholder="Last name" testID="last-name" returnKeyType="next" />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <MfTextInput
                            placeholder="City"
                            testID="city"
                            returnKeyType="next"
                            wrapperStyle={{ flex: 1 }}
                        />
                        <MfTextInput
                            placeholder="State"
                            testID="state"
                            returnKeyType="next"
                            wrapperStyle={{ width: 80 }}
                        />
                    </View>
                    <MfTextInput
                        placeholder="Phone"
                        mask="phone"
                        testID="phone"
                        returnKeyType="next"
                        value={phone}
                        onChangeText={setPhone}
                    />
                    <MfTextArea placeholder="Notes" testID="notes" returnKeyType="done" />
                </MfForm>
            </MfScrollView>
        </MfWrapperView>
    );
};
