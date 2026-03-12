import { ViewStyle } from 'react-native';

export function hasHeightOrFlexProps(style: ViewStyle): boolean {
    return (
        style.height !== undefined ||
        style.flex !== undefined ||
        style.flexGrow !== undefined ||
        style.flexShrink !== undefined ||
        style.flexBasis !== undefined
    );
}
