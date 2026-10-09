import { createMockConfig } from '../test-utils';

describe('AppMeta', () => {
    let AppMeta: typeof import('../../src/services/AppMeta').AppMeta;
    let DeviceInfo: typeof import('../__mocks__/react-native-device-info').default;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        // Re-acquire mock after resetModules
        DeviceInfo = require('react-native-device-info').default;

        const configModule = require('../../src/config');
        configModule.configureFoundation(createMockConfig());
        AppMeta = require('../../src/services/AppMeta').AppMeta;
    });

    it('has isDevelopment based on NODE_ENV', () => {
        expect(AppMeta.isDevelopment).toBe(false);
    });

    it('returns bundleId from DeviceInfo', () => {
        expect(AppMeta.bundleId).toBe('com.test.app');
    });

    it('returns baseAppVersion from DeviceInfo.getVersion', () => {
        expect(AppMeta.baseAppVersion).toBe('1.2.3');
    });

    it('returns appEnv from config', () => {
        expect(AppMeta.appEnv).toBe('test');
    });

    it('returns appVersion from config BUILD_VERSION', () => {
        expect(AppMeta.appVersion).toBe('1.0.0-test');
    });

    it('returns isSimulator from DeviceInfo', () => {
        expect(AppMeta.isSimulator).toBe(true);
    });

    describe('load()', () => {
        it('recovers a denied early metadata read without mounting the setup hook', async () => {
            const error = new Error('User interaction is not allowed.');
            let unlock!: (available: boolean) => void;
            const recover = jest.fn(() => new Promise<boolean>(resolve => { unlock = resolve; }));
            require('../../src/config').getFoundationConfig().recoverProtectedData = recover;
            DeviceInfo.syncUniqueId.mockRejectedValueOnce(error);

            const loading = AppMeta.load();
            await Promise.resolve();
            await Promise.resolve();
            expect(recover).toHaveBeenCalledWith(error);
            expect(DeviceInfo.getUniqueId).not.toHaveBeenCalled();

            unlock(true);
            await loading;
            expect(DeviceInfo.syncUniqueId).toHaveBeenCalledTimes(2);
            expect(AppMeta.deviceId).toBe('unique-id-123');
        });

        it('bounds recovery and permits a fresh load after a persistent metadata failure', async () => {
            const error = new Error('User interaction is not allowed.');
            const recover = jest.fn().mockResolvedValue(true);
            require('../../src/config').getFoundationConfig().recoverProtectedData = recover;
            DeviceInfo.getUniqueId.mockRejectedValueOnce(error).mockRejectedValueOnce(error);

            await expect(AppMeta.load()).rejects.toBe(error);
            expect(recover).toHaveBeenCalledTimes(1);
            expect(AppMeta.deviceId).toBe('');

            await AppMeta.load();
            expect(AppMeta.deviceId).toBe('unique-id-123');
            expect(recover).toHaveBeenCalledTimes(1);
        });

        it('calls syncUniqueId and getUniqueId', async () => {
            await AppMeta.load();

            expect(DeviceInfo.syncUniqueId).toHaveBeenCalled();
            expect(DeviceInfo.getUniqueId).toHaveBeenCalled();
        });

        it('sets deviceId and deviceIdEnv after load', async () => {
            await AppMeta.load();

            expect(AppMeta.deviceId).toBe('unique-id-123');
            expect(AppMeta.deviceIdEnv).toBe('unique-id-123-test');
        });

        it('sets appVersionExtended with update info', async () => {
            await AppMeta.load();

            expect(AppMeta.appVersionExtended).toContain('1.0.0-test');
            expect(AppMeta.appVersionExtended).toContain('1.2.3');
            expect(AppMeta.appVersionExtended).toContain('update');
        });
    });
});
