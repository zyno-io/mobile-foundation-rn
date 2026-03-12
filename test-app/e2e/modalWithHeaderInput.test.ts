import { device, element, by, waitFor, expect as detoxExpect } from 'detox';
import { navigateTo, waitForKeyboard, assertAboveKeyboard, reloadApp, launchApp } from './helpers';

describe('Screen 5: Modal + Header — Input', () => {
    beforeAll(async () => {
        await launchApp();
    });

    beforeEach(async () => {
        await reloadApp();
        await navigateTo('ModalWithHeaderInput');
    });

    it('tap input → keyboard opens → input visible above keyboard', async () => {
        await waitFor(element(by.id('modal-input'))).toBeVisible().withTimeout(3000);

        await element(by.id('modal-input')).tap();
        await waitForKeyboard();

        await detoxExpect(element(by.id('modal-input'))).toBeVisible();
        await assertAboveKeyboard('modal-input');
    });

    it('modal header is visible', async () => {
        await waitFor(element(by.text('Modal Header Test'))).toBeVisible().withTimeout(3000);
        await detoxExpect(element(by.text('Modal Header Test'))).toBeVisible();
    });

    it('swipe-to-dismiss partially → cancel → tap input → still works', async () => {
        // Partially swipe down
        await element(by.id('modal-input')).swipe('down', 'slow', 0.2);
        // Wait for it to snap back
        await new Promise(resolve => setTimeout(resolve, 500));

        await element(by.id('modal-input')).tap();
        await waitForKeyboard();

        await detoxExpect(element(by.id('modal-input'))).toBeVisible();
    });
});
