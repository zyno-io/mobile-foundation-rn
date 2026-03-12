import { device, element, by, waitFor, expect as detoxExpect } from 'detox';
import { navigateTo, waitForKeyboard, waitForKeyboardDismiss, reloadApp, launchApp } from './helpers';

describe('Screen 2: Tab Bar — Bottom Input', () => {
    beforeAll(async () => {
        await launchApp();
    });

    beforeEach(async () => {
        await reloadApp();
        await navigateTo('TabBarBottomInput');
    });

    it('input visible above tab bar (no keyboard)', async () => {
        await detoxExpect(element(by.id('tab-input'))).toBeVisible();
    });

    it('tap input → keyboard opens → input visible above keyboard', async () => {
        await element(by.id('tab-input')).tap();
        await waitForKeyboard();

        await detoxExpect(element(by.id('tab-input'))).toBeVisible();
    });

    it('switch tabs → return → tap input → still works', async () => {
        // Switch to another tab — use text on Android, accessibility label on iOS
        if (device.getPlatform() === 'android') {
            await element(by.text('EmptyTab1')).tap();
            await new Promise(resolve => setTimeout(resolve, 500));
            await element(by.text('InputTab')).tap();
        } else {
            await element(by.label('EmptyTab1, tab, 2 of 4')).tap();
            await new Promise(resolve => setTimeout(resolve, 500));
            await element(by.label('InputTab, tab, 1 of 4')).tap();
        }
        await waitFor(element(by.id('tab-input'))).toBeVisible().withTimeout(3000);

        // Tap input
        await element(by.id('tab-input')).tap();
        await waitForKeyboard();

        await detoxExpect(element(by.id('tab-input'))).toBeVisible();
    });

    it('keyboard open → dismiss → input returns to above-tab-bar position', async () => {
        await element(by.id('tab-input')).tap();
        await waitForKeyboard();

        // Dismiss keyboard by tapping content area
        await element(by.text('Tab content')).tap();
        await waitForKeyboardDismiss();

        // Input should still be visible above tab bar after keyboard dismiss
        await detoxExpect(element(by.id('tab-input'))).toBeVisible();
    });
});
