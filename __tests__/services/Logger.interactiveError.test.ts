import { createMockConfig } from '../test-utils';

const COMMUNICATION_MESSAGE = 'There was an error communicating with the server. Please ensure you have an Internet connection and try again.';

function loadLogger() {
    const configModule = require('../../src/config');
    configModule.configureFoundation(createMockConfig());

    return require('../../src/services/Logger') as typeof import('../../src/services/Logger');
}

async function flushMicrotasks() {
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
    }
}

describe('Logger interactiveError', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    async function lastAlert(err: unknown): Promise<[string, string]> {
        const { createLogger } = loadLogger();
        const { Alert } = require('react-native');

        // Never resolves — the mocked Alert never presses OK — so trigger and flush instead of awaiting
        void createLogger('test').interactiveError(err);
        await flushMicrotasks();

        expect(Alert.alert).toHaveBeenCalledTimes(1);
        const [title, message] = Alert.alert.mock.calls[0];
        return [title, message];
    }

    it("shows the communication dialog for RN fetch's 'Network request failed'", async () => {
        const [, message] = await lastAlert(new TypeError('Network request failed'));
        expect(message).toBe(COMMUNICATION_MESSAGE);
    });

    it("shows the communication dialog for Expo winter fetch failures wrapped by the API client", async () => {
        // Shape produced by openapi-client-codegen wrapping expo's FetchError
        const cause = new Error('fetch failed: UnexpectedException: A TLS error caused the secure connection to fail.');
        const err = Object.assign(new Error(`Error: ${cause.message}`), { cause });
        const [, message] = await lastAlert(err);
        expect(message).toBe(COMMUNICATION_MESSAGE);
    });

    it('shows the communication dialog when the network failure is only in the cause chain', async () => {
        const err = Object.assign(new Error('request wrapper failed'), {
            cause: new Error('fetch failed: The Internet connection appears to be offline.')
        });
        const [, message] = await lastAlert(err);
        expect(message).toBe(COMMUNICATION_MESSAGE);
    });

    it('shows the generic dialog and reports to Sentry for non-network errors', async () => {
        const Sentry = require('@sentry/react-native');
        const err = new Error('something else broke');
        const [title, message] = await lastAlert(err);
        expect(title).toBe('Error');
        expect(message).toContain('An application error was encountered');
        expect(message).toContain('something else broke');
        expect(Sentry.captureException).toHaveBeenCalledWith(err);
    });

    it('does not report network errors to Sentry', async () => {
        const Sentry = require('@sentry/react-native');
        await lastAlert(new TypeError('Network request failed'));
        expect(Sentry.captureException).not.toHaveBeenCalled();
    });
});
