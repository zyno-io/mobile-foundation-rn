import { hasHeightOrFlexProps } from '../../src/helpers/layout';

describe('hasHeightOrFlexProps', () => {
    it('returns true for height', () => {
        expect(hasHeightOrFlexProps({ height: 100 })).toBe(true);
    });

    it('returns true for flex', () => {
        expect(hasHeightOrFlexProps({ flex: 1 })).toBe(true);
    });

    it('returns true for flexGrow', () => {
        expect(hasHeightOrFlexProps({ flexGrow: 1 })).toBe(true);
    });

    it('returns true for flexShrink', () => {
        expect(hasHeightOrFlexProps({ flexShrink: 0 })).toBe(true);
    });

    it('returns true for flexBasis', () => {
        expect(hasHeightOrFlexProps({ flexBasis: 'auto' })).toBe(true);
    });

    it('returns false for unrelated props only', () => {
        expect(hasHeightOrFlexProps({ width: 100, padding: 10 })).toBe(false);
    });

    it('returns false for empty object', () => {
        expect(hasHeightOrFlexProps({})).toBe(false);
    });

    it('returns true when mixed with other props', () => {
        expect(hasHeightOrFlexProps({ width: 100, flex: 1, padding: 10 })).toBe(true);
    });
});
