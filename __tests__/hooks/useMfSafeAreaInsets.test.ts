// Test the logic of useMFSafeAreaInsets by calling the hook in a minimal React context
import React from 'react';

// We need to test useMFSafeAreaInsets which uses useSafeAreaInsets (mocked)
// and returns filtered insets. We'll test the logic directly.
describe('useMFSafeAreaInsets', () => {
    let useMFSafeAreaInsets: typeof import('../../src/hooks/useMfSafeAreaInsets').useMFSafeAreaInsets;

    beforeEach(() => {
        jest.resetModules();
        useMFSafeAreaInsets = require('../../src/hooks/useMfSafeAreaInsets').useMFSafeAreaInsets;
    });

    // Helper to call hook in a React context
    function callHook(applyInsets: Parameters<typeof useMFSafeAreaInsets>[0]) {
        let result: ReturnType<typeof useMFSafeAreaInsets>;
        function TestComponent() {
            result = useMFSafeAreaInsets(applyInsets);
            return null;
        }

        // Use React's internal renderToString equivalent for hooks
        const renderer = require('react-test-renderer');
        renderer.act(() => {
            renderer.create(React.createElement(TestComponent));
        });
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
