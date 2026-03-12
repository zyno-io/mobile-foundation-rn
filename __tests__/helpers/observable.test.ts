import { autorun } from 'mobx';

import { LoaderState, createObservableProxy } from '../../src/helpers/observable';

describe('LoaderState', () => {
    it('has initial loaderCount of 0', () => {
        expect(LoaderState.loaderCount).toBe(0);
    });

    it('increments and decrements', () => {
        LoaderState.loaderCount++;
        expect(LoaderState.loaderCount).toBe(1);
        LoaderState.loaderCount--;
        expect(LoaderState.loaderCount).toBe(0);
    });

    it('triggers MobX autorun on change', () => {
        const values: number[] = [];
        const dispose = autorun(() => {
            values.push(LoaderState.loaderCount);
        });

        LoaderState.loaderCount = 5;
        LoaderState.loaderCount = 0;

        expect(values).toEqual([0, 5, 0]);
        dispose();
    });
});

describe('createObservableProxy', () => {
    it('stores and retrieves properties', () => {
        const proxy = createObservableProxy({ name: 'test' });
        expect(proxy.name).toBe('test');
    });

    it('sets properties', () => {
        const proxy = createObservableProxy({ name: '' });
        proxy.name = 'updated';
        expect(proxy.name).toBe('updated');
    });

    it('triggers MobX reactivity on property change', () => {
        const proxy = createObservableProxy({ count: 0 });
        const values: number[] = [];
        const dispose = autorun(() => {
            values.push(proxy.count);
        });

        proxy.count = 1;
        proxy.count = 2;

        expect(values).toEqual([0, 1, 2]);
        dispose();
    });

    it('calls afterSet hook when property is set', () => {
        const afterSet = jest.fn();
        const proxy = createObservableProxy(
            { value: '' },
            { value: { afterSet } },
        );

        proxy.value = 'new';
        expect(afterSet).toHaveBeenCalledTimes(1);
    });

    it('uses get hook to override getter', () => {
        const proxy = createObservableProxy(
            { raw: 'hello' },
            { raw: { get: (target) => target.raw.toUpperCase() } },
        );

        expect(proxy.raw).toBe('HELLO');
    });

    it('auto-creates new properties as observable on first access', () => {
        const proxy = createObservableProxy<Record<string, any>>({});
        const values: any[] = [];
        const dispose = autorun(() => {
            values.push(proxy.newProp);
        });

        proxy.newProp = 'created';

        expect(values).toEqual([undefined, 'created']);
        dispose();
    });
});
