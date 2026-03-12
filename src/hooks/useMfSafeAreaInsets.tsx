import { useMemo } from 'react';
import { Insets } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type Inset = keyof Insets;

export const useMFSafeAreaInsets = (applyInsets: boolean | Inset[] | Inset = true): Required<Insets> => {
    const rawInsets = useSafeAreaInsets();

    const desiredInsets: Inset[] = useMemo(() => {
        if (applyInsets === true) return ['top', 'bottom', 'left', 'right'];
        if (applyInsets === false) return [];
        if (Array.isArray(applyInsets)) return applyInsets;
        return [applyInsets];
    }, [applyInsets]);

    const insets = useMemo(
        () => ({
            top: desiredInsets.includes('top') ? rawInsets.top : 0,
            bottom: desiredInsets.includes('bottom') ? rawInsets.bottom : 0,
            left: desiredInsets.includes('left') ? rawInsets.left : 0,
            right: desiredInsets.includes('right') ? rawInsets.right : 0
        }),
        [desiredInsets, rawInsets]
    );

    return insets;
};
