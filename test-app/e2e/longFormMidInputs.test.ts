import { element, by, waitFor, expect as detoxExpect } from 'detox';
import {
    navigateTo,
    waitForKeyboard,
    waitForKeyboardDismiss,
    reloadApp,
    launchApp,
    setLargerText,
    getMetrics,
    getElementFrame,
    frameScale,
    assertFullyVisibleAboveKeyboard,
} from './helpers';

const jestExpect = require('expect').default;

/**
 * Scroll the form until `testID` is on screen, then focus it. By the time the tap lands the scroll view
 * is already offset — the situation "larger text" creates on real forms, and the one that used to make
 * auto-scroll overshoot (the offset was counted twice) and leave the top of the input off screen.
 */
async function scrollToAndFocus(testID: string) {
    await waitFor(element(by.id(testID)))
        .toBeVisible()
        .whileElement(by.id('scroll-view'))
        .scroll(200, 'down');

    // sanity check the premise: we really are scrolled away from the top
    await detoxExpect(element(by.id('screen-label'))).not.toBeVisible();

    await element(by.id(testID)).tap();
    await waitForKeyboard();
}

/**
 * Close the keyboard without navigating away, leaving the scroll offset where auto-scroll put it.
 * The metrics readout sits outside the scroll view, is always on screen, and dismisses the keyboard on tap.
 */
async function closeKeyboard() {
    await element(by.id('metrics')).tap();
    await waitForKeyboardDismiss();
}

function defineScrollIntoViewTests() {
    it('tap mid text area (scroll view already offset) → fully visible, top not cut off', async () => {
        await scrollToAndFocus('mid-textarea');
        await assertFullyVisibleAboveKeyboard('mid-textarea');
    });

    it('tap mid text input (scroll view already offset) → fully visible, top not cut off', async () => {
        await scrollToAndFocus('mid-input');
        await assertFullyVisibleAboveKeyboard('mid-input');
    });

    it('focus input that is already visible above the keyboard line → no scroll jump', async () => {
        // let auto-scroll park the text area just above the keyboard, then drop the keyboard: the mid
        // input (120px above the text area) is now fully visible, above the keyboard line, at a non-zero
        // scroll offset
        await scrollToAndFocus('mid-textarea');
        await closeKeyboard();
        await detoxExpect(element(by.id('mid-input'))).toBeVisible(95);

        const before = await getElementFrame('mid-input');
        await element(by.id('mid-input')).tap();
        await waitForKeyboard();
        const after = await getElementFrame('mid-input');

        const tolerance = 2 * frameScale(await getMetrics());
        jestExpect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(tolerance);
        await assertFullyVisibleAboveKeyboard('mid-input');
    });

    it('focus top input at scroll offset 0 → no scroll jump', async () => {
        const before = await getElementFrame('top-input');
        await element(by.id('top-input')).tap();
        await waitForKeyboard();
        const after = await getElementFrame('top-input');

        const tolerance = 2 * frameScale(await getMetrics());
        jestExpect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(tolerance);
        await assertFullyVisibleAboveKeyboard('top-input');
    });
}

describe('Screen 10: Long Form — Mid Inputs', () => {
    beforeAll(async () => {
        await setLargerText(false);
        await launchApp();
    });

    beforeEach(async () => {
        await reloadApp();
        await navigateTo('LongFormMidInputs');
    });

    it('runs at the default font scale', async () => {
        const metrics = await getMetrics();
        jestExpect(metrics.fontScale).toBeCloseTo(1, 1);
    });

    defineScrollIntoViewTests();
});

describe('Screen 10: Long Form — Mid Inputs (larger text)', () => {
    beforeAll(async () => {
        await setLargerText(true);
        await launchApp();
    });

    afterAll(async () => {
        await setLargerText(false);
    });

    beforeEach(async () => {
        await reloadApp();
        await navigateTo('LongFormMidInputs');
    });

    it('system larger-text setting is applied to the app', async () => {
        const metrics = await getMetrics();
        jestExpect(metrics.fontScale).toBeGreaterThanOrEqual(1.4);
    });

    defineScrollIntoViewTests();
});
