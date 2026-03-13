export const GestureHandlerRootView = ({ children }: any) => children;

// Pressable needs to be a real component because MfButton passes a function to its style prop
export const Pressable = ({ children, style, ...props }: any) => {
    const React = require('react');
    const resolvedStyle = typeof style === 'function' ? style({ pressed: false }) : style;
    return React.createElement('Pressable', { ...props, style: resolvedStyle }, children);
};
