export const KeyboardProvider = ({ children }: any) => children;
export const useReanimatedKeyboardAnimation = jest.fn(() => ({
    height: { value: 0 },
    progress: { value: 0 },
}));
