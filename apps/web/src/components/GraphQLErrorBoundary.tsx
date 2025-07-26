/**
 * GraphQL Error Boundary
 * Handles GraphQL errors and provides user-friendly error messages
 */

import React, { Component, ReactNode, ErrorInfo } from 'react'
import { ApolloError } from '@apollo/client'
import { Box, Text, Button, VStack, HStack, Icon } from '@gluestack-ui/themed'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class GraphQLErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    })

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Log error details
    console.error('GraphQL Error Boundary caught an error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <Box
          p="$6"
          bg="$red50"
          borderColor="$red200"
          borderWidth="$1"
          borderRadius="$lg"
          m="$4"
        >
          <VStack space="md">
            <HStack space="sm" alignItems="center">
              <Icon
                as={() => <span>⚠️</span>}
                size="lg"
                color="$red600"
              />
              <Text fontSize="$lg" fontWeight="$semibold" color="$red800">
                Something went wrong
              </Text>
            </HStack>

            <Text color="$red700" fontSize="$sm">
              {this.getErrorMessage()}
            </Text>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box
                bg="$red100"
                p="$3"
                borderRadius="$md"
                borderColor="$red300"
                borderWidth="$1"
              >
                <Text fontSize="$xs" fontFamily="$mono" color="$red800">
                  {this.state.error.toString()}
                </Text>
                {this.state.errorInfo?.componentStack && (
                  <Text fontSize="$xs" fontFamily="$mono" color="$red600" mt="$2">
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </Box>
            )}

            <HStack space="sm">
              <Button
                variant="outline"
                action="secondary"
                size="sm"
                onPress={this.handleRetry}
              >
                <Text>Try Again</Text>
              </Button>
              <Button
                action="negative"
                size="sm"
                onPress={this.handleReload}
              >
                <Text>Reload Page</Text>
              </Button>
            </HStack>
          </VStack>
        </Box>
      )
    }

    return this.props.children
  }

  private getErrorMessage(): string {
    const { error } = this.state

    if (!error) {
      return 'An unexpected error occurred.'
    }

    // Handle Apollo/GraphQL errors
    if (error instanceof ApolloError) {
      if (error.networkError) {
        return 'Network error: Please check your internet connection and try again.'
      }

      if (error.graphQLErrors?.length > 0) {
        const graphQLError = error.graphQLErrors[0]
        
        switch (graphQLError.extensions?.code) {
          case 'UNAUTHENTICATED':
            return 'Your session has expired. Please log in again.'
          case 'FORBIDDEN':
            return 'You do not have permission to perform this action.'
          case 'VALIDATION_ERROR':
            return `Validation error: ${graphQLError.message}`
          case 'INTERNAL_SERVER_ERROR':
            return 'A server error occurred. Please try again later.'
          default:
            return graphQLError.message || 'A GraphQL error occurred.'
        }
      }

      return error.message || 'A GraphQL error occurred.'
    }

    // Handle other errors
    if (error.message.includes('Network')) {
      return 'Network error: Please check your internet connection.'
    }

    if (error.message.includes('fetch')) {
      return 'Failed to fetch data. Please try again.'
    }

    return error.message || 'An unexpected error occurred.'
  }
}

// Higher-order component for wrapping components with error boundary
export function withGraphQLErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <GraphQLErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </GraphQLErrorBoundary>
  )

  WrappedComponent.displayName = `withGraphQLErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}

// Hook for error boundary context
export function useErrorBoundary() {
  return {
    captureError: (error: Error, errorInfo?: ErrorInfo) => {
      // This will be caught by the nearest error boundary
      throw error
    },
  }
}

// Custom error classes for specific error types
export class GraphQLNetworkError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message)
    this.name = 'GraphQLNetworkError'
  }
}

export class GraphQLAuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message)
    this.name = 'GraphQLAuthenticationError'
  }
}

export class GraphQLAuthorizationError extends Error {
  constructor(message: string = 'Access denied') {
    super(message)
    this.name = 'GraphQLAuthorizationError'
  }
}

export class GraphQLValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'GraphQLValidationError'
  }
}