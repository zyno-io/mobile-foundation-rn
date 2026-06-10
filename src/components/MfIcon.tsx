import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon, FontAwesomeIconStyle } from '@fortawesome/react-native-fontawesome';

import { getFoundationConfig } from '../config';
import { useColors } from '../helpers/styles';

export interface MfIconProps {
    icon: IconProp;
    size?: number;
    color?: string;
    style?: FontAwesomeIconStyle;
    testID?: string;
}

export const MfIcon: React.FC<MfIconProps> = props => {
    const colors = useColors();
    const colorKey = getFoundationConfig().defaults?.icon?.colorKey;
    const defaultColor = colorKey ? colors[colorKey] : colors.text;
    return <FontAwesomeIcon icon={props.icon} size={props.size ?? 16} color={props.color || defaultColor} style={props.style} testID={props.testID} />;
};
