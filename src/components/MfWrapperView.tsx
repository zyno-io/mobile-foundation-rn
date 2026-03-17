import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Insets, StyleProp, StyleSheet, ViewProps, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { hasHeightOrFlexProps } from '../helpers/layout';

import { useMfKeyboardHeight } from '../hooks/useMfKeyboardHeight';
import { Inset, useMfSafeAreaInsets } from '../hooks/useMfSafeAreaInsets';

export interface MfWrapperViewCommonProps {
    safeArea?: boolean | Inset[] | Inset;
    noKeyboardAvoiding?: boolean;
    noLayoutCheck?: boolean;
    layoutAfterTransition?: boolean;
}

interface MfWrapperViewProps extends MfWrapperViewCommonProps {
    style?: ViewProps['style'];
    children: ViewProps['children'];
    center?: boolean;
    contentContainerStyle?: ViewProps['style'];
    onInsetsPaddingUpdated?: (padding: Insets) => void;
    testID?: string;
}

export const MfWrapperView: React.FC<MfWrapperViewProps> = props => {
    const insets = useMfSafeAreaInsets(props.safeArea);
    const { keyboardOverlapsView, keyboardHeight, KeyboardHeightProvider } = useMfKeyboardHeight(!props.noKeyboardAvoiding);

    // calculate our distance from top/bottom whenever we layout
    // if we're a child of something that's already pushed off the edge (like a nav bar or tab bar),
    // we want to make sure we're not accounting for insets in those contexts
    const viewRef = useRef<Animated.View>(null);
    const [distanceFromTop, setDistanceFromTop] = useState<number>(0);
    const [distanceFromBottom, setDistanceFromBottom] = useState<number>(0);
    const distanceFromBottomSV = useSharedValue(0);
    const onLayout = useCallback(
        (force?: boolean) => {
            if (props.noLayoutCheck) return;
            if (props.layoutAfterTransition && !force) return;
            viewRef.current?.measure((_x, _y, _width, height, _pageX, pageY) => {
                const screenHeight = Dimensions.get('window').height;
                const distFromBottom = screenHeight - (pageY + height);
                setDistanceFromTop(pageY);

                // don't set distance from bottom if this is rendered off screen
                if (pageY < screenHeight) {
                    setDistanceFromBottom(distFromBottom);
                    distanceFromBottomSV.value = distFromBottom;
                }
            });
        },
        [viewRef]
    );
    const onLayoutDb = useCallback(
        // need to debounce because nested MfWrapperViews will continuously shrink during a keyboard animation,
        // causing onLayout to be fired so rapidly that it causes jitter
        debounce(() => onLayout(), 100, { leading: true, trailing: true }),
        [onLayout]
    );

    // post-transition layout checks
    if (props.layoutAfterTransition) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const navigation = useNavigation<StackNavigationProp<any>>();
        useEffect(() => navigation.addListener('transitionEnd', () => onLayout(true)), []);
    }

    // calculate top & bottom insets
    const contentContainerStyle = StyleSheet.flatten(props.contentContainerStyle ?? props.style ?? {});
    const insetsPaddingTop: number = Math.max(
        insets.top - distanceFromTop,
        typeof contentContainerStyle.paddingTop === 'number'
            ? contentContainerStyle.paddingTop
            : typeof contentContainerStyle.paddingVertical === 'number'
              ? contentContainerStyle.paddingVertical
              : typeof contentContainerStyle.padding === 'number'
                ? contentContainerStyle.padding
                : 0
    );
    const insetsPaddingBottom: number = Math.max(
        insets.bottom - distanceFromBottom,
        typeof contentContainerStyle.paddingBottom === 'number'
            ? contentContainerStyle.paddingBottom
            : typeof contentContainerStyle.paddingVertical === 'number'
              ? contentContainerStyle.paddingVertical
              : typeof contentContainerStyle.padding === 'number'
                ? contentContainerStyle.padding
                : 0
    );

    // generate insets
    const computedInsets = useMemo(() => ({ top: insetsPaddingTop, bottom: insetsPaddingBottom }), [insetsPaddingTop, insetsPaddingBottom]);

    // notify child components of insets
    useEffect(() => {
        props.onInsetsPaddingUpdated?.(computedInsets);
    }, [computedInsets]);

    // generate local insets object based on config
    const localInsets = useMemo(
        () => (props.contentContainerStyle ? { top: 0, bottom: 0 } : computedInsets),
        [props.contentContainerStyle, computedInsets]
    );

    // mirror plain JS values as SharedValues so useAnimatedStyle worklets react to changes
    const localInsetsTopSV = useSharedValue(localInsets.top);
    const localInsetsBottomSV = useSharedValue(localInsets.bottom);
    useEffect(() => { localInsetsTopSV.value = localInsets.top; }, [localInsets.top]);
    useEffect(() => { localInsetsBottomSV.value = localInsets.bottom; }, [localInsets.bottom]);
    useEffect(() => { distanceFromBottomSV.value = distanceFromBottom; }, [distanceFromBottom]);

    // calculate animated padding on the UI thread
    const animatedPaddingStyle = useAnimatedStyle(() => {
        const kbHeight = keyboardOverlapsView ? (keyboardHeight?.value ?? 0) : 0;
        return {
            paddingTop: localInsetsTopSV.value,
            paddingBottom: Math.max(kbHeight - distanceFromBottomSV.value, localInsetsBottomSV.value),
        };
    });

    const baseStyle = useMemo<StyleProp<ViewStyle>>(() => {
        const style = StyleSheet.flatten(props.style ?? {});
        return [
            !hasHeightOrFlexProps(style) && { flex: 1 },
            { backgroundColor: contentContainerStyle.backgroundColor ?? 'transparent' },
            props.center && { justifyContent: 'center', alignItems: 'center' },
            style,
        ];
    }, [props.style]);

    const style = useMemo(() => [baseStyle, animatedPaddingStyle], [baseStyle, animatedPaddingStyle]);

    return (
        <KeyboardHeightProvider>
            <Animated.View ref={viewRef} onLayout={onLayoutDb} style={style} testID={props.testID}>
                {props.children}
            </Animated.View>
        </KeyboardHeightProvider>
    );
};
