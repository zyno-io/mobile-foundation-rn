const DeviceInfo = {
    getBundleId: jest.fn(() => 'com.test.app'),
    getVersion: jest.fn(() => '1.2.3'),
    getDeviceId: jest.fn(() => 'iPhone15,2'),
    isEmulatorSync: jest.fn(() => true),
    syncUniqueId: jest.fn(() => Promise.resolve('unique-id-123')),
    getUniqueId: jest.fn(() => Promise.resolve('unique-id-123')),
    getManufacturer: jest.fn(() => Promise.resolve('Apple')),
    getModel: jest.fn(() => 'iPhone 15 Pro'),
    getSystemName: jest.fn(() => 'iOS'),
    getSystemVersion: jest.fn(() => '17.0'),
    getFreeDiskStorage: jest.fn(() => Promise.resolve(50000000000)),
    getTotalDiskCapacity: jest.fn(() => Promise.resolve(256000000000)),
    getBuildId: jest.fn(() => Promise.resolve('ABC123')),
    getFontScale: jest.fn(() => Promise.resolve(1)),
};

export default DeviceInfo;
