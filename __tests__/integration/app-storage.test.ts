import { autorun } from 'mobx';

import { createMockConfig } from '../test-utils';

describe('AppStorage round-trip integration', () => {
    let createAppStorage: typeof import('../../src/services/AppStorage').createAppStorage;
    let AsyncStorage: any;

    interface TestStorage {
        token?: string;
        settings?: { theme: string };
    }

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        jest.useFakeTimers();

        AsyncStorage = require('@react-native-async-storage/async-storage').default;

        const configModule = require('../../src/config');
        configModule.configureFoundation(createMockConfig());
        createAppStorage = require('../../src/services/AppStorage').createAppStorage;
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('set → persist → reload preserves values', async () => {
        // Create first instance, set values
        const storage1 = createAppStorage<TestStorage>({});
        storage1.token = 'my-token';
        storage1.settings = { theme: 'dark' };

        // Flush debounce
        jest.advanceTimersByTime(300);

        // Verify it was saved
        expect(AsyncStorage.setItem).toHaveBeenCalled();
        const savedJson = (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)[1];
        const savedData = JSON.parse(savedJson);
        expect(savedData.token).toBe('my-token');
        expect(savedData.settings).toEqual({ theme: 'dark' });

        // Create second instance and load from storage
        jest.resetModules();
        const configModule2 = require('../../src/config');
        configModule2.configureFoundation(createMockConfig());
        const createAppStorage2 = require('../../src/services/AppStorage').createAppStorage;

        // Mock AsyncStorage.getItem to return what was saved
        AsyncStorage = require('@react-native-async-storage/async-storage').default;
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(savedJson);

        const storage2 = createAppStorage2<TestStorage>({});
        jest.useRealTimers();
        await storage2.$load();

        expect(storage2.token).toBe('my-token');
        expect(storage2.settings).toEqual({ theme: 'dark' });
    });

    it('MobX observer reacts to storage property changes', () => {
        const storage = createAppStorage<TestStorage>({});
        const observed: (string | undefined)[] = [];

        const dispose = autorun(() => {
            observed.push(storage.token);
        });

        storage.token = 'first';
        storage.token = 'second';

        expect(observed).toEqual([undefined, 'first', 'second']);
        dispose();
    });

    it('$clear resets and MobX observer reflects cleared state', () => {
        const storage = createAppStorage<TestStorage>({ token: 'initial' });
        const observed: (string | undefined)[] = [];

        const dispose = autorun(() => {
            observed.push(storage.token);
        });

        storage.$clear();

        expect(observed).toEqual(['initial', undefined]);
        dispose();
    });
});
