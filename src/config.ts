import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { configure } from 'mobx';
import { StatusBarStyle } from 'react-native';

import { ColorScheme } from './types';

export interface FoundationConfig {
    colors: {
        light: ColorScheme;
        dark: ColorScheme;
    };
    env: {
        APP_ENV?: string;
        BUILD_VERSION?: string;
        SENTRY_DSN?: string;
        LOGGER_URL?: string;
        CDN_URL?: string;
    };
    icons: {
        check: IconProp;
        spinner: IconProp;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fonts?: Record<string, any>;
    updaterTimeout?: number;
    statusBar?: {
        barStyle: StatusBarStyle | 'auto';
        backgroundColorKey?: string;
    };
    splashScreen?: 'auto' | 'manual';
    deepLinkHandler?: (url: string) => void;
    supportContact?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userErrorClasses?: (new (...args: any[]) => Error)[];
}

let _config: FoundationConfig | null = null;

export function configureFoundation(config: FoundationConfig) {
    _config = config;

    // MobX config
    configure({ enforceActions: 'never' });

    // Defer to next tick to avoid circular require (config → Logger/Sentry → config)
    setImmediate(() => {
        require('./services/Sentry').SentryHelper.init();
        require('./setup/AppStateTracker');
    });
}

export function getFoundationConfig(): FoundationConfig {
    if (!_config) {
        const err = new Error('@zyno-io/mobile-foundation-rn: configureFoundation() must be called before using foundation components');
        console.error(err.stack);
        throw err;
    }
    return _config;
}
