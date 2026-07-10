import { ungzip } from "pako";

import { createMockConfig } from "../test-utils";

type TransportProps = {
  extension?: string;
  level: { severity: number };
  rawMsg: unknown[];
};

type Transport = (props: TransportProps) => void;

function mockReactNativeLogs() {
  jest.doMock("react-native-logs", () => {
    const createChild = (extension: string, transport?: Transport) => {
      const send = (severity: number, rawMsg: unknown[]) => {
        transport?.({ extension, level: { severity }, rawMsg: [...rawMsg] });
      };

      return {
        info: jest.fn((...rawMsg: unknown[]) => send(1, rawMsg)),
        warn: jest.fn((...rawMsg: unknown[]) => send(2, rawMsg)),
        error: jest.fn((...rawMsg: unknown[]) => send(3, rawMsg)),
        debug: jest.fn((...rawMsg: unknown[]) => send(0, rawMsg)),
      };
    };

    return {
      logger: {
        createLogger: jest.fn((options: { transport?: Transport } = {}) => ({
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
          patchConsole: jest.fn(),
          extend: jest.fn((extension: string) => createChild(extension, options.transport)),
        })),
      },
    };
  });
}

function loadLogger() {
  mockReactNativeLogs();

  const configModule = require("../../src/config");
  configModule.configureFoundation(
    createMockConfig({
      env: {
        APP_ENV: "production",
        BUILD_VERSION: "1.2.3",
        LOGGER_URL: "https://logger.test/ingest",
      },
    }),
  );

  const loggerModule = require("../../src/services/Logger");
  const { AppMeta } = require("../../src/services/AppMeta");
  Object.assign(AppMeta, { deviceIdEnv: "device-test" });

  return loggerModule as typeof import("../../src/services/Logger");
}

async function flushLogPush() {
  await jest.advanceTimersByTimeAsync(1_000);

  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe("Logger remote transport", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();

    global.fetch = jest.fn(() => Promise.resolve({ status: 201 })) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (global as { fetch?: typeof fetch }).fetch;
  });

  it("sends small log batches as plain JSON", async () => {
    const { createLogger } = loadLogger();

    createLogger("transport").info("small log", { ok: true });
    await flushLogPush();

    const fetchMock = global.fetch as jest.Mock;
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://logger.test/ingest");
    expect(init.headers).toEqual({
      "content-type": "application/json",
    });
    expect(typeof init.body).toBe("string");

    const payload = JSON.parse(init.body as string);
    expect(payload).toEqual(
      expect.objectContaining({
        i: "com.test.app",
        v: "1.2.3",
        d: "device-test",
      }),
    );
    expect(payload.e).toEqual([
      expect.objectContaining({
        l: 1,
        s: "transport",
        m: "small log",
        x: { ok: true },
      }),
    ]);
  });

  it("gzip-compresses large log batches", async () => {
    const { createLogger } = loadLogger();
    const repeated = "audio recovery diagnostic payload ".repeat(500);

    createLogger("transport").info("large log", { repeated });
    await flushLogPush();

    const fetchMock = global.fetch as jest.Mock;
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual({
      "content-type": "application/json",
      "content-encoding": "gzip",
    });
    expect(init.body).toBeInstanceOf(ArrayBuffer);

    const json = ungzip(new Uint8Array(init.body as ArrayBuffer), { to: "string" }) as string;
    const payload = JSON.parse(json);
    expect(payload.e).toEqual([
      expect.objectContaining({
        l: 1,
        s: "transport",
        m: "large log",
        x: { repeated },
      }),
    ]);
  });
});
