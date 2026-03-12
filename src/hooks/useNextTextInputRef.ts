import { useCallback, useEffect, useRef } from 'react';
import { TextInput } from 'react-native';

import { useFormContext } from '../components/Form';

export function useNextTextInputRef() {
    const currentRef = useRef<TextInput | null>(null);
    const formContext = useFormContext();

    // Function to focus the next input
    const focusNext = useCallback(() => {
        if (!currentRef.current) return;

        const nextRef = formContext.getNextInput(currentRef.current);
        if (nextRef) {
            nextRef.focus();
        }
    }, [formContext]);

    // Register/unregister the current input
    useEffect(() => {
        const ref = currentRef.current;
        if (ref) {
            // Small delay to ensure the component is fully rendered before measuring
            const timeoutId = setTimeout(() => {
                formContext.registerInput(ref);
            }, 100);

            return () => {
                clearTimeout(timeoutId);
                formContext.unregisterInput(ref);
            };
        }
    }, [formContext]);

    return {
        ref: currentRef,
        focusNext
    };
}
