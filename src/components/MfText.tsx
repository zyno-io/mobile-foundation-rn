import React from 'react';
import { Text, TextProps, View } from 'react-native';

import { getFoundationConfig } from '../config';
import { useColors } from '../helpers/styles';

export const MfText = React.forwardRef<Text, TextProps>((props, ref) => {
    const colors = useColors();
    const { style, ...rest } = props;
    const fontFamily = getFoundationConfig().defaults?.fontFamily ?? 'Inter';

    return <Text ref={ref} maxFontSizeMultiplier={1.5} style={[{ color: colors.text, fontFamily, fontSize: 16 }, style]} {...rest} />;
});

export const MfStatusTextView: React.FC<TextProps> = props => {
    const colors = useColors();

    return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <MfText {...props} style={[{ color: colors.secondaryText, fontSize: 16 }, props.style]} />
        </View>
    );
};
