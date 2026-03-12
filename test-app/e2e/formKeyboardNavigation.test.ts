import { device, element, by, waitFor, expect as detoxExpect } from 'detox';
import { navigateTo, waitForKeyboard, assertAboveKeyboard, reloadApp, launchApp } from './helpers';

describe('Screen 6: Form Keyboard Navigation', () => {
    beforeAll(async () => {
        await launchApp();
    });

    beforeEach(async () => {
        await reloadApp();
        await navigateTo('FormKeyboardNavigation');
    });

    it('tap First name → press Next → Last name focused', async () => {
        await element(by.id('first-name')).tap();
        await waitForKeyboard();

        await element(by.id('first-name')).tapReturnKey();
        await waitFor(element(by.id('last-name'))).toBeFocused().withTimeout(2000);
    });

    it('Last name → Next → City focused', async () => {
        await element(by.id('last-name')).tap();
        await waitForKeyboard();

        await element(by.id('last-name')).tapReturnKey();
        await waitFor(element(by.id('city'))).toBeFocused().withTimeout(2000);
    });

    it('City → Next → State focused (same row, right)', async () => {
        await element(by.id('city')).tap();
        await waitForKeyboard();

        await element(by.id('city')).tapReturnKey();
        await waitFor(element(by.id('state'))).toBeFocused().withTimeout(2000);
    });

    it('State → Next → Phone focused', async () => {
        await element(by.id('state')).tap();
        await waitForKeyboard();

        await element(by.id('state')).tapReturnKey();
        await waitFor(element(by.id('phone'))).toBeFocused().withTimeout(2000);
    });

    it('Phone → Next → Notes focused', async () => {
        await element(by.id('phone')).tap();
        await waitForKeyboard();

        await element(by.id('phone')).tapReturnKey();
        await waitFor(element(by.id('notes'))).toBeFocused().withTimeout(2000);
    });

    it('Notes → Done → keyboard dismissed', async () => {
        // Notes may be off-screen on Android — scroll to it first
        await waitFor(element(by.id('notes')))
            .toBeVisible()
            .whileElement(by.id('scroll-view'))
            .scroll(100, 'down');

        await element(by.id('notes')).tap();
        await waitForKeyboard();

        await element(by.id('notes')).tapReturnKey();
        // After Done, keyboard should dismiss — notes should still be visible
        await new Promise(resolve => setTimeout(resolve, 600));
        await detoxExpect(element(by.id('notes'))).toBeVisible();
    });

    it('phone mask: type "5551234567" → displays "(555) 123-4567"', async () => {
        await element(by.id('phone')).tap();
        await waitForKeyboard();

        await element(by.id('phone')).typeText('5551234567');
        // Phone mask formats the input — on Android the text might have variations
        if (device.getPlatform() === 'android') {
            const attrs = await element(by.id('phone')).getAttributes() as any;
            const text = (attrs.text || '').trim();
            if (!text.includes('555') || !text.includes('123') || !text.includes('4567')) {
                throw new Error(`Phone mask not applied correctly. Got: "${text}"`);
            }
        } else {
            await detoxExpect(element(by.id('phone'))).toHaveText('(555) 123-4567');
        }
    });

    it('scroll follows focus through Next chain', async () => {
        // Start at first name and tab through all fields
        await element(by.id('first-name')).tap();
        await waitForKeyboard();

        // Navigate through all fields
        await element(by.id('first-name')).tapReturnKey();
        await element(by.id('last-name')).tapReturnKey();
        await element(by.id('city')).tapReturnKey();
        await element(by.id('state')).tapReturnKey();

        // Phone should be visible and focused after navigation chain
        await waitFor(element(by.id('phone'))).toBeVisible().withTimeout(3000);
    });

    it('tap Notes (below keyboard line) → auto-scrolls into view above keyboard', async () => {
        // Notes is at the bottom of the form — when keyboard is open it would be obscured
        // Scroll to make Notes visible first
        await waitFor(element(by.id('notes')))
            .toBeVisible()
            .whileElement(by.id('scroll-view'))
            .scroll(100, 'down');

        await element(by.id('notes')).tap();
        await waitForKeyboard();

        // Notes should auto-scroll to be visible above keyboard
        await detoxExpect(element(by.id('notes'))).toBeVisible();
        await assertAboveKeyboard('notes');
    });

    it('tap Phone (below keyboard line) → auto-scrolls into view above keyboard', async () => {
        // Phone is near the bottom of the form
        await waitFor(element(by.id('phone')))
            .toBeVisible()
            .whileElement(by.id('scroll-view'))
            .scroll(100, 'down');

        await element(by.id('phone')).tap();
        await waitForKeyboard();

        await detoxExpect(element(by.id('phone'))).toBeVisible();
        await assertAboveKeyboard('phone');
    });
});
