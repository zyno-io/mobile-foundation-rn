import EventEmitter from 'events';
import { useEffect } from 'react';

export const Broadcast = new EventEmitter();

export const useBroadcastEffect = <T>(event: string, fn: (e: T) => void) => {
    useEffect(() => {
        Broadcast.addListener(event, fn);
        return () => {
            Broadcast.removeListener(event, fn);
        };
    }, [event, fn]);
};
