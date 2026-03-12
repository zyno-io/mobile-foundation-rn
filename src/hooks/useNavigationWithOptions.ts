import { useNavigation } from '@react-navigation/native';
import { StackNavigationOptions } from '@react-navigation/stack';
import { useEffect } from 'react';

export function useNavigationWithTitle(title: string) {
    return useNavigationWithOptions({ headerTitle: title });
}

export function useNavigationWithOptions(options: Partial<StackNavigationOptions>) {
    const navigation = useNavigation();
    useEffect(() => {
        navigation.setOptions(options);
    }, [navigation, options]);
    return navigation;
}
