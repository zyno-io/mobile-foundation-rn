import { createMockConfig } from '../test-utils';

describe('Sentry metadata initialization', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        require('../../src/config').configureFoundation(createMockConfig());
    });

    it('handles a failed metadata read without setting an empty user ID', async () => {
        const error = new Error('User interaction is not allowed.');
        const { AppMeta } = require('../../src/services/AppMeta');
        jest.spyOn(AppMeta, 'load').mockRejectedValue(error);
        const Sentry = require('@sentry/react-native');

        require('../../src/services/Sentry').SentryHelper.init();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(Sentry.captureException).toHaveBeenCalledWith(error);
        expect(Sentry.setUser).not.toHaveBeenCalled();
    });

    it('sets identity after an early denied read recovers', async () => {
        const error = new Error('User interaction is not allowed.');
        const recover = jest.fn().mockResolvedValue(true);
        require('../../src/config').getFoundationConfig().recoverProtectedData = recover;
        require('react-native-device-info').default.syncUniqueId.mockRejectedValueOnce(error);
        const Sentry = require('@sentry/react-native');

        require('../../src/services/Sentry').SentryHelper.init();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(recover).toHaveBeenCalledWith(error);
        expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'unique-id-123-test' });
        expect(Sentry.captureException).not.toHaveBeenCalled();
    });
});
