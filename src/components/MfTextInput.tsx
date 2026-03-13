import React, { useState } from 'react';
import {
    BlurEvent,
    FocusEvent,
    NativeSyntheticEvent,
    StyleProp,
    TextInput,
    TextInputProps,
    TextInputSubmitEditingEventData,
    View,
    ViewStyle
} from 'react-native';

import { formatCurrency, formatPhone } from '../helpers/formatting';
import { createStyles, useStyles } from '../helpers/styles';
import { useNextTextInputRef } from '../hooks/useNextTextInputRef';

import { MfIcon, MfIconProps } from './MfIcon';
import { MfText } from './MfText';
import { setMfActiveTextInput, unsetMfActiveTextInput } from '../hooks/useMfActiveInput';

interface MfTextInputProps {
    mask?: 'phone' | 'currency';
    disabled?: boolean;
    icon?: MfIconProps['icon'];
    label?: string;
    wrapperStyle?: StyleProp<ViewStyle>;
    inputWrapperStyle?: StyleProp<ViewStyle>;
}

export const MfTextInput = React.forwardRef<TextInput, TextInputProps & MfTextInputProps>((props, forwardedRef) => {
    const {
        mask,
        onFocus,
        onBlur,
        onChangeText,
        onSubmitEditing,
        label,
        disabled,
        style,
        inputWrapperStyle,
        wrapperStyle,
        icon,
        returnKeyType,
        ...nativeProps
    } = props;
    const { value } = nativeProps;
    const ref = React.createRef<TextInput>();
    const { ref: nextTextInputRef, focusNext } = useNextTextInputRef();

    const styles = useStyles(styleGen);

    const [, setSelection] = useState({});
    const [isFocused, setIsFocused] = useState(false);

    const internalOnFocus = (e: FocusEvent) => {
        if (ref.current) setMfActiveTextInput(ref.current);
        if (value) setSelection({ start: 0, end: value.length });
        setIsFocused(true);
        onFocus?.(e);
    };

    const internalOnBlur = (e: BlurEvent) => {
        if (ref.current) unsetMfActiveTextInput(ref.current);
        setIsFocused(false);
        onBlur?.(e);
    };

    const onPhoneNumberChange = (val: string) => {
        const formattedPhoneNumber = formatPhone(val);
        onChangeText?.(formattedPhoneNumber);
    };

    const onCurrencyChange = (val: string) => {
        const formattedCurrency = formatCurrency(val);
        onChangeText?.(formattedCurrency);
    };

    const internalOnChangeText = (val: string) => {
        if (mask === 'phone') {
            return onPhoneNumberChange(val);
        }
        if (mask === 'currency') {
            return onCurrencyChange(val);
        }
        return onChangeText?.(val);
    };

    const internalOnSubmitEditing = (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
        if (onSubmitEditing) {
            onSubmitEditing(e);
        } else if (returnKeyType === 'next') {
            focusNext();
        } else if (returnKeyType === 'done') {
            ref.current?.blur();
        }
    };

    return (
        <View style={[styles.wrapper, wrapperStyle]}>
            {label && <MfText style={styles.label}>{label}</MfText>}
            <View style={[styles.inputWrapper, inputWrapperStyle]}>
                <TextInput
                    ref={node => {
                        ref.current = node;
                        nextTextInputRef.current = node;
                        if (typeof forwardedRef === 'function') {
                            forwardedRef(node);
                        } else if (forwardedRef) {
                            forwardedRef.current = node;
                        }
                    }}
                    maxFontSizeMultiplier={1.5}
                    onFocus={internalOnFocus}
                    onBlur={internalOnBlur}
                    onChangeText={internalOnChangeText}
                    onSubmitEditing={internalOnSubmitEditing}
                    returnKeyType={returnKeyType}
                    editable={!disabled}
                    placeholderTextColor={styles.inputPlaceholder.color}
                    style={[styles.input, icon && styles.iconPadding, disabled && styles.disabled, isFocused && styles.inputFocused, style]}
                    maxLength={nativeProps.maxLength}
                    {...nativeProps}
                />
                {icon && <MfIcon size={16} color={styles.icon.color} icon={icon} style={styles.icon} />}
            </View>
        </View>
    );
});

const styleGen = createStyles(colors => ({
    wrapper: {},
    inputWrapper: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center'
    },
    label: {
        fontSize: 16,
        color: colors.fieldLabel,
        marginBottom: 6
    },
    icon: {
        zIndex: 40,
        position: 'absolute',
        left: 12,
        color: colors.inputIcon
    },
    input: {
        flex: 1,
        padding: 14,
        borderRadius: 8,
        backgroundColor: colors.cardBackground,
        color: colors.inputText,
        fontSize: 16,
        fontFamily: 'Inter_400Regular'
    },
    inputPlaceholder: {
        color: colors.inputPlaceholderText
    },
    iconPadding: {
        paddingLeft: 36
    },
    disabled: {
        opacity: 0.5
    },
    inputFocused: {}
}));
