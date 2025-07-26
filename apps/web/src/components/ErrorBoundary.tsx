import React, { Component, ErrorInfo, ReactNode } from 'react'
import * as Sentry from '@sentry/react'
import { Toast } from './ui/Toast'

interface Props {
  children: ReactNode
  fallback?: React.ComponentType<ErrorBoundaryState>
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showErrorDetails?: boolean
  resetOnPropsChange?: boolean
  resetKeys?: Array<string | number>
  level?: 'page' | 'component' | 'critical'
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  eventId: string | null
  retryCount: number
}

const DEFAULT_RETRY_LIMIT = 3

export class ErrorBoundary extends Component<Props, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
      retryCount: 0,
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

    // Show toast notification for non-critical errors
    if (this.props.level !== 'critical') {
      Toast.show({
        type: 'error',
        title: 'Something went wrong',
        message: 'We\'ve been notified and are working to fix this.',
        duration: 5000,
      })
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
    })
  }

  retryWithBackoff = () => {
    const { retryCount } = this.state
    
    if (retryCount < DEFAULT_RETRY_LIMIT) {
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, retryCount) * 1000
      
      this.resetTimeoutId = window.setTimeout(() => {
        this.setState(prevState => ({
          hasError: false,
          error: null,
          errorInfo: null,
          eventId: null,
          retryCount: prevState.retryCount + 1,
        }))
      }, delay)
    }
  }

  reportError = () => {
    if (this.state.eventId) {
      Sentry.showReportDialog({ eventId: this.state.eventId })
    }
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
          onReport={this.reportError}
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
  onRetry: () => void
  onReset: () => void
  onReport: () => void
}

function ErrorFallback({
  error,
  errorInfo,
  eventId,
  retryCount,
  level,
  showErrorDetails,
  onRetry,
  onReset,
  onReport,
}: ErrorFallbackProps) {
  const canRetry = retryCount < DEFAULT_RETRY_LIMIT
  const isCritical = level === 'critical'

  if (isCritical) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0">
              <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-gray-900">
                Application Error
              </h3>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            We're sorry, but something went wrong. Please try refreshing the page or contact support if the problem persists.
          </p>

          {eventId && (
            <p className="text-xs text-gray-500 mb-4">
              Error ID: {eventId}
            </p>
          )}

          <div className="flex space-x-3">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Refresh Page
            </button>
            <button
              onClick={onReport}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Report Issue
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            Something went wrong
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p>We've been notified of this error and are working to fix it.</p>
            {showErrorDetails && error && (
              <details className="mt-2">
                <summary className="cursor-pointer font-medium">Error details</summary>
                <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto">
                  {error.message}
                  {errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
          <div className="mt-4 flex space-x-2">
            {canRetry && (
              <button
                onClick={onRetry}
                className="bg-red-100 text-red-800 px-3 py-1 rounded text-sm hover:bg-red-200 transition-colors"
              >
                Retry {retryCount > 0 && `(${DEFAULT_RETRY_LIMIT - retryCount} attempts left)`}
              </button>
            )}
            <button
              onClick={onReset}
              className="bg-red-100 text-red-800 px-3 py-1 rounded text-sm hover:bg-red-200 transition-colors"
            >
              Dismiss
            </button>
            {eventId && (
              <button
                onClick={onReport}
                className="bg-red-100 text-red-800 px-3 py-1 rounded text-sm hover:bg-red-200 transition-colors"
              >
                Report
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
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
export const PageErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary level="page" resetOnPropsChange>
    {children}
  </ErrorBoundary>
)

export const ComponentErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary level="component" showErrorDetails={process.env.NODE_ENV === 'development'}>
    {children}
  </ErrorBoundary>
)

export const CriticalErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary level="critical">
    {children}
  </ErrorBoundary>
)