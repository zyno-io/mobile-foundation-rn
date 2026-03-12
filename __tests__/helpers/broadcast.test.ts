import { Broadcast } from '../../src/helpers/broadcast';

describe('Broadcast', () => {
    afterEach(() => {
        Broadcast.removeAllListeners();
    });

    it('delivers events to listeners', () => {
        const listener = jest.fn();
        Broadcast.addListener('test-event', listener);

        Broadcast.emit('test-event', { data: 42 });

        expect(listener).toHaveBeenCalledWith({ data: 42 });
    });

    it('delivers to multiple listeners', () => {
        const listener1 = jest.fn();
        const listener2 = jest.fn();
        Broadcast.addListener('multi', listener1);
        Broadcast.addListener('multi', listener2);

        Broadcast.emit('multi', 'payload');

        expect(listener1).toHaveBeenCalledWith('payload');
        expect(listener2).toHaveBeenCalledWith('payload');
    });

    it('removes listener with removeListener', () => {
        const listener = jest.fn();
        Broadcast.addListener('remove-test', listener);
        Broadcast.removeListener('remove-test', listener);

        Broadcast.emit('remove-test', 'data');

        expect(listener).not.toHaveBeenCalled();
    });

    it('does not fire listeners for unrelated events', () => {
        const listener = jest.fn();
        Broadcast.addListener('event-a', listener);

        Broadcast.emit('event-b', 'data');

        expect(listener).not.toHaveBeenCalled();
    });
});
