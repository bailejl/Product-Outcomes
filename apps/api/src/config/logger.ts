import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

// Define log levels
export const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

// Define colors for console output
const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
}

winston.addColors(LOG_COLORS)

// Custom format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
)

// Format for JSON logs (for file and external services)
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

// Create logs directory
const logsDir = path.join(process.cwd(), 'logs')

// Console transport
const consoleTransport = new winston.transports.Console({
  format: logFormat,
})

// File transport for errors (with rotation)
const errorFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  format: jsonFormat,
  maxSize: '20m',
  maxFiles: '14d',
  zippedArchive: true,
})

// File transport for combined logs (with rotation)
const combinedFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  format: jsonFormat,
  maxSize: '20m',
  maxFiles: '7d',
  zippedArchive: true,
})

// File transport for HTTP requests (with rotation)
const httpFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'http-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'http',
  format: jsonFormat,
  maxSize: '20m',
  maxFiles: '3d',
  zippedArchive: true,
})

// File transport for GraphQL queries (with rotation)
const graphqlFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'graphql-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  format: jsonFormat,
  maxSize: '20m',
  maxFiles: '3d',
  zippedArchive: true,
})

// Create the main logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: LOG_LEVELS,
  format: jsonFormat,
  defaultMeta: {
    service: 'product-outcomes-api',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    consoleTransport,
    errorFileTransport,
    combinedFileTransport,
    httpFileTransport,
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: jsonFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: jsonFormat,
    }),
  ],
  exitOnError: false,
})

// Create specialized loggers
export const httpLogger = winston.createLogger({
  level: 'http',
  levels: LOG_LEVELS,
  format: jsonFormat,
  defaultMeta: {
    service: 'product-outcomes-api-http',
    type: 'http',
  },
  transports: [httpFileTransport, consoleTransport],
})

export const graphqlLogger = winston.createLogger({
  level: 'info',
  levels: LOG_LEVELS,
  format: jsonFormat,
  defaultMeta: {
    service: 'product-outcomes-api-graphql',
    type: 'graphql',
  },
  transports: [graphqlFileTransport, consoleTransport],
})

export const securityLogger = winston.createLogger({
  level: 'warn',
  levels: LOG_LEVELS,
  format: jsonFormat,
  defaultMeta: {
    service: 'product-outcomes-api-security',
    type: 'security',
  },
  transports: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'security-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      format: jsonFormat,
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true,
    }),
    consoleTransport,
  ],
})

// Context-aware logging utilities
export interface LogContext {
  userId?: string
  sessionId?: string
  correlationId?: string
  userAgent?: string
  ip?: string
  method?: string
  url?: string
  statusCode?: number
  responseTime?: number
  requestBody?: any
  responseBody?: any
  errors?: any[]
  performance?: {
    startTime: number
    endTime: number
    duration: number
  }
  graphql?: {
    query?: string
    variables?: any
    operationName?: string
    complexity?: number
  }
}

export class ContextLogger {
  private context: LogContext
  private baseLogger: winston.Logger

  constructor(context: LogContext = {}, baseLogger: winston.Logger = logger) {
    this.context = context
    this.baseLogger = baseLogger
  }

  private formatMessage(message: string, additionalContext?: Partial<LogContext>) {
    const fullContext = { ...this.context, ...additionalContext }
    return {
      message,
      ...fullContext,
      timestamp: new Date().toISOString(),
    }
  }

  error(message: string, error?: Error, additionalContext?: Partial<LogContext>) {
    const logData = this.formatMessage(message, additionalContext)
    if (error) {
      logData.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      }
    }
    this.baseLogger.error(logData)
  }

  warn(message: string, additionalContext?: Partial<LogContext>) {
    this.baseLogger.warn(this.formatMessage(message, additionalContext))
  }

  info(message: string, additionalContext?: Partial<LogContext>) {
    this.baseLogger.info(this.formatMessage(message, additionalContext))
  }

  http(message: string, additionalContext?: Partial<LogContext>) {
    this.baseLogger.http(this.formatMessage(message, additionalContext))
  }

  debug(message: string, additionalContext?: Partial<LogContext>) {
    this.baseLogger.debug(this.formatMessage(message, additionalContext))
  }

  withContext(additionalContext: Partial<LogContext>): ContextLogger {
    return new ContextLogger({ ...this.context, ...additionalContext }, this.baseLogger)
  }
}

// Generate correlation ID
export function generateCorrelationId(): string {
  return uuidv4()
}

// Utility to create logger with request context
export function createRequestLogger(req: any): ContextLogger {
  return new ContextLogger({
    correlationId: req.correlationId || generateCorrelationId(),
    userId: req.user?.id,
    sessionId: req.sessionID,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    method: req.method,
    url: req.originalUrl || req.url,
  })
}

// Performance measurement utilities
export function createPerformanceLogger(operation: string) {
  const startTime = performance.now()
  
  return {
    finish: (additionalContext?: Partial<LogContext>) => {
      const endTime = performance.now()
      const duration = endTime - startTime
      
      logger.info(`Performance: ${operation}`, {
        operation,
        performance: {
          startTime,
          endTime,
          duration,
        },
        ...additionalContext,
      })
      
      return duration
    }
  }
}

// Export default logger
export default logger