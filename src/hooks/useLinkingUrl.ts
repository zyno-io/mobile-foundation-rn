import * as Linking from 'expo-linking';

type LinkingUrlHandler = (url: string) => void;

interface PendingLinkingUrl {
    url: string;
}

// Start collecting as soon as Foundation is imported. MfProvider may not mount until
// the app has finished its own async setup, so subscribing only from a React effect
// leaves a window in which warm-start links can be lost.
let linkingUrl: string | null = null;
let activeHandler: LinkingUrlHandler | undefined;
let isDraining = false;
let initialUrlSettled = false;
const pendingUrls: PendingLinkingUrl[] = [];
const urlsReceivedBeforeInitialUrl: string[] = [];

function drainPendingUrls() {
    if (isDraining) return;

    isDraining = true;
    try {
        while (activeHandler && pendingUrls.length > 0) {
            const handler = activeHandler;
            const pendingUrl = pendingUrls.shift()!;

            try {
                handler(pendingUrl.url);
            } catch (err) {
                // One app-owned handler failure must not poison the queue and
                // prevent all later native URL events from being delivered.
                console.error('@zyno-io/mobile-foundation-rn: deepLinkHandler failed', err);
            }
        }
    } finally {
        isDraining = false;
    }
}

function queueUrl(url: string) {
    linkingUrl = url;
    pendingUrls.push({ url });
}

function enqueueUrl(url: string) {
    queueUrl(url);
    drainPendingUrls();
}

function settleInitialUrl(url: string | null) {
    if (url) {
        queueUrl(url);
    }

    initialUrlSettled = true;
    for (const queuedUrl of urlsReceivedBeforeInitialUrl.splice(0)) {
        queueUrl(queuedUrl);
    }
    drainPendingUrls();
}

void Linking.getInitialURL().then(settleInitialUrl, () => settleInitialUrl(null));

// This is intentionally an app-lifetime subscription. It lets Foundation queue
// URLs that arrive before MfProvider mounts or while it is temporarily unmounted.
Linking.addEventListener('url', ({ url }) => {
    linkingUrl = url;
    if (initialUrlSettled) {
        enqueueUrl(url);
    } else {
        // Preserve event order: the launch URL, when present, is delivered before
        // URL events received while its asynchronous lookup is still pending.
        urlsReceivedBeforeInitialUrl.push(url);
    }
});

/** Returns the most recently observed linking URL, preserving the existing API. */
export function getLinkingUrl(): string | null {
    return linkingUrl;
}

/**
 * Installs the single configured Foundation deep-link consumer and drains URLs
 * captured before it mounted. Repeated identical URLs remain distinct events.
 */
export function subscribeToLinkingUrls(handler: LinkingUrlHandler): () => void {
    activeHandler = handler;
    drainPendingUrls();

    return () => {
        if (activeHandler === handler) activeHandler = undefined;
    };
}
