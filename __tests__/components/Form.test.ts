import { TextInput } from 'react-native';

// Test the Form context logic directly without rendering
describe('Form logic', () => {
    let Form: typeof import('../../src/components/Form');

    beforeEach(() => {
        jest.resetModules();
        Form = require('../../src/components/Form');
    });

    describe('useFormContext outside of Form', () => {
        it('returns no-op fallback methods', () => {
            const React = require('react');
            const renderer = require('react-test-renderer');

            let context: ReturnType<typeof Form.useFormContext>;
            function TestComponent() {
                context = Form.useFormContext();
                return null;
            }

            renderer.act(() => {
                renderer.create(React.createElement(TestComponent));
            });

            // Should not throw
            expect(context!.registerInput).toBeInstanceOf(Function);
            expect(context!.unregisterInput).toBeInstanceOf(Function);
            expect(context!.getNextInput({} as TextInput)).toBeNull();
        });
    });

    describe('Form context registration and navigation', () => {
        it('getNextInput returns inputs sorted by y then x position', () => {
            const React = require('react');
            const renderer = require('react-test-renderer');

            let context: ReturnType<typeof Form.useFormContext>;

            // Create mock TextInput refs with measureInWindow
            const input1 = { measureInWindow: (cb: Function) => cb(0, 100) } as unknown as TextInput;
            const input2 = { measureInWindow: (cb: Function) => cb(0, 200) } as unknown as TextInput;
            const input3 = { measureInWindow: (cb: Function) => cb(100, 200) } as unknown as TextInput; // same row as input2

            function TestComponent() {
                context = Form.useFormContext();
                return null;
            }

            renderer.act(() => {
                renderer.create(
                    React.createElement(Form.Form, null,
                        React.createElement(TestComponent)
                    )
                );
            });

            // Register inputs
            context!.registerInput(input1);
            context!.registerInput(input2);
            context!.registerInput(input3);

            // input1 (y=100) → input2 (y=200, x=0)
            expect(context!.getNextInput(input1)).toBe(input2);

            // input2 (y=200, x=0) → input3 (y=200, x=100) — same row, sorted by x
            expect(context!.getNextInput(input2)).toBe(input3);

            // input3 is last
            expect(context!.getNextInput(input3)).toBeNull();
        });

        it('unregisterInput removes input from navigation', () => {
            const React = require('react');
            const renderer = require('react-test-renderer');

            let context: ReturnType<typeof Form.useFormContext>;

            const input1 = { measureInWindow: (cb: Function) => cb(0, 100) } as unknown as TextInput;
            const input2 = { measureInWindow: (cb: Function) => cb(0, 200) } as unknown as TextInput;
            const input3 = { measureInWindow: (cb: Function) => cb(0, 300) } as unknown as TextInput;

            function TestComponent() {
                context = Form.useFormContext();
                return null;
            }

            renderer.act(() => {
                renderer.create(
                    React.createElement(Form.Form, null,
                        React.createElement(TestComponent)
                    )
                );
            });

            context!.registerInput(input1);
            context!.registerInput(input2);
            context!.registerInput(input3);

            // Remove middle input
            context!.unregisterInput(input2);

            // input1 should now skip to input3
            expect(context!.getNextInput(input1)).toBe(input3);
        });

        it('returns null for unknown input', () => {
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
                        React.createElement(TestComponent)
                    )
                );
            });

            const unknown = {} as TextInput;
            expect(context!.getNextInput(unknown)).toBeNull();
        });
    });
});
