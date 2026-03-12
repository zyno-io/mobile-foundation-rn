export const useNavigation = jest.fn(() => ({
    setOptions: jest.fn(),
    navigate: jest.fn(),
    goBack: jest.fn(),
}));
export const useNavigationContainerRef = jest.fn(() => ({ current: null }));
export const useFocusEffect = jest.fn((cb: any) => cb());
export const NavigationContainer = ({ children }: any) => children;
export const ThemeProvider = ({ children }: any) => children;
export const DarkTheme = { dark: true, colors: {} };
export const DefaultTheme = { dark: false, colors: {} };
