describe('LoaderOverlay + useWaitTask integration', () => {
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

    it('idle state has loaderCount 0', () => {
        expect(LoaderState.loaderCount).toBe(0);
    });

    it('single async task increments then decrements loaderCount', async () => {
        let resolve: () => void;
        const fn = async () => new Promise<void>(r => { resolve = r; });
        const wrapped = useWaitTask(fn);

        const promise = wrapped();
        expect(LoaderState.loaderCount).toBe(1);

        resolve!();
        await promise;
        expect(LoaderState.loaderCount).toBe(0);
    });

    it('two concurrent tasks keep overlay visible until both complete', async () => {
        let resolve1: () => void;
        let resolve2: () => void;

        const task1 = useWaitTask(async () => new Promise<void>(r => { resolve1 = r; }));
        const task2 = useWaitTask(async () => new Promise<void>(r => { resolve2 = r; }));

        const p1 = task1();
        const p2 = task2();
        expect(LoaderState.loaderCount).toBe(2);

        resolve1!();
        await p1;
        expect(LoaderState.loaderCount).toBe(1); // still visible

        resolve2!();
        await p2;
        expect(LoaderState.loaderCount).toBe(0); // now hidden
    });

    it('task that throws still decrements loaderCount', async () => {
        const wrapped = useWaitTask(async () => {
            throw new Error('boom');
        });

        await wrapped();
        expect(LoaderState.loaderCount).toBe(0);
    });
});
