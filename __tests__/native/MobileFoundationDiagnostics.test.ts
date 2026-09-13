describe('MobileFoundationDiagnostics', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('returns native Expo Updates database diagnostics when linked', async () => {
        const Expo = require('expo');
        const nativeResult = { ok: true, schemaVersion: 11, updates: [] };
        const nativeModule = {
            getExpoUpdatesDatabaseDiagnosticsAsync: jest.fn(() => Promise.resolve(nativeResult))
        };
        Expo.requireOptionalNativeModule.mockReturnValue(nativeModule);
        const { getExpoUpdatesDatabaseDiagnostics } = require('../../src/native/MobileFoundationDiagnostics');

        const result = await getExpoUpdatesDatabaseDiagnostics();

        expect(Expo.requireOptionalNativeModule).toHaveBeenCalledWith('MobileFoundationDiagnostics');
        expect(nativeModule.getExpoUpdatesDatabaseDiagnosticsAsync).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ nativeModuleAvailable: true, platform: 'ios', ...nativeResult });
    });

    it('identifies binaries built before the native diagnostic was added', async () => {
        const { getExpoUpdatesDatabaseDiagnostics } = require('../../src/native/MobileFoundationDiagnostics');

        const result = await getExpoUpdatesDatabaseDiagnostics();

        expect(result).toEqual({ nativeModuleAvailable: false, platform: 'ios' });
    });
});
