import React, { useState } from 'react'
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
} from '@gluestack-ui/themed'

interface ForgotPasswordFormProps {
  onSuccess?: () => void
  onBackToLogin?: () => void
}

interface ApiResponse {
  message: string
  error?: string
}

export function ForgotPasswordForm({ onSuccess, onBackToLogin }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [emailError, setEmailError] = useState('')

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleEmailChange = (value: string) => {
    setEmail(value)
    // Clear error when user starts typing
    if (emailError) {
      setEmailError('')
    }
    if (error) {
      setError('')
    }
  }

  const validateForm = () => {
    let isValid = true

    if (!email) {
      setEmailError('Email is required')
      isValid = false
    } else if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address')
      isValid = false
    }

    return isValid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data: ApiResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send reset email')
      }

      setSuccess(data.message)
      onSuccess?.()
    } catch (err) {
      console.error('Password reset request failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Box w="$full" maxWidth="$96" mx="$auto" testID="forgot-password-form">
      <Box bg="$white" shadowColor="$black" shadowOffset={{ width: 0, height: 2 }} shadowOpacity={0.1} shadowRadius={8} borderRadius="$lg" px="$8" py="$6">
        <VStack space="$6">
          <VStack space="$2" alignItems="center">
            <Heading size="2xl" color="$secondary900">Forgot Password?</Heading>
            <Text color="$secondary600" textAlign="center">
              No worries! Enter your email address and we'll send you a link to reset your password.
            </Text>
          </VStack>

          {isLoading && (
            <Box bg="$primary50" borderColor="$primary200" borderWidth={1} borderRadius="$md" p="$3">
              <HStack space="$2" alignItems="center">
                <Spinner size="small" color="$primary600" />
                <Text size="sm" color="$primary600">Sending reset email...</Text>
              </HStack>
            </Box>
          )}

          {error && (
            <Box bg="$error50" borderColor="$error200" borderWidth={1} borderRadius="$md" p="$3">
              <Text size="sm" color="$error600">{error}</Text>
            </Box>
          )}

          {success && (
            <Box bg="$success50" borderColor="$success200" borderWidth={1} borderRadius="$md" p="$3">
              <VStack space="$2">
                <Text size="sm" color="$success600" fontWeight="$medium">
                  ✅ Email sent successfully!
                </Text>
                <Text size="sm" color="$success600">
                  {success}
                </Text>
                <Text size="xs" color="$success600">
                  Check your email and click the reset link to continue. The link will expire in 24 hours.
                </Text>
              </VStack>
            </Box>
          )}

          <VStack space="$4" as="form" onSubmit={handleSubmit}>
            <FormControl isInvalid={!!emailError}>
              <FormControlLabel>
                <FormControlLabelText color="$secondary700" size="sm" fontWeight="$medium">
                  Email Address
                </FormControlLabelText>
              </FormControlLabel>
              <Input
                variant="outline"
                size="md"
                isDisabled={isLoading}
              >
                <InputField
                  type="email"
                  id="reset-email"
                  value={email}
                  onChangeText={handleEmailChange}
                  placeholder="Enter your email address"
                  autoComplete="email"
                  testID="forgot-password-email"
                />
              </Input>
              <FormControlError>
                <FormControlErrorText size="sm">
                  {emailError}
                </FormControlErrorText>
              </FormControlError>
            </FormControl>

            <Button
              variant="solid"
              size="md"
              w="$full"
              isDisabled={isLoading}
              onPress={handleSubmit}
              testID="forgot-password-submit"
            >
              {isLoading ? (
                <HStack space="$2" alignItems="center">
                  <Spinner size="small" color="$white" />
                  <ButtonText>Sending...</ButtonText>
                </HStack>
              ) : (
                <ButtonText>Send Reset Link</ButtonText>
              )}
            </Button>
          </VStack>

          {onBackToLogin && (
            <VStack space="$2" alignItems="center">
              <HStack space="$1" alignItems="center">
                <Text size="sm" color="$secondary600">
                  Remember your password?
                </Text>
                <Button
                  variant="link"
                  size="sm"
                  onPress={onBackToLogin}
                  testID="back-to-login"
                >
                  <ButtonText color="$primary600" fontWeight="$medium">Back to Sign In</ButtonText>
                </Button>
              </HStack>
            </VStack>
          )}
        </VStack>
      </Box>
    </Box>
  )
}