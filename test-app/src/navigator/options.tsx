import { TransitionSpecs, HeaderStyleInterpolators } from '@react-navigation/stack';

const Headerless = {
    headerShown: false,
    headerShadowVisible: false,
};

const ModalTransition = {
    gestureDirection: 'vertical' as const,
    transitionSpec: {
        open: TransitionSpecs.TransitionIOSSpec,
        close: TransitionSpecs.TransitionIOSSpec,
    },
    headerStyleInterpolator: HeaderStyleInterpolators.forNoAnimation,
    cardStyleInterpolator: ({ current, layouts }: any) => ({
        cardStyle: {
            transform: [
                {
                    translateY: current.progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [layouts.screen.height, 0],
                    }),
                },
            ],
        },
        overlayStyle: {
            opacity: current.progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.8],
                extrapolate: 'clamp',
            }),
        },
    }),
};

export const NavigatorOptions = {
    Headerless,
    Modal: { ...Headerless, ...ModalTransition },
    CommonHeader: {
        headerShown: true,
        headerMode: 'float' as const,
        headerBackTitle: '',
    },
};
