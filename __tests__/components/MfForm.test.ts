import { TextInput } from 'react-native';

// Test the MfForm context logic directly without rendering
describe('MfForm logic', () => {
    let MfForm: typeof import('../../src/components/MfForm');

    beforeEach(() => {
        jest.resetModules();
        MfForm = require('../../src/components/MfForm');
    });

    describe('useMfFormContext outside of MfForm', () => {
        it('returns no-op fallback methods', () => {
            const React = require('react');
            const renderer = require('react-test-renderer');

            let context: ReturnType<typeof MfForm.useMfFormContext>;
            function TestComponent() {
                context = MfForm.useMfFormContext();
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

    describe('MfForm context registration and navigation', () => {
        it('getNextInput returns inputs sorted by y then x position', () => {
            const React = require('react');
            const renderer = require('react-test-renderer');

            let context: ReturnType<typeof MfForm.useMfFormContext>;

            // Create mock TextInput refs with measureInWindow
            const input1 = { measureInWindow: (cb: Function) => cb(0, 100) } as unknown as TextInput;
            const input2 = { measureInWindow: (cb: Function) => cb(0, 200) } as unknown as TextInput;
            const input3 = { measureInWindow: (cb: Function) => cb(100, 200) } as unknown as TextInput; // same row as input2

            function TestComponent() {
                context = MfForm.useMfFormContext();
                return null;
            }

            renderer.act(() => {
                renderer.create(
                    React.createElement(MfForm.MfForm, null,
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

            let context: ReturnType<typeof MfForm.useMfFormContext>;

            const input1 = { measureInWindow: (cb: Function) => cb(0, 100) } as unknown as TextInput;
            const input2 = { measureInWindow: (cb: Function) => cb(0, 200) } as unknown as TextInput;
            const input3 = { measureInWindow: (cb: Function) => cb(0, 300) } as unknown as TextInput;

            function TestComponent() {
                context = MfForm.useMfFormContext();
                return null;
            }

            renderer.act(() => {
                renderer.create(
                    React.createElement(MfForm.MfForm, null,
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

            let context: ReturnType<typeof MfForm.useMfFormContext>;

            function TestComponent() {
                context = MfForm.useMfFormContext();
                return null;
            }

            renderer.act(() => {
                renderer.create(
                    React.createElement(MfForm.MfForm, null,
                        React.createElement(TestComponent)
                    )
                );
            });

            const unknown = {} as TextInput;
            expect(context!.getNextInput(unknown)).toBeNull();
        });
    });
});
