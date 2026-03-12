import * as Sentry from '@sentry/react-native';
import { Alert, AlertOptions, AppState, Platform } from 'react-native';
import { logger as rnLogger, transportFunctionType } from 'react-native-logs';

import { getFoundationConfig } from '../config';
import { AppMeta } from './AppMeta';

interface LogEntry {
    aid: number;
    ts: number;
    level: number;
    scope?: string;
    msg: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: Record<string, any>;
}

const LogState = {
    queue: [] as LogEntry[],
    isPushing: false
};

const scribeTransport: transportFunctionType<object> = props => {
    const { extension, level, rawMsg } = props;

    const msg = Array.isArray(rawMsg) && typeof rawMsg[0] === 'string' ? rawMsg.shift() : '-';
    const data = !Array.isArray(rawMsg) || rawMsg.length === 0 ? undefined : rawMsg.length === 1 ? rawMsg[0] : rawMsg;

    LogState.queue.push({
        aid: AppMeta.activateCount,
        ts: Date.now(),
        level: level.severity,
        scope: extension ?? undefined,
        msg,
        data
    });

    if (!LogState.isPushing) pushLogQueue();
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _log: any = null;
let _realConsoleError: typeof console.error = console.error;

function getLog() {
    if (_log) return _log;

    const useDevConfig = !getFoundationConfig().env.LOGGER_URL;
    _log = rnLogger.createLogger(
        useDevConfig
            ? {
                  transportOptions: {
                      colors: {
                          info: 'cyanBright',
                          warn: 'yellowBright',
                          error: 'redBright'
                      }
                  },
                  stringifyFunc: (m: unknown) => JSON.stringify(m, null, 2)
              }
            : {
                  transport: scribeTransport,
                  formatFunc: () => '',
                  stringifyFunc: () => '',
                  dateFormat: () => ''
              }
    );

    _realConsoleError = console.error;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalConsole: { __patched__?: boolean } = global.console as any;
    if (!globalConsole.__patched__) {
        _log.patchConsole();
        globalConsole.__patched__ = true;
    }
    _log.info('Logger initialized');

    return _log;
}

export class UserError extends Error {}

export interface Logger {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    info: (...args: any[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error: (...args: any[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    warn: (...args: any[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    debug: (...args: any[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    interactiveError: (err: any, alertOpts?: AlertOptions) => Promise<void>;
}

export function createLogger(ns: string): Logger {
    const prefix = AppMeta.isDevelopment ? `${Platform.OS} | ` : '';
    // Lazy: defer .extend() to first call so config can be set first
    let childLogger: ReturnType<typeof getLog> | null = null;
    const getChild = () => {
        if (!childLogger) childLogger = getLog().extend(`${prefix}${ns}`);
        return childLogger;
    };
    return {
        info: (...args) => getChild().info(...processArgs(...args)),
        error: (...args) => getChild().error(...processArgs(...args)),
        warn: (...args) => getChild().warn(...processArgs(...args)),
        debug: (...args) => getChild().debug(...processArgs(...args)),
        interactiveError: (err, alertOpts?) => handleResponseError(err, alertOpts, err => getChild().error(err))
    };
}

export function showAlertDialog(title: string, message: string, alertOpts?: AlertOptions) {
    return new Promise<void>(resolve => Alert.alert(title, message, [{ text: 'OK', onPress: () => resolve() }], alertOpts));
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleResponseError(err: any, alertOpts: AlertOptions | undefined, targetLogger: (...args: any[]) => void) {
    if (err instanceof UserError) {
        return showAlertDialog('', err.message);
    }

    for (const cls of getFoundationConfig().userErrorClasses ?? []) {
        if (err instanceof cls) {
            return showAlertDialog('', err.message);
        }
    }

    targetLogger(err.stack);

    if (err.message === 'Network request failed') {
        return showCommunicationError();
    }

    Sentry.captureException(err);

    const supportContact = getFoundationConfig().supportContact ?? 'support';
    return showAlertDialog(
        'Error',
        `An application error was encountered. Please try again. If the problem persists, contact ${supportContact}.\n\n` + err.message,
        alertOpts
    );
}

export async function showCommunicationError() {
    if (AppState.currentState === 'active') {
        await showAlertDialog(
            'Error',
            'There was an error communicating with the server. Please ensure you have an Internet connection and try again.'
        );
    }
}

interface IErrorDescription {
    message: string;
    stack?: string;
    cause?: IErrorDescription;
}
function describeErr(err: Error): IErrorDescription {
    return {
        message: err.message,
        stack: err.stack,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cause: 'cause' in err ? describeErr(err.cause as any) : undefined
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processArgs(...args: any[]) {
    return args.map(arg => {
        if (arg instanceof Error) {
            Sentry.captureException(arg);
            return describeErr(arg);
        }
        return arg;
    });
}

async function pushLogQueue() {
    if (LogState.isPushing) {
        return;
    }

    while (LogState.queue.length > 1000) {
        LogState.queue.shift();
    }

    LogState.isPushing = true;

    // allow a little time for more logs to pour in
    await new Promise(resolve => setTimeout(resolve, 1_000));

    const entries = LogState.queue.slice(0, 100);
    const entriesOut = entries.map(entry => ({
        a: entry.aid,
        t: entry.ts,
        l: entry.level,
        s: entry.scope,
        m: entry.msg,
        x: entry.data
    }));

    try {
        const loggerUrl = getFoundationConfig().env.LOGGER_URL;
        if (!loggerUrl) return;

        const response = await fetch(loggerUrl, {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                i: AppMeta.bundleId,
                v: AppMeta.appVersion,
                d: AppMeta.deviceIdEnv,
                l: AppMeta.launchTs,
                e: entriesOut
            })
        });

        if (response.status !== 201) {
            throw new Error(`Unexpected HTTP response code ${response.status}`);
        }

        LogState.queue.splice(0, entries.length);
    } catch (err) {
        _realConsoleError('Failed to push logs', err);
    }

    LogState.isPushing = false;
    if (LogState.queue.length) setTimeout(pushLogQueue, 1_000);
}
