import * as TestFlight from 'expo-testflight';
import { updateId } from 'expo-updates';
import { compact } from 'lodash';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

import { memoizeAsync } from '../helpers/memoize';
import { getFoundationConfig } from '../config';

let _appVersionExtended: string | null = null;
const bundleId = DeviceInfo.getBundleId();
const platformVersion = Platform.Version;
const platformVersionInt = typeof platformVersion === 'string' ? parseInt(platformVersion, 10) : platformVersion;

export class AppMeta {
    static readonly isDevelopment = process.env.NODE_ENV === 'development';
    static get appEnv() {
        return getFoundationConfig().env.APP_ENV;
    }
    static get appEnvTf() {
        return TestFlight.isTestFlight ? `${this.appEnv}-tf` : this.appEnv;
    }
    static readonly baseAppVersion = [...DeviceInfo.getVersion().split('.'), '0', '0'].slice(0, 3).join('.');
    static get appVersion() {
        return getFoundationConfig().env.BUILD_VERSION || this.baseAppVersion;
    }
    static get appVersionExtended() {
        return _appVersionExtended ?? this.appVersion;
    }
    static readonly bundleId = bundleId;
    static readonly platformVersion = platformVersion;
    static readonly platformVersionInt = platformVersionInt;

    static readonly deviceId = '';
    static readonly deviceIdEnv = '';
    static readonly isSimulator = DeviceInfo.isEmulatorSync();

    static readonly launchTs = Date.now();
    static activateCount = 0;

    static readonly load = memoizeAsync(async () => {
        await DeviceInfo.syncUniqueId();

        const config = getFoundationConfig();
        const deviceId = await DeviceInfo.getUniqueId();
        const deviceIdSuffix = config.env.APP_ENV !== 'production' ? `${config.env.APP_ENV?.substring(0, 5)}` : TestFlight.isTestFlight ? 'tf' : null;
        const deviceIdEnv = deviceIdSuffix ? `${deviceId}-${deviceIdSuffix}` : deviceId;
        _appVersionExtended = compact([config.env.BUILD_VERSION, this.baseAppVersion, updateId?.replace(/-.*$/, '')]).join(' | ');

        Object.assign(this, {
            deviceId,
            deviceIdEnv
        });
    });
}
