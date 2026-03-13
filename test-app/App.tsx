// IMPORTANT: configure must be imported first so it runs before any other
// foundation modules that call getFoundationConfig() at module scope
import './src/configure';

import React from 'react';
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createStackNavigator, StackNavigationProp } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
    MfProvider,
    useSetupFoundation,
} from '@zyno-io/mobile-foundation-rn';

import { NavigatorOptions } from './src/navigator/options';
import { EmptyTabScreen } from './src/screens/EmptyTabScreen';
import { FullViewBottomInputScreen } from './src/screens/FullViewBottomInput';
import { TabBarBottomInputScreen } from './src/screens/TabBarBottomInput';
import { ScrollViewLowInputScreen } from './src/screens/ScrollViewLowInput';
import { NavigationHeaderLowInputScreen } from './src/screens/NavigationHeaderLowInput';
import { ModalWithHeaderInputScreen } from './src/screens/ModalWithHeaderInput';
import { FormKeyboardNavigationScreen } from './src/screens/FormKeyboardNavigation';
import { ComposerPatternScreen } from './src/screens/ComposerPattern';
import { ModalComposerPatternScreen } from './src/screens/ModalComposerPattern';
import { NestedScrollInputsScreen } from './src/screens/NestedScrollInputs';

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

const RootStack = createStackNavigator();
const HeaderStack = createStackNavigator();
const ModalHeaderStack = createStackNavigator();
const TabNav = createBottomTabNavigator();
const ComposerTabNav = createBottomTabNavigator();

function HomeScreen() {
    const navigation = useNavigation<StackNavigationProp<any>>();
    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="home-scroll">
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
}

function TabNavigator() {
    return (
        <TabNav.Navigator
            screenOptions={{
                ...NavigatorOptions.CommonHeader,
                tabBarStyle: { height: 90 },
            }}
        >
            <TabNav.Screen name="InputTab" component={TabBarBottomInputScreen} options={{ tabBarTestID: 'tab-InputTab' }} />
            <TabNav.Screen name="EmptyTab1" component={EmptyTabScreen} options={{ tabBarTestID: 'tab-EmptyTab1' }} />
            <TabNav.Screen name="EmptyTab2" component={EmptyTabScreen} options={{ tabBarTestID: 'tab-EmptyTab2' }} />
            <TabNav.Screen name="EmptyTab3" component={EmptyTabScreen} options={{ tabBarTestID: 'tab-EmptyTab3' }} />
        </TabNav.Navigator>
    );
}

function HeaderStackNavigator() {
    return (
        <HeaderStack.Navigator screenOptions={{ ...NavigatorOptions.CommonHeader, headerShown: true }}>
            <HeaderStack.Screen name="HeaderLowInput" component={NavigationHeaderLowInputScreen} options={{ title: 'Header Test' }} />
        </HeaderStack.Navigator>
    );
}

function ModalWithHeaderStackNavigator() {
    return (
        <ModalHeaderStack.Navigator screenOptions={{ ...NavigatorOptions.CommonHeader, headerShown: true }}>
            <ModalHeaderStack.Screen name="ModalHeaderInput" component={ModalWithHeaderInputScreen} options={{ title: 'Modal Header Test' }} />
        </ModalHeaderStack.Navigator>
    );
}

function ComposerTabNavigator() {
    return (
        <ComposerTabNav.Navigator
            screenOptions={{
                ...NavigatorOptions.CommonHeader,
                tabBarStyle: { height: 90 },
            }}
        >
            <ComposerTabNav.Screen name="Chat" component={ComposerPatternScreen} options={{ tabBarTestID: 'tab-Chat' }} />
            <ComposerTabNav.Screen name="Empty1" component={EmptyTabScreen} options={{ tabBarTestID: 'tab-Empty1' }} />
        </ComposerTabNav.Navigator>
    );
}

function AppContent() {
    const isReady = useSetupFoundation();
    if (!isReady) return null;

    return (
        <NavigationContainer>
            <RootStack.Navigator screenOptions={{ gestureEnabled: false, headerShown: false, headerBackTitle: '' }}>
                <RootStack.Screen name="Home" component={HomeScreen} />
                <RootStack.Screen name="FullViewBottomInput" component={FullViewBottomInputScreen} options={{ ...NavigatorOptions.Headerless }} />
                <RootStack.Screen name="TabBarBottomInput" component={TabNavigator} options={{ ...NavigatorOptions.Headerless }} />
                <RootStack.Screen name="ScrollViewLowInput" component={ScrollViewLowInputScreen} options={{ ...NavigatorOptions.CommonHeader, title: 'Scroll Test' }} />
                <RootStack.Screen name="NavigationHeaderLowInput" component={HeaderStackNavigator} options={{ ...NavigatorOptions.Headerless }} />
                <RootStack.Screen name="ModalWithHeaderInput" component={ModalWithHeaderStackNavigator} options={{ ...NavigatorOptions.Modal }} />
                <RootStack.Screen name="FormKeyboardNavigation" component={FormKeyboardNavigationScreen} options={{ ...NavigatorOptions.CommonHeader, title: 'Form Test' }} />
                <RootStack.Screen name="ComposerPattern" component={ComposerTabNavigator} options={{ ...NavigatorOptions.Headerless }} />
                <RootStack.Screen name="ModalComposerPattern" component={ModalComposerPatternScreen} options={{ ...NavigatorOptions.Modal, headerShown: true, title: 'New Message' }} />
                <RootStack.Screen name="NestedScrollInputs" component={NestedScrollInputsScreen} options={{ ...NavigatorOptions.CommonHeader, title: 'Nested Scroll Test' }} />
            </RootStack.Navigator>
        </NavigationContainer>
    );
}

export default function App() {
    return (
        <MfProvider>
            <AppContent />
        </MfProvider>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    content: { padding: 20, paddingTop: 80 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
    button: { backgroundColor: '#007AFF', padding: 16, borderRadius: 8, marginBottom: 12 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '500' },
});
