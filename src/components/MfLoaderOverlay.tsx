import React from 'react';
import { View } from 'react-native';
import { observer } from 'mobx-react-lite';

import { createStyles, useStyles } from '../helpers/styles';
import { LoaderState } from '../helpers/observable';

import { MfLoader } from './MfLoader';

export const MfLoaderOverlay: React.FC<{ solo?: boolean; testID?: string }> = ({ solo, testID }) => {
    const styles = useStyles(styleGen);

    return (
        <View testID={testID} style={[styles.outerWrapper, solo && styles.solo]}>
            <MfLoader background />
        </View>
    );
};

export const GlobalLoaderOverlay = observer(() => {
    if (LoaderState.loaderCount === 0) {
        return null;
    }
    return <MfLoaderOverlay />;
});

const styleGen = createStyles(() => ({
    solo: {
        backgroundColor: 'rgba(0, 0, 0, 0.3)'
    },
    outerWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 10,
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center'
    }
}));
