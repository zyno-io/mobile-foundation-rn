import { TextInput } from 'react-native';

export const MFActiveTextInputContext: { input: TextInput | null } = {
    input: null
};

export function setMFActiveTextInput(input: TextInput) {
    MFActiveTextInputContext.input = input;
}

export function unsetMFActiveTextInput(input: TextInput) {
    if (MFActiveTextInputContext.input === input) {
        MFActiveTextInputContext.input = null;
    }
}

export function useMFActiveTextInputContext(): typeof MFActiveTextInputContext {
    return MFActiveTextInputContext;
}
