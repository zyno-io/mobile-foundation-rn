import { getFoundationConfig } from '../config';

/** Retry only after the host confirms that protected data became available. */
export async function withProtectedDataRecovery<T>(operation: () => Promise<T>): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        if (!(await getFoundationConfig().recoverProtectedData?.(error))) throw error;
        // A persistent failure must propagate rather than spin after unlock.
        return operation();
    }
}
