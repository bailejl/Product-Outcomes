import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Button,
  ButtonText,
  Input,
  InputField,
  FormControl,
  FormControlLabel,
  FormControlLabelText,
  FormControlError,
  FormControlErrorText,
  Spinner,
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
} from '@gluestack-ui/themed'
import { ChevronDownIcon } from '@gluestack-ui/themed'

interface RegisterFormProps {
  onToggleMode?: () => void
  onSuccess?: () => void
}

export function RegisterForm({ onToggleMode, onSuccess }: RegisterFormProps) {
  const { register, state } = useAuth()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user' as 'admin' | 'user' | 'moderator',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement> | { target: { name: string; value: string } }) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleSelectChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      role: value as 'admin' | 'user' | 'moderator',
    }))

    // Clear error when user makes a selection
    if (errors.role) {
      setErrors(prev => ({ ...prev, role: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    }

    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long'
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password =
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      await register({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email,
        password: formData.password,
        role: formData.role,
      })
      onSuccess?.()
    } catch (error) {
      console.error('Registration failed:', error)
    }
  }

  return (
    <Box w="$full" maxWidth="$96" mx="$auto" testID="register-form">
      <Box bg="$white" shadowColor="$black" shadowOffset={{ width: 0, height: 2 }} shadowOpacity={0.1} shadowRadius={8} borderRadius="$lg" px="$8" py="$6">
        <VStack space="$6">
          <VStack space="$2" alignItems="center">
            <Heading id="register-modal-title" size="2xl" color="$secondary900">Create Account</Heading>
            <Text color="$secondary600" textAlign="center">Sign up for a new account</Text>
          </VStack>

          {state.error && (
            <Box bg="$error50" borderColor="$error200" borderWidth={1} borderRadius="$md" p="$3">
              <Text size="sm" color="$error600">{state.error}</Text>
            </Box>
          )}

          <VStack space="$4" as="form" onSubmit={handleSubmit}>
            <HStack space="$4">
              <FormControl flex={1} isInvalid={!!errors.firstName}>
                <FormControlLabel>
                  <FormControlLabelText color="$secondary700" size="sm" fontWeight="$medium">
                    First Name
                  </FormControlLabelText>
                </FormControlLabel>
                <Input variant="outline" size="md">
                  <InputField
                    type="text"
                    id="firstName"
                    value={formData.firstName}
                    onChangeText={(value) => handleChange({ target: { name: 'firstName', value } } as any)}
                    placeholder="First name"
                    autoComplete="given-name"
                    testID="register-firstName"
                  />
                </Input>
                <FormControlError>
                  <FormControlErrorText size="sm">
                    {errors.firstName}
                  </FormControlErrorText>
                </FormControlError>
              </FormControl>

              <FormControl flex={1} isInvalid={!!errors.lastName}>
                <FormControlLabel>
                  <FormControlLabelText color="$secondary700" size="sm" fontWeight="$medium">
                    Last Name
                  </FormControlLabelText>
                </FormControlLabel>
                <Input variant="outline" size="md">
                  <InputField
                    type="text"
                    id="lastName"
                    value={formData.lastName}
                    onChangeText={(value) => handleChange({ target: { name: 'lastName', value } } as any)}
                    placeholder="Last name"
                    autoComplete="family-name"
                    testID="register-lastName"
                  />
                </Input>
                <FormControlError>
                  <FormControlErrorText size="sm">
                    {errors.lastName}
                  </FormControlErrorText>
                </FormControlError>
              </FormControl>
            </HStack>

            <FormControl isInvalid={!!errors.email}>
              <FormControlLabel>
                <FormControlLabelText color="$secondary700" size="sm" fontWeight="$medium">
                  Email Address
                </FormControlLabelText>
              </FormControlLabel>
              <Input variant="outline" size="md">
                <InputField
                  type="email"
                  id="email"
                  value={formData.email}
                  onChangeText={(value) => handleChange({ target: { name: 'email', value } } as any)}
                  placeholder="Enter your email"
                  autoComplete="email"
                  testID="register-email"
                />
              </Input>
              <FormControlError>
                <FormControlErrorText size="sm">
                  {errors.email}
                </FormControlErrorText>
              </FormControlError>
            </FormControl>

            <FormControl isInvalid={!!errors.role}>
              <FormControlLabel>
                <FormControlLabelText color="$secondary700" size="sm" fontWeight="$medium">
                  Account Type
                </FormControlLabelText>
              </FormControlLabel>
              <Select selectedValue={formData.role} onValueChange={handleSelectChange}>
                <SelectTrigger variant="outline" size="md">
                  <SelectInput placeholder="Select your role" />
                  <SelectIcon mr="$3">
                    <ChevronDownIcon />
                  </SelectIcon>
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    <SelectItem label="User" value="user" />
                    <SelectItem label="Moderator" value="moderator" />
                    <SelectItem label="Administrator" value="admin" />
                  </SelectContent>
                </SelectPortal>
              </Select>
              <FormControlError>
                <FormControlErrorText size="sm">
                  {errors.role}
                </FormControlErrorText>
              </FormControlError>
            </FormControl>

            <FormControl isInvalid={!!errors.password}>
              <FormControlLabel>
                <FormControlLabelText color="$secondary700" size="sm" fontWeight="$medium">
                  Password
                </FormControlLabelText>
              </FormControlLabel>
              <Input variant="outline" size="md">
                <InputField
                  type="password"
                  id="password"
                  value={formData.password}
                  onChangeText={(value) => handleChange({ target: { name: 'password', value } } as any)}
                  placeholder="Create a password"
                  autoComplete="new-password"
                  testID="register-password"
                />
              </Input>
              <FormControlError>
                <FormControlErrorText size="sm">
                  {errors.password}
                </FormControlErrorText>
              </FormControlError>
              <Text size="xs" color="$secondary500" mt="$1">
                Must be at least 8 characters with uppercase, lowercase, and numbers
              </Text>
            </FormControl>

            <FormControl isInvalid={!!errors.confirmPassword}>
              <FormControlLabel>
                <FormControlLabelText color="$secondary700" size="sm" fontWeight="$medium">
                  Confirm Password
                </FormControlLabelText>
              </FormControlLabel>
              <Input variant="outline" size="md">
                <InputField
                  type="password"
                  id="confirmPassword"
                  value={formData.confirmPassword}
                  onChangeText={(value) => handleChange({ target: { name: 'confirmPassword', value } } as any)}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  testID="register-confirmPassword"
                />
              </Input>
              <FormControlError>
                <FormControlErrorText size="sm">
                  {errors.confirmPassword}
                </FormControlErrorText>
              </FormControlError>
            </FormControl>

            <Button
              variant="solid"
              size="md"
              w="$full"
              isDisabled={state.isLoading}
              onPress={handleSubmit}
              testID="register-submit"
            >
              {state.isLoading ? (
                <HStack space="$2" alignItems="center">
                  <Spinner size="small" color="$white" />
                  <ButtonText>Creating account...</ButtonText>
                </HStack>
              ) : (
                <ButtonText>Create Account</ButtonText>
              )}
            </Button>
          </VStack>

          {onToggleMode && (
            <VStack space="$2" alignItems="center">
              <HStack space="$1" alignItems="center">
                <Text size="sm" color="$secondary600">
                  Already have an account?
                </Text>
                <Button
                  variant="link"
                  size="sm"
                  onPress={onToggleMode}
                  testID="toggle-login"
                >
                  <ButtonText color="$primary600" fontWeight="$medium">Sign in here</ButtonText>
                </Button>
              </HStack>
            </VStack>
          )}
        </VStack>
      </Box>
    </Box>
  )
}
