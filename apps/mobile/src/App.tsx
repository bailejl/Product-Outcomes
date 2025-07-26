import React from 'react';
import { StatusBar } from 'react-native';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { config } from './config/gluestack-ui';
import { AppNavigator } from './navigation/AppNavigator';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <GluestackUIProvider config={config}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </GluestackUIProvider>
    </ErrorBoundary>
  );
}