import { ViewStyle } from 'react-native';

export function hasHeightOrFlexProps(style: ViewStyle): boolean {
    return (
        style.height !== undefined ||
        style.flex !== undefined ||
        style.flexGrow !== undefined ||
        style.flexShrink !== undefined ||
        style.flexBasis !== undefined
    );
}

export interface ScrollIntoViewParams {
    /** Top edge of the target, relative to the scroll view's content (i.e. unaffected by the current scroll offset). */
    targetTop: number;
    targetHeight: number;
    /** The scroll view's current content offset. */
    scrollOffset: number;
    /** Height of the scroll view's visible viewport. */
    viewportHeight: number;
    /** Minimum gap to keep between the target and the viewport edges. */
    padding?: number;
}

/**
 * Computes the content offset that brings a target fully into a scroll view's viewport.
 *
 * Returns `null` when the target is already fully visible (respecting `padding`), so callers can skip
 * an unnecessary scroll. `targetTop` is content-relative — what `measureLayout` reports relative to
 * the scroll view — so the current scroll offset is only used to decide whether scrolling is needed
 * and must NOT be added to the result.
 *
 * A target taller than the viewport can never be fully visible; its bottom edge is kept in view
 * instead (where the caret of a text area usually is) and it is otherwise left alone.
 */
export function computeScrollIntoViewOffset({
    targetTop,
    targetHeight,
    scrollOffset,
    viewportHeight,
    padding = 0
}: ScrollIntoViewParams): number | null {
    const targetBottom = targetTop + targetHeight;
    const visibleTop = scrollOffset;
    const visibleBottom = scrollOffset + viewportHeight;
    const tooTall = targetHeight + padding * 2 > viewportHeight;

    // sub-point differences (font scaling yields fractional layouts) are not worth an animated scroll
    const settle = (offset: number) => (Math.abs(offset - scrollOffset) < 1 ? null : Math.max(0, offset));

    if (targetBottom + padding > visibleBottom) {
        return settle(targetBottom + padding - viewportHeight);
    }

    if (!tooTall && targetTop - padding < visibleTop) {
        return settle(targetTop - padding);
    }

    return null;
}
