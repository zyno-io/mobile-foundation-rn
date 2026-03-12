import { createMockConfig } from '../test-utils';

describe('Logger error classification', () => {
    let createLogger: typeof import('../../src/services/Logger').createLogger;
    let UserError: typeof import('../../src/services/Logger').UserError;
    let showAlertDialog: typeof import('../../src/services/Logger').showAlertDialog;
    let showCommunicationError: typeof import('../../src/services/Logger').showCommunicationError;
    let Alert: typeof import('react-native').Alert;
    let Sentry: typeof import('@sentry/react-native');

    class CustomUserError extends Error {
        constructor(msg: string) {
            super(msg);
            this.name = 'CustomUserError';
        }
    }

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        const configModule = require('../../src/config');
        configModule.configureFoundation(
            createMockConfig({
                supportContact: 'help@test.com',
                userErrorClasses: [CustomUserError],
            }),
        );

        const loggerModule = require('../../src/services/Logger');
        createLogger = loggerModule.createLogger;
        UserError = loggerModule.UserError;
        showAlertDialog = loggerModule.showAlertDialog;
        showCommunicationError = loggerModule.showCommunicationError;

        Alert = require('react-native').Alert;
        Sentry = require('@sentry/react-native');

        // Auto-press the first button so showAlertDialog's Promise resolves
        (Alert.alert as jest.Mock).mockImplementation((_t: string, _m: string, buttons: any[]) => {
            buttons?.[0]?.onPress?.();
        });
    });

    it('interactiveError with UserError shows alert with user message', async () => {
        const logger = createLogger('test');
        await logger.interactiveError(new UserError('Please fix this'));

        expect(Alert.alert).toHaveBeenCalledWith(
            '',
            'Please fix this',
            expect.any(Array),
            undefined,
        );
        expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('interactiveError with custom error class shows alert', async () => {
        const logger = createLogger('test');
        await logger.interactiveError(new CustomUserError('Custom error message'));

        expect(Alert.alert).toHaveBeenCalledWith(
            '',
            'Custom error message',
            expect.any(Array),
            undefined,
        );
    });

    it('interactiveError with unknown Error sends to Sentry and shows generic alert', async () => {
        const logger = createLogger('test');
        await logger.interactiveError(new Error('Unexpected failure'));

        expect(Sentry.captureException).toHaveBeenCalled();
        expect(Alert.alert).toHaveBeenCalledWith(
            'Error',
            expect.stringContaining('help@test.com'),
            expect.any(Array),
            undefined,
        );
    });

    it('interactiveError with network error shows communication error', async () => {
        const logger = createLogger('test');
        await logger.interactiveError(new Error('Network request failed'));

        expect(Alert.alert).toHaveBeenCalledWith(
            'Error',
            expect.stringContaining('communicating with the server'),
            expect.any(Array),
            undefined,
        );
    });

    it('showAlertDialog calls Alert.alert', async () => {
        // Resolve the alert immediately
        (Alert.alert as jest.Mock).mockImplementation((_t, _m, buttons) => {
            buttons?.[0]?.onPress?.();
        });

        await showAlertDialog('Title', 'Message');

        expect(Alert.alert).toHaveBeenCalledWith(
            'Title',
            'Message',
            expect.any(Array),
            undefined,
        );
    });

    it('showCommunicationError shows network error dialog when app is active', async () => {
        (Alert.alert as jest.Mock).mockImplementation((_t, _m, buttons) => {
            buttons?.[0]?.onPress?.();
        });

        await showCommunicationError();

        expect(Alert.alert).toHaveBeenCalledWith(
            'Error',
            expect.stringContaining('Internet connection'),
            expect.any(Array),
            undefined,
        );
    });
});
