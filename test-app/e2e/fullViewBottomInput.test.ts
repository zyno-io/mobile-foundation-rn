import { device, element, by, waitFor, expect as detoxExpect } from 'detox';
import { navigateTo, waitForKeyboard, waitForKeyboardDismiss, assertAboveKeyboard, reloadApp, launchApp } from './helpers';

describe('Screen 1: Full View — Bottom Input', () => {
    beforeAll(async () => {
        await launchApp();
    });

    beforeEach(async () => {
        await reloadApp();
        await navigateTo('FullViewBottomInput');
    });

    it('tap input → keyboard opens → input visible above keyboard', async () => {
        await element(by.id('bottom-input')).tap();
        await waitForKeyboard();

        await detoxExpect(element(by.id('bottom-input'))).toBeVisible();
        await assertAboveKeyboard('bottom-input');
    });

    it('type text → text appears in input', async () => {
        await element(by.id('bottom-input')).tap();
        await waitForKeyboard();

        await element(by.id('bottom-input')).replaceText('Hello World');
        await detoxExpect(element(by.id('bottom-input'))).toHaveText('Hello World');
    });

    it('dismiss keyboard → input returns to original position', async () => {
        await element(by.id('bottom-input')).tap();
        await waitForKeyboard();

        // Tap outside the input to dismiss keyboard
        await element(by.text('Content fills the screen')).tap();
        await waitForKeyboardDismiss();

        await detoxExpect(element(by.id('bottom-input'))).toBeVisible();
    });

    it('rotate to landscape → tap input → input still visible', async () => {
        await device.setOrientation('landscape');
        await element(by.id('bottom-input')).tap();
        await waitForKeyboard();

        await detoxExpect(element(by.id('bottom-input'))).toBeVisible();

        // Restore orientation
        await device.setOrientation('portrait');
    });
});
