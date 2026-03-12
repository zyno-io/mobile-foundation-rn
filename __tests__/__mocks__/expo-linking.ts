export const getInitialURL = jest.fn(() => Promise.resolve(null));
export const addEventListener = jest.fn(() => ({ remove: jest.fn() }));
