import React, { useEffect } from 'react';

export const useMountEffect = (callback: () => void | Promise<void>, deps?: React.DependencyList) => {
    useEffect(() => {
        callback();
    }, deps ?? []);
};
