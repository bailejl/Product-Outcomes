import React from 'react';
import { Platform, StatusBar } from 'react-native';
import {
  VStack,
  Box,
  SafeAreaView,
  KeyboardAvoidingView,
  ScrollView,
} from '@gluestack-ui/themed';
import { RegisterForm } from '../../components/forms/RegisterForm';

interface RegisterScreenProps {
  navigation: any;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const handleLogin = () => {
    navigation.navigate('Login');
  };

  const handleRegisterSuccess = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Onboarding' }],
    });
  };

  return (
    <SafeAreaView flex={1} backgroundColor="$secondary50">
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
            <VStack alignItems="center" marginBottom="$6">
              <Box
                width={60}
                height={60}
                backgroundColor="$primary500"
                borderRadius="$full"
                justifyContent="center"
                alignItems="center"
                marginBottom="$2"
              >
                {/* Add your logo here */}
                <Box
                  width={30}
                  height={30}
                  backgroundColor="$white"
                  borderRadius={6}
                />
              </Box>
            </VStack>

            {/* Register Form */}
            <Box
              backgroundColor="$white"
              borderRadius="$xl"
              padding="$4"
              shadowColor="$black"
              shadowOffset={{ width: 0, height: 2 }}
              shadowOpacity={0.1}
              shadowRadius={8}
              elevation={4}
            >
              <RegisterForm
                onLogin={handleLogin}
                onSuccess={handleRegisterSuccess}
              />
            </Box>
          </VStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};