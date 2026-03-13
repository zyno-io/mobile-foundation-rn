import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon, FontAwesomeIconStyle } from '@fortawesome/react-native-fontawesome';

import { useColors } from '../helpers/styles';

export interface MfIconProps {
    icon: IconProp;
    size?: number;
    color?: string;
    style?: FontAwesomeIconStyle;
}

export const MfIcon: React.FC<MfIconProps> = props => {
    const colors = useColors();
    return <FontAwesomeIcon icon={props.icon} size={props.size ?? 16} color={props.color || colors.text} style={props.style} />;
};
