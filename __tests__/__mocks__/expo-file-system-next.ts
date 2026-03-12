export const File = jest.fn().mockImplementation((uri: string) => ({
    uri,
    write: jest.fn(),
}));
