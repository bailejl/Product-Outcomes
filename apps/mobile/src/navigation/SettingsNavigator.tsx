import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';

// Import screens
import SettingsHomeScreen from '../screens/settings/SettingsHomeScreen';
import AccountScreen from '../screens/settings/AccountScreen';
import NotificationsScreen from '../screens/settings/NotificationsScreen';
import PrivacyScreen from '../screens/settings/PrivacyScreen';
import SecurityScreen from '../screens/settings/SecurityScreen';
import AboutScreen from '../screens/settings/AboutScreen';

import { SettingsStackParamList } from './types';
import { useTheme } from '../contexts/ThemeContext';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

const SettingsNavigator: React.FC = () => {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="SettingsHome"
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Settings',
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
          color: theme.colors.text,
        },
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.primary,
        gestureEnabled: Platform.OS === 'ios',
        animation: Platform.OS === 'ios' ? 'slide_from_right' : 'fade',
      }}
    >
      <Stack.Screen 
        name="SettingsHome" 
        component={SettingsHomeScreen}
        options={{
          title: 'Settings',
        }}
      />
      <Stack.Screen 
        name="Account" 
        component={AccountScreen}
        options={{
          title: 'Account',
        }}
      />
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{
          title: 'Notifications',
        }}
      />
      <Stack.Screen 
        name="Privacy" 
        component={PrivacyScreen}
        options={{
          title: 'Privacy',
        }}
      />
      <Stack.Screen 
        name="Security" 
        component={SecurityScreen}
        options={{
          title: 'Security',
        }}
      />
      <Stack.Screen 
        name="About" 
        component={AboutScreen}
        options={{
          title: 'About',
        }}
      />
    </Stack.Navigator>
  );
};

export default SettingsNavigator;