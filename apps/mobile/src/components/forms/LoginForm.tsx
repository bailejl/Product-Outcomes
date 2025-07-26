import React, { useState } from 'react';
import { Platform, Alert } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  VStack,
  HStack,
  Input,
  InputField,
  Button,
  ButtonText,
  Text,
  Checkbox,
  CheckboxIndicator,
  CheckboxIcon,
  CheckboxLabel,
  Link,
  LinkText,
  Alert as GLAlert,
  AlertIcon,
  AlertText,
  Spinner,
} from '@gluestack-ui/themed';
import { useAuth } from '../../hooks/useAuth';
import { BiometricButton } from '../ui/BiometricButton';
import { LoginCredentials } from '../../types/auth.types';
import { loginSchema } from '../../utils/validation';

interface LoginFormProps {
  onForgotPassword: () => void;
  onRegister: () => void;
  onSuccess?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onForgotPassword,
  onRegister,
  onSuccess,
}) => {
  const { 
    login, 
    loginWithBiometrics, 
    isLoading, 
    error, 
    clearError,
    biometricConfig,
    canUseBiometrics 
  } = useAuth();
  
  const [showPassword, setShowPassword] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm<LoginCredentials>({
    resolver: yupResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    mode: 'onChange',
  });

  const watchedValues = watch();

  const onSubmit = async (data: LoginCredentials) => {
    clearError();
    
    const result = await login(data);
    
    if (result.success) {
      onSuccess?.();
    }
  };

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    clearError();
    
    try {
      const result = await loginWithBiometrics();
      
      if (result.success) {
        onSuccess?.();
      }
    } catch (error) {
      console.error('Biometric login error:', error);
    } finally {
      setBiometricLoading(false);
    }
  };

  return (
    <VStack space="lg" padding="$4">
      {/* Header */}
      <VStack space="xs" alignItems="center">
        <Text size="2xl" fontWeight="bold" color="$primary700">
          Welcome Back
        </Text>
        <Text size="sm" color="$secondary600" textAlign="center">
          Sign in to your account to continue
        </Text>
      </VStack>

      {/* Error Alert */}
      {error && (
        <GLAlert action="error" variant="solid">
          <AlertIcon />
          <AlertText>{error}</AlertText>
        </GLAlert>
      )}

      {/* Login Form */}
      <VStack space="md">
        {/* Email Input */}
        <VStack space="xs">
          <Text size="sm" fontWeight="medium" color="$secondary700">
            Email Address
          </Text>
          <Controller
            name="email"
            control={control}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                variant="outline"
                size="md"
                isInvalid={!!errors.email}
                isDisabled={isLoading}
              >
                <InputField
                  placeholder="Enter your email"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                />
              </Input>
            )}
          />
          {errors.email && (
            <Text size="xs" color="$error500">
              {errors.email.message}
            </Text>
          )}
        </VStack>

        {/* Password Input */}
        <VStack space="xs">
          <Text size="sm" fontWeight="medium" color="$secondary700">
            Password
          </Text>
          <Controller
            name="password"
            control={control}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                variant="outline"
                size="md"
                isInvalid={!!errors.password}
                isDisabled={isLoading}
              >
                <InputField
                  placeholder="Enter your password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit(onSubmit)}
                />
              </Input>
            )}
          />
          {errors.password && (
            <Text size="xs" color="$error500">
              {errors.password.message}
            </Text>
          )}
        </VStack>

        {/* Remember Me & Forgot Password */}
        <HStack justifyContent="space-between" alignItems="center">
          <Controller
            name="rememberMe"
            control={control}
            render={({ field: { onChange, value } }) => (
              <Checkbox
                size="sm"
                isChecked={value}
                onChange={onChange}
                isDisabled={isLoading}
              >
                <CheckboxIndicator>
                  <CheckboxIcon />
                </CheckboxIndicator>
                <CheckboxLabel>
                  <Text size="xs" color="$secondary600">
                    Remember me
                  </Text>
                </CheckboxLabel>
              </Checkbox>
            )}
          />
          
          <Link onPress={onForgotPassword}>
            <LinkText size="xs" color="$primary600">
              Forgot password?
            </LinkText>
          </Link>
        </HStack>

        {/* Login Button */}
        <Button
          size="lg"
          variant="solid"
          onPress={handleSubmit(onSubmit)}
          isDisabled={isLoading || !isValid}
        >
          {isLoading ? (
            <HStack alignItems="center" space="sm">
              <Spinner color="$white" size="small" />
              <ButtonText>Signing in...</ButtonText>
            </HStack>
          ) : (
            <ButtonText>Sign In</ButtonText>
          )}
        </Button>

        {/* Biometric Login */}
        {canUseBiometrics && (
          <VStack space="sm" alignItems="center">
            <Text size="xs" color="$secondary500">
              or
            </Text>
            <BiometricButton
              biometricConfig={biometricConfig}
              onPress={handleBiometricLogin}
              isLoading={biometricLoading}
              variant="outline"
              size="lg"
            />
          </VStack>
        )}
      </VStack>

      {/* Register Link */}
      <HStack justifyContent="center" space="xs" marginTop="$4">
        <Text size="sm" color="$secondary600">
          Don't have an account?
        </Text>
        <Link onPress={onRegister}>
          <LinkText size="sm" color="$primary600" fontWeight="medium">
            Sign up
          </LinkText>
        </Link>
      </HStack>
    </VStack>
  );
};