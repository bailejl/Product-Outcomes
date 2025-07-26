import { GraphQLRequestListener, GraphQLServerListener } from '@apollo/server'
import { GraphQLError, GraphQLResolveInfo } from 'graphql'
import { graphqlLogger, createPerformanceLogger, ContextLogger } from '../config/logger'
import { formatGraphQLError, captureGraphQLPerformance, addBreadcrumb } from '../config/sentry'

export interface GraphQLLoggerOptions {
  logQueries?: boolean
  logMutations?: boolean
  logSubscriptions?: boolean
  logVariables?: boolean
  logResults?: boolean
  slowQueryThreshold?: number
  maxQueryLength?: number
  maxVariableSize?: number
  sensitiveFields?: string[]
}

const DEFAULT_OPTIONS: GraphQLLoggerOptions = {
  logQueries: true,
  logMutations: true,
  logSubscriptions: true,
  logVariables: false,
  logResults: false,
  slowQueryThreshold: 1000, // 1 second
  maxQueryLength: 5000,
  maxVariableSize: 1000,
  sensitiveFields: ['password', 'token', 'secret', 'authorization'],
}

export function createGraphQLLogger(options: GraphQLLoggerOptions = {}): GraphQLServerListener {
  const config = { ...DEFAULT_OPTIONS, ...options }
  
  return {
    requestDidStart() {
      return createRequestListener(config)
    },
  }
}

function createRequestListener(config: GraphQLLoggerOptions): GraphQLRequestListener<any> {
  let startTime: number
  let operationName: string | undefined
  let operationType: string | undefined
  let query: string | undefined
  let variables: any
  let contextLogger: ContextLogger
  let performanceLogger: any

  return {
    didResolveOperation(requestContext) {
      operationName = requestContext.operationName || 'anonymous'
      operationType = requestContext.operation?.operation || 'unknown'
      query = requestContext.request.query || ''
      variables = requestContext.request.variables || {}
      
      // Create context logger with GraphQL context
      const req = requestContext.contextValue?.req
      if (req?.logger) {
        contextLogger = req.logger.withContext({
          graphql: {
            operationName,
            operationType,
          },
        })
      } else {
        contextLogger = new ContextLogger({
          correlationId: req?.correlationId,
          userId: req?.user?.id,
          graphql: {
            operationName,
            operationType,
          },
        }, graphqlLogger)
      }

      // Should we log this operation?
      const shouldLog = 
        (operationType === 'query' && config.logQueries) ||
        (operationType === 'mutation' && config.logMutations) ||
        (operationType === 'subscription' && config.logSubscriptions)

      if (shouldLog) {
        // Sanitize and truncate query
        let sanitizedQuery = query
        if (sanitizedQuery.length > config.maxQueryLength!) {
          sanitizedQuery = sanitizedQuery.substring(0, config.maxQueryLength!) + '...[TRUNCATED]'
        }

        // Sanitize variables
        let sanitizedVariables = variables
        if (config.logVariables) {
          sanitizedVariables = sanitizeData(variables, config.sensitiveFields!)
          
          const variablesString = JSON.stringify(sanitizedVariables)
          if (variablesString.length > config.maxVariableSize!) {
            sanitizedVariables = {
              ...sanitizedVariables,
              _truncated: true,
              _originalSize: variablesString.length,
            }
          }
        }

        contextLogger.info(`GraphQL ${operationType} started`, {
          query: sanitizedQuery,
          variables: config.logVariables ? sanitizedVariables : undefined,
        })

        // Add Sentry breadcrumb
        addBreadcrumb(`GraphQL ${operationType}: ${operationName}`, 'graphql', {
          operationName,
          operationType,
          queryLength: query.length,
        })
      }
    },

    willSendResponse(requestContext) {
      const endTime = performance.now()
      const duration = endTime - startTime

      // Log performance
      if (performanceLogger) {
        performanceLogger.finish({
          graphql: {
            operationName,
            operationType,
            complexity: calculateQueryComplexity(requestContext.operation),
          },
        })
      }

      // Capture performance in Sentry
      if (operationName && duration) {
        captureGraphQLPerformance(operationName, duration, requestContext.contextValue)
      }

      // Log slow queries
      if (duration > config.slowQueryThreshold!) {
        contextLogger.warn(`Slow GraphQL ${operationType}`, {
          duration,
          threshold: config.slowQueryThreshold,
          query: query?.substring(0, 200) + (query && query.length > 200 ? '...' : ''),
        })
      }

      // Log results if enabled
      if (config.logResults && requestContext.response.body.kind === 'single') {
        const result = requestContext.response.body.singleResult
        const sanitizedResult = result.data ? sanitizeData(result.data, config.sensitiveFields!) : result.data

        contextLogger.debug(`GraphQL ${operationType} completed`, {
          duration,
          hasErrors: !!result.errors?.length,
          errorCount: result.errors?.length || 0,
          result: sanitizedResult,
        })
      } else {
        contextLogger.info(`GraphQL ${operationType} completed`, {
          duration,
          hasErrors: !!requestContext.response.body.kind === 'single' && 
                      !!requestContext.response.body.singleResult.errors?.length,
        })
      }
    },

    didEncounterErrors(requestContext) {
      const errors = requestContext.errors || []
      
      errors.forEach((error, index) => {
        // Format and send error to Sentry
        const formattedError = formatGraphQLError(error, requestContext.contextValue)
        
        // Log error details
        contextLogger.error(`GraphQL error ${index + 1}`, formattedError, {
          operationName,
          operationType,
          path: error.path,
          locations: error.locations,
          extensions: error.extensions,
        })
      })
    },

    executionDidStart() {
      startTime = performance.now()
      performanceLogger = createPerformanceLogger(`GraphQL ${operationType}: ${operationName}`)
      
      return {
        willResolveField({ info }) {
          return createFieldResolver(info, contextLogger)
        },
      }
    },
  }
}

// Field-level resolver logging
function createFieldResolver(info: GraphQLResolveInfo, logger: ContextLogger) {
  const fieldStartTime = performance.now()
  const fieldPath = `${info.parentType.name}.${info.fieldName}`
  
  // Log slow field resolvers
  return (error?: Error | null) => {
    const fieldEndTime = performance.now()
    const fieldDuration = fieldEndTime - fieldStartTime
    
    if (fieldDuration > 100) { // Log field resolvers taking > 100ms
      logger.debug('Slow field resolver', {
        field: fieldPath,
        duration: fieldDuration,
        args: info.variableValues,
      })
    }
    
    if (error) {
      logger.error(`Field resolver error: ${fieldPath}`, error, {
        field: fieldPath,
        args: info.variableValues,
        duration: fieldDuration,
      })
    }
  }
}

// Calculate basic query complexity
function calculateQueryComplexity(operation: any): number {
  if (!operation?.selectionSet) return 0
  
  let complexity = 0
  
  function countSelections(selectionSet: any): number {
    if (!selectionSet?.selections) return 0
    
    let count = 0
    for (const selection of selectionSet.selections) {
      count++
      if (selection.selectionSet) {
        count += countSelections(selection.selectionSet)
      }
    }
    return count
  }
  
  complexity = countSelections(operation.selectionSet)
  return complexity
}

// Sanitize sensitive data
function sanitizeData(data: any, sensitiveFields: string[]): any {
  if (!data || typeof data !== 'object') {
    return data
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item, sensitiveFields))
  }
  
  const sanitized: any = {}
  
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase()
    const isSensitive = sensitiveFields.some(field => 
      lowerKey.includes(field.toLowerCase())
    )
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value, sensitiveFields)
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
}

// Custom GraphQL error formatter
export function formatGraphQLErrorWithLogging(error: GraphQLError, context?: any): GraphQLError {
  // Use Sentry formatter
  const formattedError = formatGraphQLError(error, context)
  
  // Create user-friendly error message for client
  let clientMessage = error.message
  
  // Hide internal errors in production
  if (process.env.NODE_ENV === 'production') {
    if (error.message.includes('Database') || error.message.includes('Internal')) {
      clientMessage = 'An internal error occurred'
    }
  }
  
  return new GraphQLError(
    clientMessage,
    {
      nodes: error.nodes,
      source: error.source,
      positions: error.positions,
      path: error.path,
      originalError: error.originalError,
      extensions: {
        ...error.extensions,
        code: error.extensions?.code || 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
        correlationId: context?.req?.correlationId,
      },
    }
  )
}

// GraphQL context enhancer with logging
export function enhanceGraphQLContext(context: any) {
  return {
    ...context,
    logger: context.req?.logger || new ContextLogger({
      correlationId: context.req?.correlationId,
      userId: context.user?.id,
    }),
    
    // Helper to log GraphQL operations
    logOperation: (message: string, data?: any) => {
      const logger = context.req?.logger || graphqlLogger
      logger.info(message, {
        ...data,
        operationName: context.operationName,
        userId: context.user?.id,
      })
    },
    
    // Helper to log errors
    logError: (message: string, error?: Error, data?: any) => {
      const logger = context.req?.logger || graphqlLogger
      logger.error(message, error, {
        ...data,
        operationName: context.operationName,
        userId: context.user?.id,
      })
    },
  }
}