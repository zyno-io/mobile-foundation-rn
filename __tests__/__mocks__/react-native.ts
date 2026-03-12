export const Platform = { OS: 'ios', Version: '17.0', select: (opts: any) => opts.ios };

export const StyleSheet = {
    create: <T extends Record<string, any>>(styles: T): T => styles,
    flatten: (style: any) => {
        if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean));
        return style || {};
    },
};

export const Dimensions = {
    get: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};

export const AppState = {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};

export const StatusBar = Object.assign(
    (props: any) => null,
    { setBarStyle: jest.fn(), setBackgroundColor: jest.fn() },
);
export const Alert = { alert: jest.fn() };

export const Easing = {
    linear: (t: number) => t,
    ease: (t: number) => t,
    in: (t: number) => t,
    out: (t: number) => t,
    inOut: (t: number) => t,
};

export const Animated = {
    Value: jest.fn(() => ({ interpolate: jest.fn(), setValue: jest.fn() })),
    timing: jest.fn(() => ({ start: jest.fn() })),
    loop: jest.fn(() => ({ start: jest.fn(), stop: jest.fn() })),
    View: 'Animated.View',
    createAnimatedComponent: jest.fn((c: any) => c),
};

export const useColorScheme = jest.fn(() => 'light');
export const Pressable = 'Pressable';
export const View = 'View';
export const Text = 'Text';
export const TextInput = 'TextInput';
export const ScrollView = 'ScrollView';
export const FlatList = 'FlatList';

export const Linking = {
    getInitialURL: jest.fn(() => Promise.resolve(null)),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};
