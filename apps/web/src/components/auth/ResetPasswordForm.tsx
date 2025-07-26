import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
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

interface ResetPasswordFormProps {
  token?: string
  onSuccess?: () => void
  onBackToLogin?: () => void
}

interface ApiResponse {
  message: string
  error?: string
  valid?: boolean
}

export function ResetPasswordForm({ token: propToken, onSuccess, onBackToLogin }: ResetPasswordFormProps) {
  const [searchParams] = useSearchParams()
  const token = propToken || searchParams.get('token') || ''

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [tokenValid, setTokenValid] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Verify token on component mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError('No reset token provided')
        setIsVerifying(false)
        return
      }

      try {
        const response = await fetch(`/api/auth/reset-password/${token}`)
        const data: ApiResponse = await response.json()

        if (response.ok && data.valid) {
          setTokenValid(true)
        } else {
          setError(data.message || 'Invalid or expired reset token')
        }
      } catch (err) {
        console.error('Token verification failed:', err)
        setError('Failed to verify reset token')
      } finally {
        setIsVerifying(false)
      }
    }

    verifyToken()
  }, [token])

  const handleChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
    if (error) {
      setError('')
    }
  }

  const validatePassword = (password: string) => {
    const errors = []
    
    if (password.length < 8) {
      errors.push('be at least 8 characters long')
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('contain at least one uppercase letter')
    }
    if (!/[a-z]/.test(password)) {
      errors.push('contain at least one lowercase letter')
    }
    if (!/\d/.test(password)) {
      errors.push('contain at least one number')
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('contain at least one special character')
    }

    return errors
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required'
    } else {
      const passwordErrors = validatePassword(formData.newPassword)
      if (passwordErrors.length > 0) {
        newErrors.newPassword = `Password must ${passwordErrors.join(', ')}`
      }
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.newPassword !== formData.confirmPassword) {
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

    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: formData.newPassword,
        }),
      })

      const data: ApiResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password')
      }

      setSuccess(data.message)
      onSuccess?.()
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        onBackToLogin?.()
      }, 2000)
    } catch (err) {
      console.error('Password reset failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setIsLoading(false)
    }
  }

  if (isVerifying) {
    return (
      <Box w="$full" maxWidth="$96" mx="$auto" testID="reset-password-verifying">
        <Box bg="$white" shadowColor="$black" shadowOffset={{ width: 0, height: 2 }} shadowOpacity={0.1} shadowRadius={8} borderRadius="$lg" px="$8" py="$6">
          <VStack space="$6" alignItems="center">
            <Spinner size="large" color="$primary600" />
            <VStack space="$2" alignItems="center">
              <Heading size="xl" color="$secondary900">Verifying Reset Token</Heading>
              <Text color="$secondary600" textAlign="center">
                Please wait while we verify your password reset link...
              </Text>
            </VStack>
          </VStack>
        </Box>
      </Box>
    )
  }

  if (!tokenValid) {
    return (
      <Box w="$full" maxWidth="$96" mx="$auto" testID="reset-password-invalid">
        <Box bg="$white" shadowColor="$black" shadowOffset={{ width: 0, height: 2 }} shadowOpacity={0.1} shadowRadius={8} borderRadius="$lg" px="$8" py="$6">
          <VStack space="$6" alignItems="center">
            <VStack space="$2" alignItems="center">
              <Heading size="xl" color="$error600">Invalid Reset Link</Heading>
              <Text color="$secondary600" textAlign="center">
                This password reset link is invalid or has expired.
              </Text>
            </VStack>

            {error && (
              <Box bg="$error50" borderColor="$error200" borderWidth={1} borderRadius="$md" p="$3" w="$full">
                <Text size="sm" color="$error600" textAlign="center">{error}</Text>
              </Box>
            )}

            <VStack space="$3" w="$full">
              <Button
                variant="solid"
                size="md"
                w="$full"
                onPress={onBackToLogin}
                testID="invalid-back-to-login"
              >
                <ButtonText>Back to Sign In</ButtonText>
              </Button>
              
              <Text size="sm" color="$secondary600" textAlign="center">
                Need a new reset link? Try requesting password reset again.
              </Text>
            </VStack>
          </VStack>
        </Box>
      </Box>
    )
  }

  return (
    <Box w="$full" maxWidth="$96" mx="$auto" testID="reset-password-form">
      <Box bg="$white" shadowColor="$black" shadowOffset={{ width: 0, height: 2 }} shadowOpacity={0.1} shadowRadius={8} borderRadius="$lg" px="$8" py="$6">
        <VStack space="$6">
          <VStack space="$2" alignItems="center">
            <Heading size="2xl" color="$secondary900">Reset Your Password</Heading>
            <Text color="$secondary600" textAlign="center">
              Enter your new password below. Make sure it's secure and easy to remember.
            </Text>
          </VStack>

          {isLoading && (
            <Box bg="$primary50" borderColor="$primary200" borderWidth={1} borderRadius="$md" p="$3">
              <HStack space="$2" alignItems="center">
                <Spinner size="small" color="$primary600" />
                <Text size="sm" color="$primary600">Resetting password...</Text>
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
                  ✅ Password reset successful!
                </Text>
                <Text size="sm" color="$success600">
                  {success}
                </Text>
                <Text size="xs" color="$success600">
                  Redirecting to sign in page...
                </Text>
              </VStack>
            </Box>
          )}

          <VStack space="$4" as="form" onSubmit={handleSubmit}>
            <FormControl isInvalid={!!errors.newPassword}>
              <FormControlLabel>
                <FormControlLabelText color="$secondary700" size="sm" fontWeight="$medium">
                  New Password
                </FormControlLabelText>
              </FormControlLabel>
              <Input
                variant="outline"
                size="md"
                isDisabled={isLoading}
              >
                <InputField
                  type="password"
                  id="new-password"
                  value={formData.newPassword}
                  onChangeText={(value) => handleChange('newPassword', value)}
                  placeholder="Enter your new password"
                  autoComplete="new-password"
                  testID="reset-new-password"
                />
              </Input>
              <FormControlError>
                <FormControlErrorText size="sm">
                  {errors.newPassword}
                </FormControlErrorText>
              </FormControlError>
            </FormControl>

            <FormControl isInvalid={!!errors.confirmPassword}>
              <FormControlLabel>
                <FormControlLabelText color="$secondary700" size="sm" fontWeight="$medium">
                  Confirm New Password
                </FormControlLabelText>
              </FormControlLabel>
              <Input
                variant="outline"
                size="md"
                isDisabled={isLoading}
              >
                <InputField
                  type="password"
                  id="confirm-password"
                  value={formData.confirmPassword}
                  onChangeText={(value) => handleChange('confirmPassword', value)}
                  placeholder="Confirm your new password"
                  autoComplete="new-password"
                  testID="reset-confirm-password"
                />
              </Input>
              <FormControlError>
                <FormControlErrorText size="sm">
                  {errors.confirmPassword}
                </FormControlErrorText>
              </FormControlError>
            </FormControl>

            <Box bg="$secondary50" borderRadius="$md" p="$3">
              <Text size="xs" color="$secondary600" fontWeight="$medium" mb="$1">
                Password Requirements:
              </Text>
              <VStack space="$1">
                <Text size="xs" color="$secondary600">• At least 8 characters long</Text>
                <Text size="xs" color="$secondary600">• At least one uppercase letter</Text>
                <Text size="xs" color="$secondary600">• At least one lowercase letter</Text>
                <Text size="xs" color="$secondary600">• At least one number</Text>
                <Text size="xs" color="$secondary600">• At least one special character</Text>
              </VStack>
            </Box>

            <Button
              variant="solid"
              size="md"
              w="$full"
              isDisabled={isLoading}
              onPress={handleSubmit}
              testID="reset-password-submit"
            >
              {isLoading ? (
                <HStack space="$2" alignItems="center">
                  <Spinner size="small" color="$white" />
                  <ButtonText>Resetting...</ButtonText>
                </HStack>
              ) : (
                <ButtonText>Reset Password</ButtonText>
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
                  testID="reset-back-to-login"
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