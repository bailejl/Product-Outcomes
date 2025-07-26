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
  Checkbox,
  CheckboxIndicator,
  CheckboxIcon,
  CheckboxLabel,
  FormControl,
  FormControlLabel,
  FormControlLabelText,
  FormControlError,
  FormControlErrorText,
  Spinner,
} from '@gluestack-ui/themed'
import { CheckIcon } from '@gluestack-ui/themed'

interface LoginFormProps {
  onToggleMode?: () => void
  onSuccess?: () => void
}

export function LoginForm({ onToggleMode, onSuccess }: LoginFormProps) {
  const { login, state } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
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
      await login(formData.email, formData.password, formData.rememberMe)
      onSuccess?.()
    } catch (error) {
      console.error('Login failed:', error)
    }
  }

  return (
    <Box w="$full" maxWidth="$96" mx="$auto" testID="login-form">
      <Box bg="$white" shadowColor="$black" shadowOffset={{ width: 0, height: 2 }} shadowOpacity={0.1} shadowRadius={8} borderRadius="$lg" px="$8" py="$6">
        <VStack space="$6">
          <VStack space="$2" alignItems="center">
            <Heading id="login-modal-title" size="2xl" color="$secondary900">Welcome Back</Heading>
            <Text color="$secondary600" textAlign="center">Sign in to your account</Text>
          </VStack>

          {state.isLoading && (
            <Box bg="$primary50" borderColor="$primary200" borderWidth={1} borderRadius="$md" p="$3">
              <HStack space="$2" alignItems="center">
                <Spinner size="small" color="$primary600" />
                <Text size="sm" color="$primary600">Loading...</Text>
              </HStack>
            </Box>
          )}

          {state.error && (
            <Box bg="$error50" borderColor="$error200" borderWidth={1} borderRadius="$md" p="$3">
              <Text size="sm" color="$error600">{state.error}</Text>
            </Box>
          )}

          <VStack space="$4" as="form" onSubmit={handleSubmit}>
            <FormControl isInvalid={!!errors.email}>
              <FormControlLabel>
                <FormControlLabelText color="$secondary700" size="sm" fontWeight="$medium">
                  Email Address
                </FormControlLabelText>
              </FormControlLabel>
              <Input
                variant="outline"
                size="md"
                isDisabled={state.isLoading}
              >
                <InputField
                  type="email"
                  id="email"
                  value={formData.email}
                  onChangeText={(value) => handleChange({ target: { name: 'email', value, type: 'email' } } as any)}
                  placeholder="Enter your email"
                  autoComplete="email"
                  testID="login-email"
                />
              </Input>
              <FormControlError>
                <FormControlErrorText size="sm">
                  {errors.email}
                </FormControlErrorText>
              </FormControlError>
            </FormControl>

            <FormControl isInvalid={!!errors.password}>
              <FormControlLabel>
                <FormControlLabelText color="$secondary700" size="sm" fontWeight="$medium">
                  Password
                </FormControlLabelText>
              </FormControlLabel>
              <Input
                variant="outline"
                size="md"
                isDisabled={state.isLoading}
              >
                <InputField
                  type="password"
                  id="password"
                  value={formData.password}
                  onChangeText={(value) => handleChange({ target: { name: 'password', value, type: 'password' } } as any)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  testID="login-password"
                />
              </Input>
              <FormControlError>
                <FormControlErrorText size="sm">
                  {errors.password}
                </FormControlErrorText>
              </FormControlError>
            </FormControl>

            <HStack justifyContent="space-between" alignItems="center">
              <Checkbox
                value="rememberMe"
                isChecked={formData.rememberMe}
                onChange={(isChecked) => handleChange({ target: { name: 'rememberMe', checked: isChecked, type: 'checkbox' } } as any)}
                testID="login-remember"
              >
                <CheckboxIndicator mr="$2">
                  <CheckboxIcon as={CheckIcon} />
                </CheckboxIndicator>
                <CheckboxLabel>
                  <Text size="sm" color="$secondary700">Remember me</Text>
                </CheckboxLabel>
              </Checkbox>
              
              <Button
                variant="link"
                size="sm"
                onPress={() => {
                  if (onToggleMode) {
                    // Use onToggleMode to switch to forgot password mode
                    onToggleMode()
                  }
                }}
              >
                <ButtonText color="$primary600">Forgot password?</ButtonText>
              </Button>
            </HStack>

            <Button
              variant="solid"
              size="md"
              w="$full"
              isDisabled={state.isLoading}
              onPress={handleSubmit}
              testID="login-submit"
            >
              {state.isLoading ? (
                <HStack space="$2" alignItems="center">
                  <Spinner size="small" color="$white" />
                  <ButtonText>Signing in...</ButtonText>
                </HStack>
              ) : (
                <ButtonText>Sign In</ButtonText>
              )}
            </Button>
          </VStack>

          {onToggleMode && (
            <VStack space="$2" alignItems="center">
              <HStack space="$1" alignItems="center">
                <Text size="sm" color="$secondary600">
                  Don't have an account?
                </Text>
                <Button
                  variant="link"
                  size="sm"
                  onPress={onToggleMode}
                  testID="toggle-register"
                >
                  <ButtonText color="$primary600" fontWeight="$medium">Sign up here</ButtonText>
                </Button>
              </HStack>
            </VStack>
          )}
        </VStack>
      </Box>
    </Box>
  )
}
