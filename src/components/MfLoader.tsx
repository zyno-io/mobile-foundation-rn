import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, ViewProps } from 'react-native';

import { getFoundationConfig } from '../config';
import { createStyles, useColors, useStyles } from '../helpers/styles';

interface MfLoaderProps {
    color?: string;
    size?: number;
    background?: boolean;
}
interface MfLoaderViewProps extends ViewProps {
    color?: string;
    size?: number;
}
export const MfLoader: React.FC<MfLoaderProps> = ({ color, size, background }) => {
    const styles = useStyles(styleGen);
    const colors = useColors();
    const spinValue = useRef(new Animated.Value(0)).current;

    // Start the spin animation
    useEffect(() => {
        Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 1500,
                easing: Easing.linear,
                useNativeDriver: true
            })
        ).start();
    }, []);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    size ??= 64;

    return (
        <View
            style={[
                styles.wrapper,
                { width: size, height: size },
                background && { ...styles.wrapperBackground, width: size + 12, height: size + 12 }
            ]}
        >
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <FontAwesomeIcon icon={getFoundationConfig().icons.spinner} size={size} color={color ?? colors.primaryButtonBackground} />
            </Animated.View>
        </View>
    );
};

export const MfLoaderView: React.FC<MfLoaderViewProps> = props => {
    const styles = useStyles(styleGen);
    const { color, size, ...rest } = props;

    return (
        <View {...rest} style={[styles.loaderView, rest.style]}>
            <MfLoader color={color} size={size} />
        </View>
    );
};

const styleGen = createStyles(() => ({
    loaderView: {
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1
    },
    wrapper: {},
    wrapperBackground: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        borderRadius: '50%' as unknown as number,
        justifyContent: 'center',
        alignItems: 'center'
    }
}));
