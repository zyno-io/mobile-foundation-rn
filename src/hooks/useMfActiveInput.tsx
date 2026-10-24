import { TextInputInstance } from 'react-native';

export const MfActiveTextInputContext: { input: TextInputInstance | null } = {
    input: null
};

export function setMfActiveTextInput(input: TextInputInstance) {
    MfActiveTextInputContext.input = input;
}

export function unsetMfActiveTextInput(input: TextInputInstance) {
    if (MfActiveTextInputContext.input === input) {
        MfActiveTextInputContext.input = null;
    }
}

export function useMfActiveTextInputContext(): typeof MfActiveTextInputContext {
    return MfActiveTextInputContext;
}
