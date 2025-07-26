import React, { Component, ErrorInfo, ReactNode } from 'react'
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  ButtonText,
  Icon,
  AlertTriangle,
  Heading,
  ScrollView,
  Pressable,
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  SafeAreaView,
} from '@gluestack-ui/themed'
import * as Sentry from '@sentry/react-native'

interface Props {
  children: ReactNode
  fallback?: React.ComponentType<ErrorBoundaryState>
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showErrorDetails?: boolean
  resetOnPropsChange?: boolean
  resetKeys?: Array<string | number>
  level?: 'screen' | 'component' | 'critical'
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  eventId: string | null
  retryCount: number
  showDetails: boolean
}

const DEFAULT_RETRY_LIMIT = 3

export class ErrorBoundary extends Component<Props, ErrorBoundaryState> {
  private resetTimeoutId: NodeJS.Timeout | null = null

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
      retryCount: 0,
      showDetails: false,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // Capture error with Sentry
    const eventId = Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
      tags: {
        errorBoundary: true,
        level: this.props.level || 'component',
        platform: 'react-native',
      },
      extra: {
        errorInfo,
        retryCount: this.state.retryCount,
        props: this.props.resetKeys,
      },
    })

    this.setState({
      errorInfo,
      eventId,
    })

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetOnPropsChange, resetKeys } = this.props
    const { hasError } = this.state

    if (hasError && resetOnPropsChange) {
      const hasResetKeyChanged = resetKeys?.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      )

      if (hasResetKeyChanged) {
        this.resetErrorBoundary()
      }
    }
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
      showDetails: false,
    })
  }

  retryWithBackoff = () => {
    const { retryCount } = this.state
    
    if (retryCount < DEFAULT_RETRY_LIMIT) {
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, retryCount) * 1000
      
      this.resetTimeoutId = setTimeout(() => {
        this.setState(prevState => ({
          hasError: false,
          error: null,
          errorInfo: null,
          eventId: null,
          retryCount: prevState.retryCount + 1,
          showDetails: false,
        }))
      }, delay)
    }
  }

  toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails,
    }))
  }

  render() {
    if (this.state.hasError) {
      const { fallback: Fallback } = this.props

      if (Fallback) {
        return <Fallback {...this.state} />
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          eventId={this.state.eventId}
          retryCount={this.state.retryCount}
          level={this.props.level}
          showErrorDetails={this.props.showErrorDetails}
          onRetry={this.retryWithBackoff}
          onReset={this.resetErrorBoundary}
          onToggleDetails={this.toggleDetails}
          showDetails={this.state.showDetails}
        />
      )
    }

    return this.props.children
  }
}

// Default error fallback component
interface ErrorFallbackProps {
  error: Error | null
  errorInfo: ErrorInfo | null
  eventId: string | null
  retryCount: number
  level?: string
  showErrorDetails?: boolean
  showDetails: boolean
  onRetry: () => void
  onReset: () => void
  onToggleDetails: () => void
}

function ErrorFallback({
  error,
  errorInfo,
  eventId,
  retryCount,
  level,
  showErrorDetails,
  showDetails,
  onRetry,
  onReset,
  onToggleDetails,
}: ErrorFallbackProps) {
  const canRetry = retryCount < DEFAULT_RETRY_LIMIT
  const isCritical = level === 'critical'
  const isScreen = level === 'screen'

  if (isCritical || isScreen) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <Box flex={1} bg="$backgroundLight50" justifyContent="center" alignItems="center" p="$6">
          <VStack space="lg" alignItems="center" maxWidth="$80">
            <Icon as={AlertTriangle} size="xl" color="$error500" />
            
            <VStack space="sm" alignItems="center">
              <Heading size="lg" textAlign="center" color="$textLight900">
                {isCritical ? 'Application Error' : 'Something went wrong'}
              </Heading>
              <Text size="sm" textAlign="center" color="$textLight600">
                {isCritical
                  ? "We're sorry, but something went wrong. Please restart the app or contact support if the problem persists."
                  : "We've been notified and are working to fix this."
                }
              </Text>
            </VStack>

            {eventId && (
              <Text size="xs" color="$textLight500">
                Error ID: {eventId}
              </Text>
            )}

            <VStack space="md" width="$full">
              {canRetry && (
                <Button action="primary" onPress={onRetry}>
                  <ButtonText>
                    Retry {retryCount > 0 && `(${DEFAULT_RETRY_LIMIT - retryCount} left)`}
                  </ButtonText>
                </Button>
              )}
              
              <Button variant="outline" action="secondary" onPress={onReset}>
                <ButtonText>Dismiss</ButtonText>
              </Button>

              {showErrorDetails && (
                <Button variant="link" size="sm" onPress={onToggleDetails}>
                  <ButtonText>
                    {showDetails ? 'Hide' : 'Show'} Error Details
                  </ButtonText>
                </Button>
              )}
            </VStack>
          </VStack>

          <Modal isOpen={showDetails} onClose={onToggleDetails}>
            <ModalBackdrop />
            <ModalContent>
              <ModalHeader>
                <Heading size="md">Error Details</Heading>
                <ModalCloseButton />
              </ModalHeader>
              <ModalBody>
                <ScrollView>
                  <VStack space="md">
                    <VStack space="sm">
                      <Text size="sm" fontWeight="$semibold">Error Message:</Text>
                      <Text size="xs" fontFamily="$mono" color="$error600">
                        {error?.message}
                      </Text>
                    </VStack>
                    
                    {errorInfo?.componentStack && (
                      <VStack space="sm">
                        <Text size="sm" fontWeight="$semibold">Component Stack:</Text>
                        <ScrollView horizontal>
                          <Text size="xs" fontFamily="$mono" color="$textLight600">
                            {errorInfo.componentStack}
                          </Text>
                        </ScrollView>
                      </VStack>
                    )}
                  </VStack>
                </ScrollView>
              </ModalBody>
            </ModalContent>
          </Modal>
        </Box>
      </SafeAreaView>
    )
  }

  return (
    <Box bg="$error50" borderColor="$error200" borderWidth="$1" borderRadius="$lg" p="$4" m="$2">
      <HStack space="md" alignItems="flex-start">
        <Icon as={AlertTriangle} size="sm" color="$error500" mt="$1" />
        
        <VStack space="sm" flex={1}>
          <Text size="sm" fontWeight="$semibold" color="$error800">
            Something went wrong
          </Text>
          <Text size="xs" color="$error700">
            We've been notified of this error and are working to fix it.
          </Text>
          
          <HStack space="sm" flexWrap="wrap">
            {canRetry && (
              <Button size="xs" variant="outline" action="secondary" onPress={onRetry}>
                <ButtonText size="xs">
                  Retry {retryCount > 0 && `(${DEFAULT_RETRY_LIMIT - retryCount})`}
                </ButtonText>
              </Button>
            )}
            
            <Button size="xs" variant="outline" action="secondary" onPress={onReset}>
              <ButtonText size="xs">Dismiss</ButtonText>
            </Button>
            
            {showErrorDetails && (
              <Pressable onPress={onToggleDetails}>
                <Text size="xs" color="$primary600" textDecorationLine="underline">
                  {showDetails ? 'Hide' : 'Show'} Details
                </Text>
              </Pressable>
            )}
          </HStack>

          {showDetails && showErrorDetails && (
            <VStack space="sm" mt="$2">
              <Text size="xs" fontWeight="$semibold" color="$error800">
                Error Details:
              </Text>
              <ScrollView horizontal>
                <Text size="xs" fontFamily="$mono" color="$error600">
                  {error?.message}
                </Text>
              </ScrollView>
            </VStack>
          )}
        </VStack>
      </HStack>
    </Box>
  )
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

// Specialized error boundaries for different contexts
export const ScreenErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary level="screen" resetOnPropsChange>
    {children}
  </ErrorBoundary>
)

export const ComponentErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary level="component" showErrorDetails={__DEV__}>
    {children}
  </ErrorBoundary>
)

export const CriticalErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary level="critical">
    {children}
  </ErrorBoundary>
)