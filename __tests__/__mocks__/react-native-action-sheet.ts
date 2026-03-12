export const ActionSheetProvider = ({ children }: any) => children;
export const useActionSheet = jest.fn(() => ({ showActionSheetWithOptions: jest.fn() }));
