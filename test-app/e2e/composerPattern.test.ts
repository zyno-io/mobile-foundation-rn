import { device, element, by, waitFor, expect as detoxExpect } from 'detox';
import { navigateTo, waitForKeyboard, waitForKeyboardDismiss, assertAboveKeyboard, reloadApp, launchApp } from './helpers';

describe('Screen 7: Composer in Tab Stack', () => {
    beforeAll(async () => {
        await launchApp();
    });

    beforeEach(async () => {
        await reloadApp();
        await navigateTo('ComposerPattern');
    });

    it('composer visible at bottom on load (above tab bar)', async () => {
        await waitFor(element(by.id('composer-input'))).toBeVisible().withTimeout(3000);
        await detoxExpect(element(by.id('composer-input'))).toBeVisible();
    });

    it('tap composer → keyboard opens → composer slides up above keyboard', async () => {
        await element(by.id('composer-input')).tap();
        await waitForKeyboard();

        await detoxExpect(element(by.id('composer-input'))).toBeVisible();
        await assertAboveKeyboard('composer-input');
    });

    it('type text → text appears', async () => {
        await element(by.id('composer-input')).tap();
        await waitForKeyboard();

        await element(by.id('composer-input')).replaceText('Hello from composer');
        await detoxExpect(element(by.id('composer-input'))).toHaveText('Hello from composer');
    });

    it('dismiss keyboard → composer returns to above-tab-bar position', async () => {
        await element(by.id('composer-input')).tap();
        await waitForKeyboard();

        // Tap outside to dismiss
        await element(by.text('Message 1')).tap();
        await waitForKeyboardDismiss();

        await detoxExpect(element(by.id('composer-input'))).toBeVisible();
    });

    it('switch to Empty tab → return to Chat tab → tap composer → still works', async () => {
        // Switch to empty tab using its label text
        await element(by.text('Empty1')).tap();
        await new Promise(resolve => setTimeout(resolve, 500));

        // Switch back
        await element(by.text('Chat')).tap();
        await waitFor(element(by.id('composer-input'))).toBeVisible().withTimeout(2000);

        // Tap composer
        await element(by.id('composer-input')).tap();
        await waitForKeyboard();

        await detoxExpect(element(by.id('composer-input'))).toBeVisible();
    });
});
