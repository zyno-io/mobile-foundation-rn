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
