import React, { useMemo, useState } from 'react';
import { FlatList, FlatListProps, Insets, StyleSheet } from 'react-native';

import { hasHeightOrFlexProps } from '../helpers/layout';

import { MFWrapperView } from './MFWrapperView';
import { Inset } from '../hooks/useMfSafeAreaInsets';

interface MFFlatListProps<T> extends FlatListProps<T> {
    safeArea?: boolean | Inset[] | Inset;
    noKeyboardAvoiding?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MFFlatList = React.forwardRef<FlatList, MFFlatListProps<any>>((props, forwardedRef) => {
    const { safeArea, noKeyboardAvoiding, ...flatListProps } = props;
    const [insetsPadding, setInsetsPadding] = useState<Insets | null>(null);

    const style = useMemo(() => {
        const style = StyleSheet.flatten(props.style ?? {});
        return {
            ...(!hasHeightOrFlexProps(style) && { flex: 1 }),
            ...style
        };
    }, [props.style]);

    const contentContainerStyle = useMemo(() => {
        const style = StyleSheet.flatten(props.contentContainerStyle ?? {});
        return {
            ...(!hasHeightOrFlexProps(style) && { flexGrow: 1 }),
            ...style,
            ...(insetsPadding && {
                paddingTop: insetsPadding.top,
                paddingBottom: insetsPadding.bottom
            })
        };
    }, [props.contentContainerStyle, insetsPadding]);

    return (
        <MFWrapperView
            safeArea={safeArea}
            noKeyboardAvoiding={noKeyboardAvoiding}
            contentContainerStyle={flatListProps.contentContainerStyle ?? {}}
            onInsetsPaddingUpdated={setInsetsPadding}
        >
            <FlatList ref={forwardedRef} {...props} style={style} contentContainerStyle={[contentContainerStyle]} />
        </MFWrapperView>
    );
});
