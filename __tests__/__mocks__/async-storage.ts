const mockStore: Record<string, string> = {};

const AsyncStorage = {
    getItem: jest.fn((key: string) => Promise.resolve(mockStore[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
        mockStore[key] = value;
        return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
        delete mockStore[key];
        return Promise.resolve();
    }),
    clear: jest.fn(() => {
        for (const key of Object.keys(mockStore)) delete mockStore[key];
        return Promise.resolve();
    }),
};

export default AsyncStorage;
