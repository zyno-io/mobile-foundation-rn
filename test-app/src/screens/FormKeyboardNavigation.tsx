import React, { useState } from 'react';
import { View } from 'react-native';
import {
    MFWrapperView,
    MFScrollView,
    MFText,
    MFTextInput,
    MFTextArea,
    Form,
} from '@zyno-io/mobile-foundation-rn';

export const FormKeyboardNavigationScreen: React.FC = () => {
    const [phone, setPhone] = useState('');

    return (
        <MFWrapperView>
            <MFScrollView testID="scroll-view">
                <MFText style={{ padding: 12, fontSize: 12, color: '#888' }} testID="screen-label">6. Form Keyboard Navigation</MFText>
                <Form>
                    <MFTextInput placeholder="First name" testID="first-name" returnKeyType="next" />
                    <MFTextInput placeholder="Last name" testID="last-name" returnKeyType="next" />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <MFTextInput
                            placeholder="City"
                            testID="city"
                            returnKeyType="next"
                            wrapperStyle={{ flex: 1 }}
                        />
                        <MFTextInput
                            placeholder="State"
                            testID="state"
                            returnKeyType="next"
                            wrapperStyle={{ width: 80 }}
                        />
                    </View>
                    <MFTextInput
                        placeholder="Phone"
                        mask="phone"
                        testID="phone"
                        returnKeyType="next"
                        value={phone}
                        onChangeText={setPhone}
                    />
                    <MFTextArea placeholder="Notes" testID="notes" returnKeyType="done" />
                </Form>
            </MFScrollView>
        </MFWrapperView>
    );
};
