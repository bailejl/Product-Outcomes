import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar, Platform } from 'react-native';

import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import SettingsNavigator from './SettingsNavigator';
import ModalScreen from '../screens/ModalScreen';

import { RootStackParamList } from './types';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme, isDark } = useTheme();

  if (isLoading) {
    // You might want to show a splash screen here
    return null;
  }

  return (
    <NavigationContainer
      theme={{
        dark: isDark,
        colors: {
          primary: theme.colors.primary,
          background: theme.colors.background,
          card: theme.colors.surface,
          text: theme.colors.text,
          border: theme.colors.border,
          notification: theme.colors.accent,
        },
      }}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
        translucent={Platform.OS === 'android'}
      />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          gestureEnabled: Platform.OS === 'ios',
        }}
      >
        {isAuthenticated ? (
          // Authenticated user screens
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen 
              name="Settings" 
              component={SettingsNavigator}
              options={{
                presentation: 'modal',
                gestureEnabled: true,
              }}
            />
            <Stack.Screen
              name="Modal"
              component={ModalScreen}
              options={{
                presentation: 'modal',
                headerShown: true,
                headerTitle: 'Modal',
              }}
            />
          </>
        ) : (
          // Unauthenticated user screens
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;