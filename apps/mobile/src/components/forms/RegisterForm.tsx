import React, { useState } from 'react';
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
  Select,
  SelectTrigger,
  SelectInput,
  SelectIcon,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicatorWrapper,
  SelectDragIndicator,
  SelectItem,
  Link,
  LinkText,
  Alert as GLAlert,
  AlertIcon,
  AlertText,
  Spinner,
  ScrollView,
} from '@gluestack-ui/themed';
import { useAuth } from '../../hooks/useAuth';
import { PasswordStrengthIndicator } from '../ui/PasswordStrengthIndicator';
import { RegisterCredentials, UserRole } from '../../types/auth.types';
import { registerSchema, calculatePasswordStrength } from '../../utils/validation';

interface RegisterFormProps {
  onLogin: () => void;
  onSuccess?: () => void;
}

const USER_ROLES: { value: UserRole; label: string; description: string }[] = [
  { 
    value: 'EMPLOYEE', 
    label: 'Employee', 
    description: 'Standard user with basic access' 
  },
  { 
    value: 'MANAGER', 
    label: 'Manager', 
    description: 'Team lead with management capabilities' 
  },
  { 
    value: 'ADMIN', 
    label: 'Administrator', 
    description: 'Full system access and administration' 
  },
  { 
    value: 'GUEST', 
    label: 'Guest', 
    description: 'Limited access for external users' 
  },
];

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onLogin,
  onSuccess,
}) => {
  const { register, isLoading, error, clearError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm<RegisterCredentials>({
    resolver: yupResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'EMPLOYEE',
      acceptTerms: false,
    },
    mode: 'onChange',
  });

  const watchedPassword = watch('password');
  const passwordStrength = calculatePasswordStrength(watchedPassword || '');

  const onSubmit = async (data: RegisterCredentials) => {
    clearError();
    
    const result = await register(data);
    
    if (result.success) {
      onSuccess?.();
    }
  };

  return (
    <ScrollView>
      <VStack space="lg" padding="$4">
        {/* Header */}
        <VStack space="xs" alignItems="center">
          <Text size="2xl" fontWeight="bold" color="$primary700">
            Create Account
          </Text>
          <Text size="sm" color="$secondary600" textAlign="center">
            Join us to get started with your journey
          </Text>
        </VStack>

        {/* Error Alert */}
        {error && (
          <GLAlert action="error" variant="solid">
            <AlertIcon />
            <AlertText>{error}</AlertText>
          </GLAlert>
        )}

        {/* Registration Form */}
        <VStack space="md">
          {/* Name Fields */}
          <HStack space="md">
            <VStack space="xs" flex={1}>
              <Text size="sm" fontWeight="medium" color="$secondary700">
                First Name
              </Text>
              <Controller
                name="firstName"
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    variant="outline"
                    size="md"
                    isInvalid={!!errors.firstName}
                    isDisabled={isLoading}
                  >
                    <InputField
                      placeholder="First name"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </Input>
                )}
              />
              {errors.firstName && (
                <Text size="xs" color="$error500">
                  {errors.firstName.message}
                </Text>
              )}
            </VStack>

            <VStack space="xs" flex={1}>
              <Text size="sm" fontWeight="medium" color="$secondary700">
                Last Name
              </Text>
              <Controller
                name="lastName"
                control={control}
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    variant="outline"
                    size="md"
                    isInvalid={!!errors.lastName}
                    isDisabled={isLoading}
                  >
                    <InputField
                      placeholder="Last name"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </Input>
                )}
              />
              {errors.lastName && (
                <Text size="xs" color="$error500">
                  {errors.lastName.message}
                </Text>
              )}
            </VStack>
          </HStack>

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

          {/* Role Selection */}
          <VStack space="xs">
            <Text size="sm" fontWeight="medium" color="$secondary700">
              Role
            </Text>
            <Controller
              name="role"
              control={control}
              render={({ field: { onChange, value } }) => (
                <Select selectedValue={value} onValueChange={onChange}>
                  <SelectTrigger variant="outline" size="md">
                    <SelectInput placeholder="Select your role" />
                    <SelectIcon />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdrop />
                    <SelectContent>
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      {USER_ROLES.map((role) => (
                        <SelectItem
                          key={role.value}
                          label={role.label}
                          value={role.value}
                        />
                      ))}
                    </SelectContent>
                  </SelectPortal>
                </Select>
              )}
            />
            {errors.role && (
              <Text size="xs" color="$error500">
                {errors.role.message}
              </Text>
            )}
            {/* Role Description */}
            {watch('role') && (
              <Text size="xs" color="$secondary500">
                {USER_ROLES.find(r => r.value === watch('role'))?.description}
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
                    placeholder="Create a strong password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!showPassword}
                    returnKeyType="next"
                  />
                </Input>
              )}
            />
            {/* Password Strength Indicator */}
            {watchedPassword && (
              <PasswordStrengthIndicator 
                strength={passwordStrength}
                showFeedback={true}
              />
            )}
            {errors.password && (
              <Text size="xs" color="$error500">
                {errors.password.message}
              </Text>
            )}
          </VStack>

          {/* Confirm Password Input */}
          <VStack space="xs">
            <Text size="sm" fontWeight="medium" color="$secondary700">
              Confirm Password
            </Text>
            <Controller
              name="confirmPassword"
              control={control}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  variant="outline"
                  size="md"
                  isInvalid={!!errors.confirmPassword}
                  isDisabled={isLoading}
                >
                  <InputField
                    placeholder="Confirm your password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!showConfirmPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit(onSubmit)}
                  />
                </Input>
              )}
            />
            {errors.confirmPassword && (
              <Text size="xs" color="$error500">
                {errors.confirmPassword.message}
              </Text>
            )}
          </VStack>

          {/* Terms and Conditions */}
          <VStack space="xs">
            <Controller
              name="acceptTerms"
              control={control}
              render={({ field: { onChange, value } }) => (
                <Checkbox
                  size="sm"
                  isChecked={value}
                  onChange={onChange}
                  isDisabled={isLoading}
                  isInvalid={!!errors.acceptTerms}
                >
                  <CheckboxIndicator>
                    <CheckboxIcon />
                  </CheckboxIndicator>
                  <CheckboxLabel>
                    <Text size="xs" color="$secondary600">
                      I agree to the{' '}
                      <Text color="$primary600" textDecorationLine="underline">
                        Terms of Service
                      </Text>
                      {' '}and{' '}
                      <Text color="$primary600" textDecorationLine="underline">
                        Privacy Policy
                      </Text>
                    </Text>
                  </CheckboxLabel>
                </Checkbox>
              )}
            />
            {errors.acceptTerms && (
              <Text size="xs" color="$error500">
                {errors.acceptTerms.message}
              </Text>
            )}
          </VStack>

          {/* Register Button */}
          <Button
            size="lg"
            variant="solid"
            onPress={handleSubmit(onSubmit)}
            isDisabled={isLoading || !isValid}
            marginTop="$2"
          >
            {isLoading ? (
              <HStack alignItems="center" space="sm">
                <Spinner color="$white" size="small" />
                <ButtonText>Creating Account...</ButtonText>
              </HStack>
            ) : (
              <ButtonText>Create Account</ButtonText>
            )}
          </Button>
        </VStack>

        {/* Login Link */}
        <HStack justifyContent="center" space="xs" marginTop="$4">
          <Text size="sm" color="$secondary600">
            Already have an account?
          </Text>
          <Link onPress={onLogin}>
            <LinkText size="sm" color="$primary600" fontWeight="medium">
              Sign in
            </LinkText>
          </Link>
        </HStack>
      </VStack>
    </ScrollView>
  );
};