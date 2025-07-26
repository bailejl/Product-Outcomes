import React from 'react';
import { Platform, StatusBar } from 'react-native';
import {
  VStack,
  Box,
  SafeAreaView,
  KeyboardAvoidingView,
  ScrollView,
} from '@gluestack-ui/themed';
import { LoginForm } from '../../components/forms/LoginForm';

interface LoginScreenProps {
  navigation: any;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  const handleRegister = () => {
    navigation.navigate('Register');
  };

  const handleLoginSuccess = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  };

  return (
    <SafeAreaView flex={1} backgroundColor="$white">
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="transparent" 
        translucent 
      />
      
      <KeyboardAvoidingView
        flex={1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          flex={1}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <VStack flex={1} justifyContent="center" padding="$4">
            {/* App Logo/Branding Section */}
            <VStack alignItems="center" marginBottom="$8">
              <Box
                width={80}
                height={80}
                backgroundColor="$primary500"
                borderRadius="$full"
                justifyContent="center"
                alignItems="center"
                marginBottom="$4"
              >
                {/* Add your logo here */}
                <Box
                  width={40}
                  height={40}
                  backgroundColor="$white"
                  borderRadius={8}
                />
              </Box>
            </VStack>

            {/* Login Form */}
            <Box
              backgroundColor="$white"
              borderRadius="$xl"
              padding="$6"
              shadowColor="$black"
              shadowOffset={{ width: 0, height: 2 }}
              shadowOpacity={0.1}
              shadowRadius={8}
              elevation={4}
            >
              <LoginForm
                onForgotPassword={handleForgotPassword}
                onRegister={handleRegister}
                onSuccess={handleLoginSuccess}
              />
            </Box>
          </VStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

