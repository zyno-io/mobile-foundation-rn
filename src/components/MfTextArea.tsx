import React from 'react';
import { NativeSyntheticEvent, StyleProp, TextInput, TextInputProps, TextInputSubmitEditingEventData, ViewStyle } from 'react-native';

import { createStyles, useStyles } from '../helpers/styles';
import { useNextTextInputRef } from '../hooks/useNextTextInputRef';

import { setMfActiveTextInput, unsetMfActiveTextInput } from '../hooks/useMfActiveInput';

interface MfTextAreaProps {
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
}

export const MfTextArea = React.forwardRef<TextInput, TextInputProps & MfTextAreaProps>((props, forwardedRef) => {
    const localStyles = useStyles(styleGen);
    const ref = React.createRef<TextInput>();
    const { ref: nextTextInputRef, focusNext } = useNextTextInputRef();

    const { placeholder, disabled, autoFocus, style, onFocus, onBlur, onChangeText, onSubmitEditing, returnKeyType, ...nativeProps } = props;
    const { value } = nativeProps;

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
            value={value}
            onFocus={e => {
                if (ref.current) setMfActiveTextInput(ref.current);
                onFocus?.(e);
            }}
            onBlur={e => {
                if (ref.current) unsetMfActiveTextInput(ref.current);
                onBlur?.(e);
            }}
            onChangeText={onChangeText}
            onSubmitEditing={internalOnSubmitEditing}
            returnKeyType={returnKeyType}
            multiline={true}
            numberOfLines={2}
            editable={!disabled}
            autoFocus={autoFocus}
            placeholder={placeholder}
            placeholderTextColor={localStyles.placeholder.color}
            style={[localStyles.textArea, disabled && localStyles.disabled, style]}
            {...props}
        />
    );
});

const styleGen = createStyles(colors => ({
    textArea: {
        width: '100%',
        height: 120,
        padding: 14,
        borderRadius: 6,
        backgroundColor: colors.inputBackground,
        color: colors.inputText,
        textAlignVertical: 'top',
        fontSize: 16,
        fontFamily: 'Inter_400Regular'
    },
    placeholder: {
        color: colors.inputPlaceholderText
    },
    disabled: {
        opacity: 0.5
    }
}));
