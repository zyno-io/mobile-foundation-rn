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
        it('propagates denied reads and retries rather than caching default state', async () => {
            const error = new Error('Failed to read storage file.');
            (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(error)
                .mockResolvedValueOnce(JSON.stringify({ token: 'saved' }));
            const storage = createAppStorage<TestStorage>({ token: 'default' });
            await expect(storage.$load()).rejects.toBe(error);
            storage.$persist();
            jest.advanceTimersByTime(300);
            expect(AsyncStorage.setItem).not.toHaveBeenCalled();
            await storage.$load();
            expect(storage.token).toBe('saved');
            expect(AsyncStorage.getItem).toHaveBeenCalledTimes(2);
        });

        it('waits for host recovery before hydrating and preserves pending explicit changes', async () => {
            let unlock!: (value: boolean) => void;
            const recover = jest.fn(() => new Promise<boolean>(resolve => { unlock = resolve; }));
            require('../../src/config').configureFoundation(createMockConfig({ recoverProtectedData: recover }));
            (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('permission denied'))
                .mockResolvedValueOnce(JSON.stringify({ token: 'saved', count: 7 }));
            const storage = createAppStorage<TestStorage>({});
            const loading = storage.$load();
            await Promise.resolve();
            await Promise.resolve();
            storage.count = 8;
            jest.advanceTimersByTime(300);
            expect(AsyncStorage.setItem).not.toHaveBeenCalled();
            unlock(true);
            await loading;
            expect(storage.token).toBe('saved');
            expect(storage.count).toBe(8);
            jest.advanceTimersByTime(300);
            await Promise.resolve();
            expect(JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1])).toEqual({ token: 'saved', count: 8 });
        });

        it('does not write a session merely because it hydrated', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify({ token: 'saved' }));
            const storage = createAppStorage<TestStorage>({});
            await storage.$load();
            jest.advanceTimersByTime(300);
            await Promise.resolve();
            expect(AsyncStorage.setItem).not.toHaveBeenCalled();
        });

        it('preserves nested edits made while hydration was pending', async () => {
            let read!: (value: string) => void;
            (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { read = resolve; }));
            const storage = createAppStorage<{ settings: { muted: boolean }; token?: string }>({ settings: { muted: false } });
            const loading = storage.$load();
            storage.settings.muted = true;
            storage.$persist();
            jest.advanceTimersByTime(300);
            expect(AsyncStorage.setItem).not.toHaveBeenCalled();
            read(JSON.stringify({ settings: { muted: false }, token: 'saved' }));
            await loading;
            expect(storage.settings.muted).toBe(true);
            expect(storage.token).toBe('saved');
            jest.advanceTimersByTime(300);
            await Promise.resolve();
            expect(JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1])).toEqual({ settings: { muted: true }, token: 'saved' });
        });

        it('hydrates unchanged nested defaults from saved state', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify({ settings: { muted: true } }));
            const storage = createAppStorage<{ settings: { muted: boolean } }>({ settings: { muted: false } });
            await storage.$load();
            expect(storage.settings.muted).toBe(true);
            jest.advanceTimersByTime(300);
            expect(AsyncStorage.setItem).not.toHaveBeenCalled();
        });

        it('does not treat invalid JSON as an empty session', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('{bad');
            const storage = createAppStorage<TestStorage>({});
            await expect(storage.$load()).rejects.toBeInstanceOf(SyntaxError);
            storage.$persist();
            jest.advanceTimersByTime(300);
            expect(AsyncStorage.setItem).not.toHaveBeenCalled();
        });

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
        it('saves to AsyncStorage (debounced)', async () => {
            const storage = createAppStorage<TestStorage>({ token: 'test' });
            await storage.$load();
            storage.$persist();

            jest.advanceTimersByTime(300);
            await Promise.resolve();

            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                'test:session',
                expect.stringContaining('"token":"test"'),
            );
        });
    });

    describe('auto-persist on set', () => {
        it('persists automatically when a property is set', async () => {
            const storage = createAppStorage<TestStorage>({});
            await storage.$load();
            storage.token = 'auto-saved';

            jest.advanceTimersByTime(300);
            await Promise.resolve();

            expect(AsyncStorage.setItem).toHaveBeenCalled();
            const savedData = JSON.parse(
                (AsyncStorage.setItem as jest.Mock).mock.calls.at(-1)[1],
            );
            expect(savedData.token).toBe('auto-saved');
        });
    });

    describe('$clear', () => {
        it('honors an explicit clear while loading corrupt data, but never writes after a denied read', async () => {
            const error = new Error('Failed to read storage file.');
            (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(error).mockResolvedValueOnce('{bad');
            const storage = createAppStorage<TestStorage>({ token: 'default' });
            storage.$clear();
            await expect(storage.$load()).rejects.toBe(error);
            jest.advanceTimersByTime(300);
            expect(AsyncStorage.setItem).not.toHaveBeenCalled();
            await storage.$load();
            expect(storage.token).toBeUndefined();
            jest.advanceTimersByTime(300);
            await Promise.resolve();
            expect(AsyncStorage.setItem).toHaveBeenCalledWith('test:session', '{}');
        });

        it('does not restore saved keys after clearing during a pending read', async () => {
            let read!: (value: string) => void;
            (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { read = resolve; }));
            const storage = createAppStorage<TestStorage>({ token: 'default' });
            const loading = storage.$load();
            storage.$clear();
            read(JSON.stringify({ token: 'saved', count: 7 }));
            await loading;
            expect(storage.token).toBeUndefined();
            expect(storage.count).toBeUndefined();
            jest.advanceTimersByTime(300);
            await Promise.resolve();
            expect(AsyncStorage.setItem).toHaveBeenCalledWith('test:session', '{}');
        });

        it('resets all properties to undefined', () => {
            const storage = createAppStorage<TestStorage>({ token: 'hello', count: 5 });
            storage.$clear();

            expect(storage.token).toBeUndefined();
            expect(storage.count).toBeUndefined();
        });

        it('persists the cleared state', async () => {
            const storage = createAppStorage<TestStorage>({ token: 'hello' });
            await storage.$load();
            storage.$clear();

            jest.advanceTimersByTime(300);
            await Promise.resolve();

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
