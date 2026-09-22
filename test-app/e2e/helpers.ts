import { execSync } from 'child_process';
import { device, element, by, waitFor, expect as detoxExpect } from 'detox';

/** Launch the app fresh and apply platform-specific setup */
export async function launchApp() {
    await device.launchApp({ newInstance: true });
    if (device.getPlatform() === 'ios') {
        await device.setURLBlacklist(['.*sentry.*', '.*logger.*']);
    }
}

/**
 * Reset the app between tests with a fresh process.
 *
 * Never use device.reloadReactNative(). Detox's CFRunLoopPerformBlock spy opens a single-use
 * sync resource per block and closes it only when that block runs, so a block left behind on
 * the JS run loop as RN tears it down keeps the app "busy" forever. The app then never reports
 * idle and every subsequent reload hangs until the test times out. Reproduces on RN 0.86 within
 * ~5 reloads; a fresh process is the only way out. Android has never supported it either.
 */
export async function reloadApp() {
    await launchApp();
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

/**
 * Enable or disable the system "larger text" setting — Dynamic Type on iOS, font scale on Android.
 * Relaunch the app afterwards (`launchApp`/`reloadApp`) so the new scale is picked up.
 */
export async function setLargerText(enabled: boolean) {
    if (device.getPlatform() === 'ios') {
        // accessibility-large ≈ 2.1x font scale; large is the iOS default
        const size = enabled ? 'accessibility-large' : 'large';
        execSync(`xcrun simctl bootstatus ${device.id} -b`, { stdio: 'ignore' });
        execSync(`xcrun simctl ui ${device.id} content_size ${size}`, { stdio: 'inherit' });
    } else {
        const scale = enabled ? '1.5' : '1.0';
        execSync(`adb -s ${device.id} shell settings put system font_scale ${scale}`, { stdio: 'inherit' });
    }
}

export interface ScreenMetrics {
    /** Screen height in dp/points (as reported by `Dimensions.get('screen')`) */
    screenHeight: number;
    /** Keyboard height in dp/points, 0 while closed */
    keyboardHeight: number;
    fontScale: number;
    pixelRatio: number;
}

/** Read the metrics readout a test screen exposes via `testID="metrics"` (accessibilityLabel holds JSON). */
export async function getMetrics(): Promise<ScreenMetrics> {
    const attrs = await element(by.id('metrics')).getAttributes() as any;
    const raw: string = attrs.label ?? attrs.text;
    if (!raw) throw new Error(`metrics element has no label/text: ${JSON.stringify(attrs)}`);
    return JSON.parse(raw);
}

/**
 * Multiplier converting dp/points to the unit Detox reports frames in:
 * points on iOS (1x), physical pixels on Android (the pixel ratio).
 */
export function frameScale(metrics: ScreenMetrics) {
    return device.getPlatform() === 'android' ? metrics.pixelRatio : 1;
}

/**
 * Assert an element sits entirely inside its scroll view's frame while the keyboard is open — i.e.
 * auto-scroll neither left it under the keyboard nor overshot and cut off its top. MfWrapperView pads the
 * scroll view by the keyboard height, so the scroll view's frame ends at the keyboard line; the keyboard
 * line is checked again from the metrics readout as a second opinion.
 */
export async function assertFullyVisibleAboveKeyboard(testID: string, scrollViewID = 'scroll-view') {
    const metrics = await getMetrics();
    if (metrics.keyboardHeight <= 0) {
        throw new Error(`Keyboard is not open (metrics: ${JSON.stringify(metrics)})`);
    }
    const frame = await getElementFrame(testID);
    const scrollFrame = await getElementFrame(scrollViewID);

    const scale = frameScale(metrics);
    const keyboardTop = (metrics.screenHeight - metrics.keyboardHeight) * scale;
    const tolerance = 2 * scale;
    const describe = () =>
        `Frame: ${JSON.stringify(frame)}. Scroll view frame: ${JSON.stringify(scrollFrame)}. ` +
        `Keyboard top: ${keyboardTop}. Metrics: ${JSON.stringify(metrics)}`;

    const top = frame.y;
    const bottom = frame.y + frame.height;
    const scrollBottom = scrollFrame.y + scrollFrame.height;
    if (top < scrollFrame.y - tolerance) {
        throw new Error(`Element "${testID}" top (${top}) is cut off above the scroll view. ${describe()}`);
    }
    if (bottom > scrollBottom + tolerance) {
        throw new Error(`Element "${testID}" bottom (${bottom}) is below the scroll view (under the keyboard). ${describe()}`);
    }
    if (bottom > keyboardTop + tolerance) {
        throw new Error(`Element "${testID}" bottom (${bottom}) is under the keyboard line. ${describe()}`);
    }
    // 95 rather than 100: sub-point clipping after a fractional scroll offset must not fail the suite
    await detoxExpect(element(by.id(testID))).toBeVisible(95);
}
