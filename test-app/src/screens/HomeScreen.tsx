import React from 'react';
import { ScrollView, Pressable, View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

const screens = [
    { name: 'FullViewBottomInput', label: '1. Full View — Bottom Input' },
    { name: 'TabBarBottomInput', label: '2. Tab Bar — Bottom Input' },
    { name: 'ScrollViewLowInput', label: '3. ScrollView — Low Input' },
    { name: 'NavigationHeaderLowInput', label: '4. Nav Header — Low Input' },
    { name: 'ModalWithHeaderInput', label: '5. Modal + Header — Input' },
    { name: 'FormKeyboardNavigation', label: '6. Form Keyboard Navigation' },
    { name: 'ComposerPattern', label: '7. Composer in Tab Stack' },
    { name: 'ModalComposerPattern', label: '8. Modal Composer' },
    { name: 'NestedScrollInputs', label: '9. Nested Scroll Inputs' },
];

export const HomeScreen: React.FC = () => {
    const navigation = useNavigation<StackNavigationProp<any>>();

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Foundation E2E Tests</Text>
            {screens.map(screen => (
                <Pressable
                    key={screen.name}
                    testID={`nav-${screen.name}`}
                    style={styles.button}
                    onPress={() => navigation.navigate(screen.name)}
                >
                    <Text style={styles.buttonText}>{screen.label}</Text>
                </Pressable>
            ))}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    content: { padding: 20, paddingTop: 80 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
    button: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '500' },
});
