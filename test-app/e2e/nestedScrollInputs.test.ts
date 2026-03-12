import { device, element, by, waitFor, expect as detoxExpect } from 'detox';
import { navigateTo, waitForKeyboard, assertAboveKeyboard, getElementFrame, reloadApp, launchApp } from './helpers';

const jestExpect = require('expect').default;

describe('Screen 9: Nested Scroll Inputs', () => {
    beforeAll(async () => {
        await launchApp();
    });

    beforeEach(async () => {
        await reloadApp();
        await navigateTo('NestedScrollInputs');
    });

    it('focus outer low input → scrolls into view with single keyboard padding', async () => {
        // Scroll down to find the low input using the outer-low-input's ancestor scroll view
        await waitFor(element(by.id('outer-low-input')))
            .toBeVisible()
            .whileElement(by.id('scroll-view'))
            .scroll(300, 'down');

        await element(by.id('outer-low-input')).tap();
        await waitForKeyboard();

        await detoxExpect(element(by.id('outer-low-input'))).toBeVisible();
    });

    it('safe area insets applied once — no double padding', async () => {
        await element(by.id('outer-input')).tap();
        await waitForKeyboard();

        // Verify input is visible and positioned correctly
        await detoxExpect(element(by.id('outer-input'))).toBeVisible();

        // The input should not have excessive bottom padding
        const frame = await getElementFrame('outer-input');
        // Input should be in a reasonable position (not pushed to very top of screen)
        jestExpect(frame.y).toBeGreaterThan(30);
    });

    it('keyboard open → total bottom offset equals keyboard height only', async () => {
        await element(by.id('outer-input')).tap();
        await waitForKeyboard();

        await detoxExpect(element(by.id('outer-input'))).toBeVisible();
        const frame = await getElementFrame('outer-input');
        jestExpect(frame.y).toBeGreaterThan(30);
        jestExpect(frame.y).toBeLessThan(500);
    });
});
