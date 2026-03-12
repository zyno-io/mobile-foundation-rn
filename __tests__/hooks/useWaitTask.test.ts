describe('useWaitTask', () => {
    let useWaitTask: typeof import('../../src/hooks/useWaitTask').useWaitTask;
    let LoaderState: typeof import('../../src/helpers/observable').LoaderState;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        const configModule = require('../../src/config');
        const { createMockConfig } = require('../test-utils');
        configModule.configureFoundation(createMockConfig());

        useWaitTask = require('../../src/hooks/useWaitTask').useWaitTask;
        LoaderState = require('../../src/helpers/observable').LoaderState;
        LoaderState.loaderCount = 0;
    });

    it('increments loaderCount during execution', async () => {
        let duringCount = -1;
        const fn = jest.fn(async () => {
            duringCount = LoaderState.loaderCount;
            return 'result';
        });

        const wrapped = useWaitTask(fn);
        const result = await wrapped();

        expect(duringCount).toBe(1);
        expect(result).toBe('result');
        expect(LoaderState.loaderCount).toBe(0);
    });

    it('decrements loaderCount after successful execution', async () => {
        const wrapped = useWaitTask(async () => 42);
        await wrapped();
        expect(LoaderState.loaderCount).toBe(0);
    });

    it('decrements loaderCount on error and does not rethrow', async () => {
        const wrapped = useWaitTask(async () => {
            throw new Error('task failed');
        });

        const result = await wrapped();
        expect(result).toBeUndefined();
        expect(LoaderState.loaderCount).toBe(0);
    });

    it('passes through arguments to the wrapped function', async () => {
        const fn = jest.fn(async (a: number, b: string) => `${a}-${b}`);
        const wrapped = useWaitTask(fn);

        const result = await wrapped(42, 'hello');
        expect(result).toBe('42-hello');
        expect(fn).toHaveBeenCalledWith(42, 'hello');
    });

    it('handles multiple concurrent tasks correctly', async () => {
        let maxCount = 0;
        const fn = async () => {
            maxCount = Math.max(maxCount, LoaderState.loaderCount);
            await new Promise(r => setTimeout(r, 10));
        };

        const wrapped = useWaitTask(fn);
        await Promise.all([wrapped(), wrapped(), wrapped()]);

        expect(maxCount).toBe(3);
        expect(LoaderState.loaderCount).toBe(0);
    });

    it('accepts optional logger parameter', async () => {
        const logger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            interactiveError: jest.fn(),
        };

        const wrapped = useWaitTask(logger, async () => {
            throw new Error('logged error');
        });

        await wrapped();
        expect(logger.interactiveError).toHaveBeenCalled();
    });
});
