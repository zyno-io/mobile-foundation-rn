import React from 'react';
import { FlatList, View } from 'react-native';
import { MfWrapperView, MfText, MfTextInput } from '@zyno-io/mobile-foundation-rn';

const messages = Array.from({ length: 30 }, (_, i) => ({
    id: String(i),
    text: `Message ${i + 1}`,
}));

export const ComposerPatternScreen: React.FC = () => (
    <MfWrapperView>
        <MfText style={{ padding: 12, fontSize: 12, color: '#888' }} testID="screen-label">7. Composer in Tab Stack</MfText>
        <FlatList
            data={messages}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
                <View style={{ padding: 12 }}>
                    <MfText>{item.text}</MfText>
                </View>
            )}
            style={{ flex: 1 }}
            inverted
        />
        <View style={{ borderTopWidth: 1, borderTopColor: '#ddd', padding: 8 }}>
            <MfTextInput
                placeholder="Type a message"
                testID="composer-input"
            />
        </View>
    </MfWrapperView>
);
