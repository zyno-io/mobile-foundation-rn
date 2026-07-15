interface Deferred<T> {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((promiseResolve, promiseReject) => {
        resolve = promiseResolve;
        reject = promiseReject;
    });
    return { promise, resolve, reject };
}

async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
}

describe('linking URL delivery', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    function setup(initialUrlPromise: Promise<string | null> = Promise.resolve(null)) {
        const Linking = require('expo-linking');
        let emitUrl!: (url: string) => void;
        const remove = jest.fn();

        Linking.getInitialURL.mockReturnValue(initialUrlPromise);
        Linking.addEventListener.mockImplementation((event: string, listener: (event: { url: string }) => void) => {
            expect(event).toBe('url');
            emitUrl = url => listener({ url });
            return { remove };
        });

        const linking = require('../../src/hooks/useLinkingUrl');
        return { Linking, linking, emitUrl: (url: string) => emitUrl(url), remove };
    }

    it('captures the initial URL before a handler subscribes', async () => {
        const initialUrl = deferred<string | null>();
        const { linking } = setup(initialUrl.promise);

        initialUrl.resolve('myapp://cold-start');
        await flushPromises();

        const handler = jest.fn();
        linking.subscribeToLinkingUrls(handler);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith('myapp://cold-start');
        expect(linking.getLinkingUrl()).toBe('myapp://cold-start');
    });

    it('returns null while the initial URL lookup is pending', () => {
        const initialUrl = deferred<string | null>();
        const { linking } = setup(initialUrl.promise);

        expect(linking.getLinkingUrl()).toBeNull();
    });

    it('delivers the initial URL when it resolves after subscription', async () => {
        const initialUrl = deferred<string | null>();
        const { linking } = setup(initialUrl.promise);
        const handler = jest.fn();
        linking.subscribeToLinkingUrls(handler);

        initialUrl.resolve('myapp://late-cold-start');
        await flushPromises();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith('myapp://late-cold-start');
    });

    it('delivers foreground URL events without waiting for an AppState transition', async () => {
        const { linking, emitUrl } = setup();
        const handler = jest.fn();
        linking.subscribeToLinkingUrls(handler);
        await flushPromises();

        emitUrl('myapp://foreground');

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith('myapp://foreground');
    });

    it('preserves launch-before-event ordering while getInitialURL is pending', async () => {
        const initialUrl = deferred<string | null>();
        const { linking, emitUrl } = setup(initialUrl.promise);
        const received: string[] = [];
        linking.subscribeToLinkingUrls(url => received.push(url));

        emitUrl('myapp://warm-start');
        expect(received).toEqual([]);

        initialUrl.resolve('myapp://cold-start');
        await flushPromises();

        expect(received).toEqual(['myapp://cold-start', 'myapp://warm-start']);
        expect(linking.getLinkingUrl()).toBe('myapp://warm-start');
    });

    it('flushes early URL events when there is no initial URL', async () => {
        const initialUrl = deferred<string | null>();
        const { linking, emitUrl } = setup(initialUrl.promise);
        const handler = jest.fn();
        linking.subscribeToLinkingUrls(handler);

        emitUrl('myapp://during-startup');
        initialUrl.resolve(null);
        await flushPromises();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith('myapp://during-startup');
    });

    it('treats repeated identical URLs as separate events', async () => {
        const { linking, emitUrl } = setup();
        const handler = jest.fn();
        linking.subscribeToLinkingUrls(handler);
        await flushPromises();

        emitUrl('myapp://same');
        emitUrl('myapp://same');

        expect(handler).toHaveBeenCalledTimes(2);
        expect(handler).toHaveBeenNthCalledWith(1, 'myapp://same');
        expect(handler).toHaveBeenNthCalledWith(2, 'myapp://same');
    });

    it('queues events while unsubscribed and drains them in order on remount', async () => {
        const { linking, emitUrl } = setup();
        const firstHandler = jest.fn();
        const unsubscribe = linking.subscribeToLinkingUrls(firstHandler);
        await flushPromises();
        unsubscribe();

        emitUrl('myapp://queued-one');
        emitUrl('myapp://queued-two');
        expect(firstHandler).not.toHaveBeenCalled();

        const secondHandler = jest.fn();
        linking.subscribeToLinkingUrls(secondHandler);

        expect(secondHandler.mock.calls).toEqual([
            ['myapp://queued-one'],
            ['myapp://queued-two'],
        ]);
    });

    it('does not let stale cleanup remove a newer subscriber', async () => {
        const { linking, emitUrl } = setup();
        const firstHandler = jest.fn();
        const secondHandler = jest.fn();
        const unsubscribeFirst = linking.subscribeToLinkingUrls(firstHandler);
        linking.subscribeToLinkingUrls(secondHandler);
        await flushPromises();

        unsubscribeFirst();
        emitUrl('myapp://new-owner');

        expect(firstHandler).not.toHaveBeenCalled();
        expect(secondHandler).toHaveBeenCalledWith('myapp://new-owner');
    });

    it('continues delivering after an app handler throws', async () => {
        const { linking, emitUrl } = setup();
        const handler = jest.fn((url: string) => {
            if (url === 'myapp://broken') throw new Error('handler failed');
        });
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        linking.subscribeToLinkingUrls(handler);
        await flushPromises();

        emitUrl('myapp://broken');
        emitUrl('myapp://still-delivered');

        expect(handler.mock.calls).toEqual([
            ['myapp://broken'],
            ['myapp://still-delivered'],
        ]);
        expect(consoleError).toHaveBeenCalledWith(
            '@zyno-io/mobile-foundation-rn: deepLinkHandler failed',
            expect.any(Error),
        );
        consoleError.mockRestore();
    });

    it('continues with queued events if the initial URL lookup rejects', async () => {
        const initialUrl = deferred<string | null>();
        const { linking, emitUrl } = setup(initialUrl.promise);
        const handler = jest.fn();
        linking.subscribeToLinkingUrls(handler);

        emitUrl('myapp://after-failure');
        initialUrl.reject(new Error('native lookup failed'));
        await flushPromises();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith('myapp://after-failure');
        expect(linking.getLinkingUrl()).toBe('myapp://after-failure');
    });

    it('keeps a single app-lifetime native subscription', () => {
        const { Linking, linking, remove } = setup();
        const unsubscribe = linking.subscribeToLinkingUrls(jest.fn());

        unsubscribe();

        expect(Linking.getInitialURL).toHaveBeenCalledTimes(1);
        expect(Linking.addEventListener).toHaveBeenCalledTimes(1);
        expect(remove).not.toHaveBeenCalled();
    });
});
