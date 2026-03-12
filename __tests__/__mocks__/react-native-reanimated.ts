export const useSharedValue = jest.fn((v: any) => ({ value: v }));
export const useAnimatedStyle = jest.fn((fn: any) => fn());
export const useDerivedValue = jest.fn((fn: any) => ({ value: fn() }));
export const withTiming = jest.fn((v: any) => v);
export const runOnJS = jest.fn((fn: any) => fn);

export default {
    createAnimatedComponent: jest.fn((c: any) => c),
    View: 'Reanimated.View',
};
