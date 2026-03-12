const createLoggerChild = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

export const logger = {
    createLogger: jest.fn(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        patchConsole: jest.fn(),
        extend: jest.fn(() => createLoggerChild()),
    })),
};
