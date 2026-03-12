import { AppState } from 'react-native';
import DeviceInfo from 'react-native-device-info';

import { AppMeta } from '../services/AppMeta';
import { createLogger } from '../services/Logger';

const logger = createLogger('AppState');

async function logAppStarted() {
    logger.info('App started', {
        device: {
            mfg: await DeviceInfo.getManufacturer(),
            model: DeviceInfo.getModel(),
            modelId: DeviceInfo.getDeviceId(),
            fontScale: await DeviceInfo.getFontScale(),
            totalDisk: await DeviceInfo.getTotalDiskCapacity(),
            freeDisk: await DeviceInfo.getFreeDiskStorage(),
            os: DeviceInfo.getSystemName(),
            osVersion: DeviceInfo.getSystemVersion(),
            osBuild: await DeviceInfo.getBuildId()
        }
    });
}

function logAppActivated() {
    logger.info('App activated');
    AppMeta.activateCount++;
}

function logAppDeactivated() {
    logger.info('App deactivated');
}

AppState.addEventListener('change', nextState => {
    if (nextState === 'active') logAppActivated();
    else if (nextState === 'background') logAppDeactivated();
});

logAppStarted();
