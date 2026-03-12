import React, { createContext, useContext, useRef } from 'react';
import { TextInput } from 'react-native';

interface TextInputInfo {
    ref: TextInput;
    x: number;
    y: number;
}

interface FormContextValue {
    registerInput: (ref: TextInput) => void;
    unregisterInput: (ref: TextInput) => void;
    getNextInput: (currentRef: TextInput) => TextInput | null;
}

export const FormContext = createContext<FormContextValue | null>(null);

interface FormProps {
    children: React.ReactNode;
}

export function Form({ children }: FormProps) {
    const inputsRef = useRef<Map<TextInput, TextInputInfo>>(new Map());

    const registerInput = (ref: TextInput) => {
        // Measure the position of the text input
        ref.measureInWindow((x, y) => {
            inputsRef.current.set(ref, { ref, x, y });
        });
    };

    const unregisterInput = (ref: TextInput) => {
        inputsRef.current.delete(ref);
    };

    const getNextInput = (currentRef: TextInput): TextInput | null => {
        const inputs = inputsRef.current;
        const currentInput = inputs.get(currentRef);
        if (!currentInput) return null;

        // Get all inputs and sort by position
        const allInputs = Array.from(inputs.values());

        // Sort by y position (top to bottom), then by x position (left to right)
        const sortedInputs = allInputs.sort((a, b) => {
            const yDiff = a.y - b.y;
            // Consider inputs on same row if y difference < 10px
            if (Math.abs(yDiff) > 10) {
                return yDiff;
            }
            return a.x - b.x;
        });

        // Find current input index and return next one
        const currentIndex = sortedInputs.findIndex(input => input.ref === currentRef);
        if (currentIndex === -1 || currentIndex === sortedInputs.length - 1) {
            return null; // Current not found or is last input
        }

        return sortedInputs[currentIndex + 1].ref;
    };

    const contextValue: FormContextValue = {
        registerInput,
        unregisterInput,
        getNextInput
    };

    return <FormContext.Provider value={contextValue}>{children}</FormContext.Provider>;
}

export function useFormContext() {
    const context = useContext(FormContext);
    if (!context) {
        return {
            registerInput: () => {},
            unregisterInput: () => {},
            getNextInput: () => null
        };
    }
    return context;
}
