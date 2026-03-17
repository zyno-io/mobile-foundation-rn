import { device, element, by, waitFor, expect as detoxExpect } from 'detox';

/** Launch the app fresh and apply platform-specific setup */
export async function launchApp() {
    await device.launchApp({ newInstance: true });
    if (device.getPlatform() === 'ios') {
        await device.setURLBlacklist(['.*sentry.*', '.*logger.*']);
    }
}

/** Reload the app - uses launchApp on Android (reloadReactNative doesn't work with New Arch) */
export async function reloadApp() {
    if (device.getPlatform() === 'android') {
        await device.launchApp({ newInstance: true });
    } else {
        await device.reloadReactNative();
    }
}

/** Navigate from HomeScreen to a test screen by testID */
export async function navigateTo(screenName: string) {
    await waitFor(element(by.id('home-scroll')))
        .toBeVisible()
        .withTimeout(5000);
    await waitFor(element(by.id(`nav-${screenName}`)))
        .toBeVisible()
        .whileElement(by.id('home-scroll'))
        .scroll(200, 'down');
    await element(by.id(`nav-${screenName}`)).tap();
}

/** Navigate back to HomeScreen */
export async function goHome() {
    await device.pressBack();
}

/** Wait for keyboard to appear and settle */
export async function waitForKeyboard() {
    // Allow time for keyboard animation + layout recalculation to complete
    await new Promise(resolve => setTimeout(resolve, 1500));
}

/** Wait for keyboard to dismiss and settle */
export async function waitForKeyboardDismiss() {
    await new Promise(resolve => setTimeout(resolve, 800));
}

/** Dismiss the keyboard in a platform-aware way */
export async function dismissKeyboard() {
    if (device.getPlatform() === 'android') {
        await device.pressBack();
    } else {
        // On iOS, tap outside - caller should handle this contextually
        // This is a fallback
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    await waitForKeyboardDismiss();
}

/** Get element attributes (position, size) */
export async function getElementFrame(testID: string) {
    const attrs = await element(by.id(testID)).getAttributes() as any;

    if (device.getPlatform() === 'android') {
        // Android returns visibility, height, width, elevation, alpha, etc.
        // Coordinates are in the 'frame' or directly on the attributes
        return {
            x: attrs.frame?.x ?? attrs.x ?? 0,
            y: attrs.frame?.y ?? attrs.y ?? 0,
            width: attrs.frame?.width ?? attrs.width ?? 0,
            height: attrs.frame?.height ?? attrs.height ?? 0,
        };
    }

    // iOS returns frame as { x, y, width, height }
    return attrs.frame as {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

/** Assert that an element is fully above the keyboard */
export async function assertAboveKeyboard(testID: string) {
    const frame = await getElementFrame(testID);

    // The element should be visible (Detox verifies this).
    await detoxExpect(element(by.id(testID))).toBeVisible();

    // Input bottom should be in the upper portion of the screen (above keyboard region).
    // Android reports coordinates in physical pixels (density ~2.75-3x), so use a higher threshold.
    // iOS uses points (~390-430 wide), Android uses pixels (~1080-2340 wide).
    const threshold = device.getPlatform() === 'android' ? 2000 : 800;
    const inputBottom = frame.y + frame.height;
    if (inputBottom > threshold) {
        throw new Error(
            `Element "${testID}" bottom (${inputBottom}) appears to be below keyboard area. ` +
            `Threshold: ${threshold}. Frame: ${JSON.stringify(frame)}`,
        );
    }
}
