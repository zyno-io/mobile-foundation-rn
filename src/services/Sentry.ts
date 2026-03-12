import { useNavigationContainerRef } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { getFoundationConfig } from '../config';
import { AppMeta } from './AppMeta';

const navigationIntegration = Sentry.reactNavigationIntegration({
    enableTimeToInitialDisplay: true
});

export class SentryHelper {
    static init() {
        const config = getFoundationConfig();
        Sentry.init({
            dsn: config.env.SENTRY_DSN,
            environment: config.env.APP_ENV,
            release: AppMeta.appVersion,
            dist: Platform.OS,
            debug: false,
            enableNativeFramesTracking: true,
            integrations: [navigationIntegration]
        });
        AppMeta.load().then(() => {
            Sentry.setUser({ id: AppMeta.deviceIdEnv });
        });
    }

    static useNavigationInstrumentation() {
        const ref = useNavigationContainerRef();
        useEffect(() => {
            if (ref) navigationIntegration.registerNavigationContainer(ref);
        }, [ref]);
    }

    static wrap = Sentry.wrap;
}
