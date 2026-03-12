/**
 * Memoizes an async function, but clears the cache if the promise rejects.
 * This prevents a failed promise from being cached forever.
 *
 * Unlike lodash's memoize, this only works for functions with no arguments
 * (which covers all our current use cases for async memoization).
 */
export function memoizeAsync<T>(fn: () => Promise<T>): () => Promise<T> {
    let cached: Promise<T> | null = null;

    return () => {
        if (cached) return cached;

        cached = fn().catch(err => {
            cached = null;
            throw err;
        });

        return cached;
    };
}
