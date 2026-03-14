import { IconProp } from '@fortawesome/fontawesome-svg-core';
import React from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';

import { getFoundationConfig } from '../config';
import { createStyles, useStyles } from '../helpers/styles';

import { MfIcon } from './MfIcon';
import { MfText } from './MfText';

interface MfCheckboxProps {
    value?: boolean;
    onPress?: () => void;
    disabled?: boolean;
    icon?: IconProp;
    label?: string;
    wrapperStyle?: StyleProp<ViewStyle>;
    unstyled?: boolean;
    children?: React.ReactNode;
    testID?: string;
}

export const MfCheckbox = React.forwardRef<View, MfCheckboxProps>((props, _ref) => {
    const { value, disabled, icon, label, wrapperStyle, unstyled, onPress, children, testID } = props;

    const styles = useStyles(styleGen);

    return (
        <View testID={testID} style={[unstyled && styles.checkboxWrapper, disabled && styles.disabled, wrapperStyle]}>
            <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]} disabled={disabled}>
                <View style={styles.checkboxWrapper}>
                    <View style={[styles.checkbox, value && styles.checked]}>
                        {value && <MfIcon icon={icon ?? getFoundationConfig().icons.check} size={16} style={styles.icon} color={'black'} />}
                    </View>
                    <View style={{ flex: 1 }}>
                        <MfText style={styles.label}>{label}</MfText>
                    </View>
                </View>
            </Pressable>
            {children && <View style={styles.childrenWrapper}>{children}</View>}
        </View>
    );
});

const styleGen = createStyles(colors => ({
    checkboxWrapper: {
        flexDirection: 'row',
        gap: 12
    },
    childrenWrapper: {
        marginLeft: 32, // 20 (checkbox width) + 12 (gap)
        marginTop: 8
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'white',
        justifyContent: 'center',
        alignItems: 'center'
    },
    checked: {
        backgroundColor: 'white',
        color: 'black'
    },
    unchecked: {
        backgroundColor: colors.surface
    },
    icon: {
        color: 'red'
    },
    label: {
        fontFamily: 'Inter_400Regular',
        color: colors.text
    },
    pressed: {
        opacity: 0.7
    },
    disabled: {
        opacity: 0.5
    }
}));
