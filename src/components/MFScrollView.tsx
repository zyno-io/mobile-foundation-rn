import React, { useMemo, useRef, useState } from 'react';
import { Insets, LayoutChangeEvent, ScrollView, ScrollViewProps, StyleSheet } from 'react-native';

import { hasHeightOrFlexProps } from '../helpers/layout';

import { MFWrapperView, MFWrapperViewCommonProps } from './MFWrapperView';
import { useMFActiveTextInputContext } from '../hooks/useMfActiveInput';

export interface MFScrollViewProps extends ScrollViewProps, MFWrapperViewCommonProps {
    allowOverscroll?: boolean;
}

export const MFScrollView = React.forwardRef<ScrollView, MFScrollViewProps>((props, forwardedRef) => {
    const activeTextInputCtx = useMFActiveTextInputContext();

    const scrollViewRef = useRef<ScrollView>(null);
    const [scrollY, setScrollY] = useState(0);

    const onLayout = (e: LayoutChangeEvent) => {
        if (!scrollViewRef.current || !activeTextInputCtx.input) return;
        activeTextInputCtx.input.measureLayout(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            scrollViewRef.current as any,
            (_x, y, _width, height) => {
                const { height: scrollViewHeight } = e.nativeEvent.layout;
                const occlusionPx = y + height - scrollViewHeight;
                scrollViewRef.current?.scrollTo({
                    y: scrollY + occlusionPx + 10,
                    animated: true
                });
            }
        );
    };

    const { safeArea, noKeyboardAvoiding, ...scrollViewProps } = props;
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
            contentContainerStyle={scrollViewProps.contentContainerStyle ?? {}}
            onInsetsPaddingUpdated={setInsetsPadding}
        >
            <ScrollView
                ref={node => {
                    scrollViewRef.current = node;
                    if (typeof forwardedRef === 'function') {
                        forwardedRef(node);
                    } else if (forwardedRef) {
                        forwardedRef.current = node;
                    }
                }}
                onLayout={onLayout}
                keyboardShouldPersistTaps="handled"
                {...(!props.allowOverscroll && {
                    overScrollMode: 'never',
                    alwaysBounceVertical: false
                })}
                {...scrollViewProps}
                onScroll={e => {
                    setScrollY(e.nativeEvent.contentOffset.y);
                    props.onScroll?.(e);
                }}
                style={style}
                contentContainerStyle={contentContainerStyle}
            />
        </MFWrapperView>
    );
});
