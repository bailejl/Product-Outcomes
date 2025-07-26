import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'
import { logger } from './logger'

export interface SentryConfig {
  dsn?: string
  environment: string
  release?: string
  sampleRate: number
  profilesSampleRate: number
  tracesSampleRate: number
  attachStacktrace: boolean
  sendDefaultPii: boolean
  beforeSend?: (event: Sentry.Event) => Sentry.Event | null
}

export function initializeSentry(config?: Partial<SentryConfig>) {
  const sentryConfig: SentryConfig = {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || '1.0.0',
    sampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || '1.0'),
    profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    attachStacktrace: true,
    sendDefaultPii: false,
    beforeSend: (event) => {
      // Filter out development errors in production
      if (config?.environment === 'production' && event.exception) {
        const error = event.exception.values?.[0]
        if (error?.type === 'TypeError' && error.value?.includes('Cannot read property')) {
          return null // Skip common TypeError in production
        }
      }
      
      // Log error to Winston as well
      logger.error('Sentry error captured', {
        sentryEventId: event.event_id,
        level: event.level,
        exception: event.exception,
        message: event.message,
        user: event.user,
        tags: event.tags,
        extra: event.extra,
      })
      
      return event
    },
    ...config,
  }

  if (!sentryConfig.dsn) {
    logger.warn('Sentry DSN not provided, error tracking disabled')
    return
  }

  try {
    Sentry.init({
      dsn: sentryConfig.dsn,
      environment: sentryConfig.environment,
      release: sentryConfig.release,
      sampleRate: sentryConfig.sampleRate,
      profilesSampleRate: sentryConfig.profilesSampleRate,
      tracesSampleRate: sentryConfig.tracesSampleRate,
      attachStacktrace: sentryConfig.attachStacktrace,
      sendDefaultPii: sentryConfig.sendDefaultPii,
      beforeSend: sentryConfig.beforeSend,
      integrations: [
        // Enable profiling
        nodeProfilingIntegration(),
        // HTTP integration for tracing
        new Sentry.Integrations.Http({ tracing: true }),
        // Express integration
        new Sentry.Integrations.Express({ app: undefined }),
        // GraphQL integration (custom)
        new GraphQLIntegration(),
      ],
      beforeSendTransaction: (event) => {
        // Filter out health check transactions
        if (event.transaction?.includes('/api/health')) {
          return null
        }
        return event
      },
    })

    logger.info('Sentry initialized successfully', {
      environment: sentryConfig.environment,
      release: sentryConfig.release,
      sampleRate: sentryConfig.sampleRate,
    })
  } catch (error) {
    logger.error('Failed to initialize Sentry', error)
  }
}

// Custom GraphQL integration for Sentry
class GraphQLIntegration implements Sentry.Integration {
  public static id = 'GraphQL'
  public name = GraphQLIntegration.id

  setupOnce(addGlobalEventProcessor: (callback: Sentry.EventProcessor) => void) {
    addGlobalEventProcessor((event) => {
      // Add GraphQL context to errors
      if (event.exception && event.contexts?.graphql) {
        event.tags = {
          ...event.tags,
          graphql_operation: event.contexts.graphql.operationName || 'unknown',
          graphql_type: event.contexts.graphql.operationType || 'unknown',
        }
      }
      return event
    })
  }
}

// Express middleware for request context
export function sentryRequestHandler() {
  return Sentry.Handlers.requestHandler({
    user: ['id', 'email'],
    request: ['method', 'url', 'headers', 'data'],
    transaction: 'methodPath',
  })
}

// Express middleware for error handling
export function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Only send errors with status >= 500 to Sentry
      return error.status && error.status >= 500
    },
  })
}

// GraphQL error formatting with Sentry
export function formatGraphQLError(error: any, context?: any) {
  // Extract meaningful error information
  const errorInfo = {
    message: error.message,
    locations: error.locations,
    path: error.path,
    source: error.source?.body,
  }

  // Set Sentry context
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('graphql', {
        operationName: context.operationName,
        operationType: context.operation?.operation,
        variables: context.variableValues,
        query: context.document?.loc?.source?.body,
      })
      
      if (context.user) {
        scope.setUser({
          id: context.user.id,
          email: context.user.email,
        })
      }
    }
    
    scope.setTag('error_type', 'graphql')
    scope.setLevel('error')
    
    Sentry.captureException(error)
  })

  // Log to Winston as well
  logger.error('GraphQL error', {
    error: errorInfo,
    context: context ? {
      operationName: context.operationName,
      operationType: context.operation?.operation,
      userId: context.user?.id,
    } : undefined,
  })

  return error
}

// Performance monitoring for GraphQL
export function captureGraphQLPerformance(operationName: string, duration: number, context?: any) {
  Sentry.withScope((scope) => {
    scope.setTag('operation', 'graphql')
    scope.setTag('operation_name', operationName)
    scope.setMeasurement('graphql_duration', duration, 'millisecond')
    
    if (context?.user) {
      scope.setUser({
        id: context.user.id,
        email: context.user.email,
      })
    }
    
    if (duration > 1000) { // Log slow queries (> 1 second)
      scope.setLevel('warning')
      Sentry.captureMessage(`Slow GraphQL query: ${operationName}`)
    }
  })
}

// Capture custom error with context
export function captureErrorWithContext(error: Error, context: Record<string, any>) {
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      scope.setExtra(key, value)
    })
    Sentry.captureException(error)
  })
}

// Capture message with context
export function captureMessageWithContext(message: string, level: Sentry.SeverityLevel, context?: Record<string, any>) {
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value)
      })
    }
    scope.setLevel(level)
    Sentry.captureMessage(message)
  })
}

// Set user context
export function setSentryUser(user: { id: string; email?: string; username?: string }) {
  Sentry.setUser(user)
}

// Clear user context
export function clearSentryUser() {
  Sentry.setUser(null)
}

// Add breadcrumb
export function addBreadcrumb(message: string, category: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
    timestamp: Date.now() / 1000,
  })
}

export { Sentry }