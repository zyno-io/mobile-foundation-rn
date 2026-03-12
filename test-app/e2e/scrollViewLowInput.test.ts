import { device, element, by, waitFor, expect as detoxExpect } from 'detox';
import { navigateTo, waitForKeyboard, waitForKeyboardDismiss, assertAboveKeyboard, reloadApp, launchApp } from './helpers';

describe('Screen 3: ScrollView — Low Input', () => {
    beforeAll(async () => {
        await launchApp();
    });

    beforeEach(async () => {
        await reloadApp();
        await navigateTo('ScrollViewLowInput');
    });

    it('tap low input → scrolls into view above keyboard', async () => {
        // Scroll down to find the low input
        await waitFor(element(by.id('low-input')))
            .toBeVisible()
            .whileElement(by.id('scroll-view'))
            .scroll(200, 'down');

        await element(by.id('low-input')).tap();
        await waitForKeyboard();

        await detoxExpect(element(by.id('low-input'))).toBeVisible();
        await assertAboveKeyboard('low-input');
    });

    it('input fully visible — no part obscured by keyboard', async () => {
        await waitFor(element(by.id('low-input')))
            .toBeVisible()
            .whileElement(by.id('scroll-view'))
            .scroll(200, 'down');

        await element(by.id('low-input')).tap();
        await waitForKeyboard();

        await detoxExpect(element(by.id('low-input'))).toBeVisible();
    });

    it('dismiss keyboard → scroll freely', async () => {
        // Scroll to top to ensure input-1 is visible
        await element(by.id('scroll-view')).scrollTo('top');
        await waitFor(element(by.id('input-1')))
            .toBeVisible()
            .withTimeout(3000);
        await element(by.id('input-1')).tap();
        await waitForKeyboard();

        // Dismiss keyboard
        if (device.getPlatform() === 'android') {
            await device.pressBack();
        } else {
            await element(by.text('Spacer')).atIndex(0).tap();
        }
        await waitForKeyboardDismiss();

        // Should be able to scroll normally — verify the low input can be scrolled into view
        await waitFor(element(by.id('low-input')))
            .toBeVisible()
            .whileElement(by.id('scroll-view'))
            .scroll(200, 'down');

        await detoxExpect(element(by.id('low-input'))).toBeVisible();
    });

    it('focus input-1 (already visible) → no unnecessary scroll jump', async () => {
        // Scroll to top to ensure input-1 is visible
        await element(by.id('scroll-view')).scrollTo('top');
        await waitFor(element(by.id('input-1')))
            .toBeVisible()
            .withTimeout(3000);
        await element(by.id('input-1')).tap();
        await waitForKeyboard();

        // Input 1 should still be visible without scrolling
        await detoxExpect(element(by.id('input-1'))).toBeVisible();
    });
});
