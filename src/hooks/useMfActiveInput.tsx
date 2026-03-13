import { TextInput } from 'react-native';

export const MfActiveTextInputContext: { input: TextInput | null } = {
    input: null
};

export function setMfActiveTextInput(input: TextInput) {
    MfActiveTextInputContext.input = input;
}

export function unsetMfActiveTextInput(input: TextInput) {
    if (MfActiveTextInputContext.input === input) {
        MfActiveTextInputContext.input = null;
    }
}

export function useMfActiveTextInputContext(): typeof MfActiveTextInputContext {
    return MfActiveTextInputContext;
}
