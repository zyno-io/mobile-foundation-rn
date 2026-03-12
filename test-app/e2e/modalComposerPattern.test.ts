import { device, element, by, waitFor, expect as detoxExpect } from 'detox';
import { navigateTo, waitForKeyboard, assertAboveKeyboard, reloadApp, launchApp } from './helpers';

describe('Screen 8: Modal Composer', () => {
    beforeAll(async () => {
        await launchApp();
    });

    beforeEach(async () => {
        await reloadApp();
        await navigateTo('ModalComposerPattern');
    });

    it('composer visible at bottom of modal with header visible above', async () => {
        await waitFor(element(by.text('New Message'))).toBeVisible().withTimeout(3000);
        await waitFor(element(by.id('modal-composer-input'))).toBeVisible().withTimeout(3000);
    });

    it('tap → keyboard opens → composer above keyboard', async () => {
        await element(by.id('modal-composer-input')).tap();
        await waitForKeyboard();

        await detoxExpect(element(by.id('modal-composer-input'))).toBeVisible();
        await assertAboveKeyboard('modal-composer-input');
    });

    it('type text → text appears in composer', async () => {
        await element(by.id('modal-composer-input')).tap();
        await waitForKeyboard();

        await element(by.id('modal-composer-input')).replaceText('Modal message');
        await detoxExpect(element(by.id('modal-composer-input'))).toHaveText('Modal message');
    });

    it('swipe-to-dismiss partially → cancel → type → still works', async () => {
        // Partial swipe down on the modal
        await element(by.id('modal-composer-input')).swipe('down', 'slow', 0.15);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Input should still be usable
        await element(by.id('modal-composer-input')).tap();
        await waitForKeyboard();

        await element(by.id('modal-composer-input')).replaceText('After swipe');
        await detoxExpect(element(by.id('modal-composer-input'))).toHaveText('After swipe');
    });
});
