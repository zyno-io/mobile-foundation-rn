import React from 'react';
import { Text, TextProps, View } from 'react-native';

import { useColors } from '../helpers/styles';

export const MFText = React.forwardRef<Text, TextProps>((props, ref) => {
    const colors = useColors();
    const { style, ...rest } = props;

    return <Text ref={ref} maxFontSizeMultiplier={1.5} style={[{ color: colors.text, fontFamily: 'Inter', fontSize: 16 }, style]} {...rest} />;
});

export const MFStatusTextView: React.FC<TextProps> = props => {
    const colors = useColors();

    return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <MFText {...props} style={[{ color: colors.secondaryText, fontSize: 16 }, props.style]} />
        </View>
    );
};
