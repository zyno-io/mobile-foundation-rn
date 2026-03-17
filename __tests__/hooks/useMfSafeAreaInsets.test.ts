// Test the logic of useMfSafeAreaInsets by calling the hook in a minimal React context

// We need to test useMfSafeAreaInsets which uses useSafeAreaInsets (mocked)
// and returns filtered insets. We'll test the logic directly.
describe('useMfSafeAreaInsets', () => {
    let useMfSafeAreaInsets: typeof import('../../src/hooks/useMfSafeAreaInsets').useMfSafeAreaInsets;

    beforeEach(() => {
        jest.resetModules();
        useMfSafeAreaInsets = require('../../src/hooks/useMfSafeAreaInsets').useMfSafeAreaInsets;
    });

    // Helper to call hook in a React context
    function callHook(applyInsets: Parameters<typeof useMfSafeAreaInsets>[0]) {
        let result: ReturnType<typeof useMfSafeAreaInsets>;
        const React = require('react');
        const { render } = require('@testing-library/react-native/pure');

        function TestComponent() {
            result = useMfSafeAreaInsets(applyInsets);
            return null;
        }

        render(React.createElement(TestComponent));
        return result!;
    }

    it('returns all insets when applyInsets is true', () => {
        const insets = callHook(true);
        expect(insets).toEqual({ top: 47, bottom: 34, left: 0, right: 0 });
    });

    it('returns all zeros when applyInsets is false', () => {
        const insets = callHook(false);
        expect(insets).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
    });

    it('returns only bottom inset for single string', () => {
        const insets = callHook('bottom');
        expect(insets).toEqual({ top: 0, bottom: 34, left: 0, right: 0 });
    });

    it('returns only top inset for single string', () => {
        const insets = callHook('top');
        expect(insets).toEqual({ top: 47, bottom: 0, left: 0, right: 0 });
    });

    it('returns selected insets for array', () => {
        const insets = callHook(['top', 'bottom']);
        expect(insets).toEqual({ top: 47, bottom: 34, left: 0, right: 0 });
    });

    it('returns only left/right when specified', () => {
        const insets = callHook(['left', 'right']);
        expect(insets).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
    });
});
