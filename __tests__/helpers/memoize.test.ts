import { memoizeAsync } from '../../src/helpers/memoize';

describe('memoizeAsync', () => {
    it('executes the function on first call', async () => {
        const fn = jest.fn(() => Promise.resolve(42));
        const memoized = memoizeAsync(fn);

        const result = await memoized();

        expect(result).toBe(42);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('returns cached result on subsequent calls', async () => {
        const fn = jest.fn(() => Promise.resolve('hello'));
        const memoized = memoizeAsync(fn);

        await memoized();
        const result = await memoized();

        expect(result).toBe('hello');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('clears cache on rejection and re-executes on next call', async () => {
        let callCount = 0;
        const fn = jest.fn(() => {
            callCount++;
            if (callCount === 1) return Promise.reject(new Error('fail'));
            return Promise.resolve('recovered');
        });
        const memoized = memoizeAsync(fn);

        await expect(memoized()).rejects.toThrow('fail');

        const result = await memoized();
        expect(result).toBe('recovered');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('returns the same promise for concurrent calls while pending', async () => {
        let resolveIt: (v: string) => void;
        const fn = jest.fn(() => new Promise<string>(r => { resolveIt = r; }));
        const memoized = memoizeAsync(fn);

        const p1 = memoized();
        const p2 = memoized();

        expect(p1).toBe(p2);
        expect(fn).toHaveBeenCalledTimes(1);

        resolveIt!('done');
        expect(await p1).toBe('done');
        expect(await p2).toBe('done');
    });
});
