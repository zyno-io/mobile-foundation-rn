import { computeScrollIntoViewOffset, hasHeightOrFlexProps } from '../../src/helpers/layout';

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

describe('computeScrollIntoViewOffset', () => {
    // a 400px viewport with a 10px padding; targets are content-relative (unscrolled) coordinates
    const base = { viewportHeight: 400, padding: 10 };

    it('returns null when the target is already fully visible', () => {
        expect(computeScrollIntoViewOffset({ ...base, targetTop: 100, targetHeight: 50, scrollOffset: 0 })).toBeNull();
    });

    it('returns null when fully visible at a non-zero scroll offset', () => {
        expect(computeScrollIntoViewOffset({ ...base, targetTop: 500, targetHeight: 50, scrollOffset: 300 })).toBeNull();
    });

    it('scrolls a target occluded at the bottom so it sits padding above the bottom edge', () => {
        // bottom = 750, wanted at 400 - 10 → offset 360
        expect(computeScrollIntoViewOffset({ ...base, targetTop: 700, targetHeight: 50, scrollOffset: 0 })).toBe(360);
    });

    it('does not add the current scroll offset to a content-relative target (regression)', () => {
        // the target is at content y=700 regardless of how far we've scrolled: the answer must be the same
        expect(computeScrollIntoViewOffset({ ...base, targetTop: 700, targetHeight: 50, scrollOffset: 300 })).toBe(360);
        expect(computeScrollIntoViewOffset({ ...base, targetTop: 700, targetHeight: 50, scrollOffset: 0 })).toBe(360);
    });

    it('treats a target within padding of the bottom edge as occluded', () => {
        // bottom = 395, visible bottom = 400, but padding wants 10 → 405 - 400 = 5
        expect(computeScrollIntoViewOffset({ ...base, targetTop: 345, targetHeight: 50, scrollOffset: 0 })).toBe(5);
    });

    it('scrolls up when the target is cut off at the top', () => {
        expect(computeScrollIntoViewOffset({ ...base, targetTop: 280, targetHeight: 50, scrollOffset: 300 })).toBe(270);
    });

    it('never returns a negative offset', () => {
        expect(computeScrollIntoViewOffset({ ...base, targetTop: 5, targetHeight: 50, scrollOffset: 20 })).toBe(0);
    });

    it('keeps the bottom of a target taller than the viewport in view', () => {
        // bottom = 1100 → offset 1100 + 10 - 400 = 710 (the top is necessarily cut off)
        expect(computeScrollIntoViewOffset({ ...base, targetTop: 600, targetHeight: 500, scrollOffset: 0 })).toBe(710);
    });

    it('leaves a too-tall target alone once its bottom is visible, even though its top is cut off', () => {
        expect(computeScrollIntoViewOffset({ ...base, targetTop: 600, targetHeight: 500, scrollOffset: 710 })).toBeNull();
        expect(computeScrollIntoViewOffset({ ...base, targetTop: 600, targetHeight: 500, scrollOffset: 800 })).toBeNull();
    });

    it('ignores sub-point differences from fractional layouts', () => {
        expect(computeScrollIntoViewOffset({ ...base, targetTop: 700.4, targetHeight: 50, scrollOffset: 360 })).toBeNull();
        expect(computeScrollIntoViewOffset({ ...base, targetTop: 702, targetHeight: 50, scrollOffset: 360 })).toBe(362);
    });

    it('defaults padding to 0', () => {
        expect(computeScrollIntoViewOffset({ viewportHeight: 400, targetTop: 350, targetHeight: 50, scrollOffset: 0 })).toBeNull();
        expect(computeScrollIntoViewOffset({ viewportHeight: 400, targetTop: 351, targetHeight: 50, scrollOffset: 0 })).toBe(1);
    });
});
