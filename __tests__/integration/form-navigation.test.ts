import { TextInput } from 'react-native';

describe('Form + TextInput keyboard navigation', () => {
    let Form: typeof import('../../src/components/Form');

    beforeEach(() => {
        jest.resetModules();
        Form = require('../../src/components/Form');
    });

    function setupForm() {
        const React = require('react');
        const renderer = require('react-test-renderer');

        let context: ReturnType<typeof Form.useFormContext>;

        function TestComponent() {
            context = Form.useFormContext();
            return null;
        }

        renderer.act(() => {
            renderer.create(
                React.createElement(Form.Form, null,
                    React.createElement(TestComponent),
                ),
            );
        });

        return context!;
    }

    function mockInput(x: number, y: number): TextInput {
        return {
            measureInWindow: (cb: Function) => cb(x, y),
            focus: jest.fn(),
        } as unknown as TextInput;
    }

    it('navigates 3 vertical inputs top to bottom', () => {
        const context = setupForm();
        const input1 = mockInput(0, 100);
        const input2 = mockInput(0, 200);
        const input3 = mockInput(0, 300);

        context.registerInput(input1);
        context.registerInput(input2);
        context.registerInput(input3);

        expect(context.getNextInput(input1)).toBe(input2);
        expect(context.getNextInput(input2)).toBe(input3);
        expect(context.getNextInput(input3)).toBeNull();
    });

    it('navigates same-row inputs left to right (y diff < 10)', () => {
        const context = setupForm();
        const city = mockInput(0, 200);
        const state = mockInput(200, 205); // y diff = 5 < 10, same row

        context.registerInput(city);
        context.registerInput(state);

        expect(context.getNextInput(city)).toBe(state);
    });

    it('navigates mixed layout: vertical then horizontal then vertical', () => {
        const context = setupForm();
        const firstName = mockInput(0, 100);
        const lastName = mockInput(0, 200);
        const city = mockInput(0, 300);
        const stateInput = mockInput(200, 303); // same row as city
        const phone = mockInput(0, 400);

        context.registerInput(firstName);
        context.registerInput(lastName);
        context.registerInput(city);
        context.registerInput(stateInput);
        context.registerInput(phone);

        expect(context.getNextInput(firstName)).toBe(lastName);
        expect(context.getNextInput(lastName)).toBe(city);
        expect(context.getNextInput(city)).toBe(stateInput);
        expect(context.getNextInput(stateInput)).toBe(phone);
        expect(context.getNextInput(phone)).toBeNull();
    });

    it('skips unregistered input in navigation', () => {
        const context = setupForm();
        const input1 = mockInput(0, 100);
        const input2 = mockInput(0, 200);
        const input3 = mockInput(0, 300);

        context.registerInput(input1);
        context.registerInput(input2);
        context.registerInput(input3);

        context.unregisterInput(input2);

        expect(context.getNextInput(input1)).toBe(input3);
    });

    it('handles registration in any order', () => {
        const context = setupForm();
        const input3 = mockInput(0, 300);
        const input1 = mockInput(0, 100);
        const input2 = mockInput(0, 200);

        // Register out of order
        context.registerInput(input3);
        context.registerInput(input1);
        context.registerInput(input2);

        // Should still navigate in position order
        expect(context.getNextInput(input1)).toBe(input2);
        expect(context.getNextInput(input2)).toBe(input3);
    });
});
