export const updateId = 'update-abc-123';
export const createdAt = new Date();
export const isEmbeddedLaunch = false;
export const isEmergencyLaunch = false;
export const emergencyLaunchReason = null;
export const launchDuration = 100;
export const runtimeVersion = '1.0.0';
export const checkForUpdateAsync = jest.fn(() => Promise.resolve({ isAvailable: false }));
export const fetchUpdateAsync = jest.fn(() => Promise.resolve({ isNew: false }));
export const reloadAsync = jest.fn(() => Promise.resolve());
export const setExtraParamAsync = jest.fn(() => Promise.resolve());
export const useUpdates = jest.fn(() => ({
    isChecking: false,
    isDownloading: false,
    isUpdatePending: false,
    isUpdateAvailable: false,
}));
