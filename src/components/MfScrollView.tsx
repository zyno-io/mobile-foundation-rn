import React, { useMemo, useRef, useState } from 'react';
import { Insets, LayoutChangeEvent, ScrollView, ScrollViewProps, StyleSheet } from 'react-native';

import { computeScrollIntoViewOffset, hasHeightOrFlexProps } from '../helpers/layout';

import { MfWrapperView, MfWrapperViewCommonProps } from './MfWrapperView';
import { useMfActiveTextInputContext } from '../hooks/useMfActiveInput';

export interface MfScrollViewProps extends ScrollViewProps, MfWrapperViewCommonProps {
    allowOverscroll?: boolean;
}

/** Gap kept between the focused input and the edge of the visible area when auto-scrolling. */
const ACTIVE_INPUT_PADDING = 10;

export const MfScrollView = React.forwardRef<ScrollView, MfScrollViewProps>((props, forwardedRef) => {
    const activeTextInputCtx = useMfActiveTextInputContext();

    const scrollViewRef = useRef<ScrollView>(null);
    // kept in a ref rather than state: onScroll fires every frame and nothing needs to re-render on it
    const scrollOffsetRef = useRef(0);

    // when our visible area changes (typically because the keyboard opened and the wrapper padded us),
    // make sure the focused input is still fully visible
    const scrollActiveInputIntoView = (e: LayoutChangeEvent) => {
        const scrollView = scrollViewRef.current;
        const input = activeTextInputCtx.input;
        if (!scrollView || !input) return;

        const { height: viewportHeight } = e.nativeEvent.layout;
        // a zero-height layout (mounting behind a transition, a collapsed container) says nothing useful
        if (!(viewportHeight > 0)) return;

        input.measureLayout(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            scrollView as any,
            (_x, y, _width, height) => {
                // measureLayout reports the input relative to the scroll view's *content*, i.e. the current
                // scroll offset is not subtracted — so the offset must not be added back in here either
                const targetOffset = computeScrollIntoViewOffset({
                    targetTop: y,
                    targetHeight: height,
                    scrollOffset: scrollOffsetRef.current,
                    viewportHeight,
                    padding: ACTIVE_INPUT_PADDING
                });
                if (targetOffset === null) return;
                scrollViewRef.current?.scrollTo({ y: targetOffset, animated: true });
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
        <MfWrapperView
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
                keyboardShouldPersistTaps="handled"
                {...(!props.allowOverscroll && {
                    overScrollMode: 'never',
                    alwaysBounceVertical: false
                })}
                {...scrollViewProps}
                onLayout={e => {
                    scrollActiveInputIntoView(e);
                    props.onLayout?.(e);
                }}
                onScroll={e => {
                    scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
                    props.onScroll?.(e);
                }}
                style={style}
                contentContainerStyle={contentContainerStyle}
            />
        </MfWrapperView>
    );
});
