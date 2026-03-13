import { FontAwesomeIconStyle } from '@fortawesome/react-native-fontawesome';
import React from 'react';
import { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Pressable, PressableProps } from 'react-native-gesture-handler';

import { createStyles, useStyles } from '../helpers/styles';

import { MfIcon, MfIconProps } from './MfIcon';
import { MfText } from './MfText';

interface MfButtonProps extends PressableProps {
    primary?: boolean;
    style?: StyleProp<ViewStyle>;
    overrideStyle?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    feedback?: boolean;
    disabled?: boolean;
    icon?: MfIconProps['icon'];
    iconColor?: StyleProp<TextStyle['color']>;
    iconSize?: MfIconProps['size'];
    iconTrailing?: boolean;
    iconStyle?: FontAwesomeIconStyle | undefined;
    text?: string;
    children?: React.ReactNode;
}

export const MfButton: React.FC<MfButtonProps> = props => {
    const {
        primary,
        style,
        overrideStyle,
        textStyle,
        feedback,
        disabled,
        icon,
        iconColor,
        iconSize,
        iconTrailing,
        iconStyle,
        text,
        children,
        ...rest
    } = props;
    const styles = useStyles(styleGen);

    return (
        <Pressable
            style={({ pressed }) => [
                pressed && feedback !== false && styles.pressed,
                !overrideStyle && styles.button,
                !overrideStyle && primary && styles.primaryButton,
                !overrideStyle && disabled && styles.disabled,
                icon && iconTrailing && { flexDirection: 'row-reverse' },
                overrideStyle || style
            ]}
            {...rest}
        >
            {!children && icon && (
                <MfIcon
                    icon={icon}
                    size={iconSize ?? 16}
                    color={typeof iconColor === 'string' ? iconColor : props.primary ? styles.primaryButtonTitle.color : styles.buttonTitle.color}
                    style={iconStyle}
                />
            )}
            {!children && text && <MfText style={[styles.buttonTitle, primary && styles.primaryButtonTitle, textStyle]}>{text}</MfText>}
            {children}
        </Pressable>
    );
};

const styleGen = createStyles(colors => ({
    button: {
        backgroundColor: colors.secondaryButtonBackground,
        padding: 12,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row'
    },
    pressed: {
        opacity: 0.7
    },
    primaryButton: {
        backgroundColor: colors.primaryButtonBackground
    },
    buttonTitle: {
        color: colors.secondaryButtonText,
        fontSize: 14,
        fontWeight: '500'
    },
    primaryButtonTitle: {
        color: colors.primaryButtonText
    },
    disabled: {
        opacity: 0.5
    }
}));
