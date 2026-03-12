import { LoaderState } from '../helpers/observable';
import { createLogger, Logger } from '../services/Logger';

const defaultLog = createLogger('DefaultWaitTaskLogger');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useWaitTask<T extends any[], R>(logger: Logger, fn: (...args: T) => Promise<R>): (...args: T) => Promise<R | undefined>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useWaitTask<T extends any[], R>(fn: (...args: T) => Promise<R>): (...args: T) => Promise<R | undefined>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useWaitTask<T extends any[], R>(
    fnOrLogger: Logger | ((...args: T) => Promise<R>),
    fn?: (...args: T) => Promise<R>
): () => Promise<R | undefined> {
    const logger = fn ? (fnOrLogger as Logger) : null;
    fn = fn || (fnOrLogger as (...args: T) => Promise<R>);
    return async (...args: T) => {
        try {
            LoaderState.loaderCount++;
            return await fn(...args);
        } catch (err) {
            if (logger) logger.interactiveError(err);
            else defaultLog.interactiveError(err);
        } finally {
            LoaderState.loaderCount--;
        }
    };
}
