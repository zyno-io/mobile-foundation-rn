import { autorun } from 'mobx';

import { createMockConfig } from '../test-utils';

describe('AppStorage', () => {
    let createAppStorage: typeof import('../../src/services/AppStorage').createAppStorage;
    let AsyncStorage: typeof import('../__mocks__/async-storage').default;

    interface TestStorage {
        token?: string;
        count?: number;
    }

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        jest.useFakeTimers();

        // Re-acquire mock after resetModules
        AsyncStorage = require('@react-native-async-storage/async-storage').default;

        const configModule = require('../../src/config');
        configModule.configureFoundation(createMockConfig());
        createAppStorage = require('../../src/services/AppStorage').createAppStorage;
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('createAppStorage', () => {
        it('creates storage with default values', () => {
            const storage = createAppStorage<TestStorage>({ token: 'initial' });
            expect(storage.token).toBe('initial');
        });

        it('returns undefined for unset properties', () => {
            const storage = createAppStorage<TestStorage>({});
            expect(storage.token).toBeUndefined();
        });

        it('sets and gets properties', () => {
            const storage = createAppStorage<TestStorage>({});
            storage.token = 'abc';
            expect(storage.token).toBe('abc');
        });
    });

    describe('$load', () => {
        it('populates from AsyncStorage', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
                JSON.stringify({ token: 'loaded', count: 42 }),
            );

            const storage = createAppStorage<TestStorage>({});
            jest.useRealTimers();
            await storage.$load();

            expect(storage.token).toBe('loaded');
            expect(storage.count).toBe(42);
        });

        it('uses APP_ENV-prefixed key', async () => {
            const storage = createAppStorage<TestStorage>({});
            jest.useRealTimers();
            await storage.$load();

            expect(AsyncStorage.getItem).toHaveBeenCalledWith('test:session');
        });

        it('handles missing data gracefully', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

            const storage = createAppStorage<TestStorage>({ token: 'default' });
            jest.useRealTimers();
            await storage.$load();

            expect(storage.token).toBe('default');
        });
    });

    describe('$persist', () => {
        it('saves to AsyncStorage (debounced)', () => {
            const storage = createAppStorage<TestStorage>({ token: 'test' });
            storage.$persist();

            jest.advanceTimersByTime(300);

            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                'test:session',
                expect.stringContaining('"token":"test"'),
            );
        });
    });

    describe('auto-persist on set', () => {
        it('persists automatically when a property is set', () => {
            const storage = createAppStorage<TestStorage>({});
            storage.token = 'auto-saved';

            jest.advanceTimersByTime(300);

            expect(AsyncStorage.setItem).toHaveBeenCalled();
            const savedData = JSON.parse(
                (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)[1],
            );
            expect(savedData.token).toBe('auto-saved');
        });
    });

    describe('$clear', () => {
        it('resets all properties to undefined', () => {
            const storage = createAppStorage<TestStorage>({ token: 'hello', count: 5 });
            storage.$clear();

            expect(storage.token).toBeUndefined();
            expect(storage.count).toBeUndefined();
        });

        it('persists the cleared state', () => {
            const storage = createAppStorage<TestStorage>({ token: 'hello' });
            storage.$clear();

            jest.advanceTimersByTime(300);

            expect(AsyncStorage.setItem).toHaveBeenCalled();
        });
    });

    describe('MobX reactivity', () => {
        it('triggers autorun on property change', () => {
            const storage = createAppStorage<TestStorage>({ token: '' });
            const values: (string | undefined)[] = [];

            const dispose = autorun(() => {
                values.push(storage.token);
            });

            storage.token = 'changed';

            expect(values).toEqual(['', 'changed']);
            dispose();
        });
    });
});
