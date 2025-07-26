import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { httpLogger, createRequestLogger, ContextLogger } from '../config/logger'
import { addBreadcrumb, setSentryUser } from '../config/sentry'

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      correlationId: string
      logger: ContextLogger
      startTime: number
    }
  }
}

export interface RequestLoggerOptions {
  generateCorrelationId?: () => string
  skipPaths?: string[]
  skipMethods?: string[]
  logBody?: boolean
  logResponse?: boolean
  maxBodySize?: number
  sensitiveFields?: string[]
}

const DEFAULT_OPTIONS: RequestLoggerOptions = {
  generateCorrelationId: () => uuidv4(),
  skipPaths: ['/api/health', '/favicon.ico'],
  skipMethods: [],
  logBody: true,
  logResponse: false,
  maxBodySize: 10000, // 10KB
  sensitiveFields: ['password', 'token', 'secret', 'authorization', 'cookie'],
}

export function createRequestLogger(options: RequestLoggerOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options }
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip logging for certain paths
    if (config.skipPaths?.includes(req.path)) {
      return next()
    }
    
    // Skip logging for certain methods
    if (config.skipMethods?.includes(req.method)) {
      return next()
    }
    
    // Generate correlation ID
    req.correlationId = 
      req.get('X-Correlation-ID') || 
      req.get('X-Request-ID') || 
      config.generateCorrelationId!()
    
    // Set correlation ID in response header
    res.setHeader('X-Correlation-ID', req.correlationId)
    
    // Record start time
    req.startTime = performance.now()
    
    // Create request-specific logger
    req.logger = createRequestLogger(req)
    
    // Add Sentry breadcrumb
    addBreadcrumb(`HTTP ${req.method} ${req.path}`, 'http', {
      correlationId: req.correlationId,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    })
    
    // Set Sentry user context if available
    if (req.user) {
      setSentryUser({
        id: req.user.id,
        email: req.user.email,
        username: req.user.username,
      })
    }
    
    // Prepare request body for logging
    let requestBody = req.body
    if (config.logBody && requestBody) {
      requestBody = sanitizeData(requestBody, config.sensitiveFields!)
      
      // Truncate large bodies
      const bodyString = JSON.stringify(requestBody)
      if (bodyString.length > config.maxBodySize!) {
        requestBody = {
          ...requestBody,
          _truncated: true,
          _originalSize: bodyString.length,
        }
      }
    }
    
    // Log incoming request
    req.logger.http('Incoming request', {
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      contentLength: req.get('Content-Length'),
      contentType: req.get('Content-Type'),
      referer: req.get('Referer'),
      requestBody: config.logBody ? requestBody : undefined,
      headers: sanitizeHeaders(req.headers, config.sensitiveFields!),
    })
    
    // Capture original response methods
    const originalSend = res.send
    const originalJson = res.json
    
    let responseBody: any
    
    // Override response methods to capture response data
    if (config.logResponse) {
      res.send = function(body) {
        responseBody = body
        return originalSend.call(this, body)
      }
      
      res.json = function(body) {
        responseBody = body
        return originalJson.call(this, body)
      }
    }
    
    // Log response when finished
    res.on('finish', () => {
      const endTime = performance.now()
      const responseTime = endTime - req.startTime
      
      const logLevel = getLogLevel(res.statusCode)
      const message = `${req.method} ${req.originalUrl} - ${res.statusCode} - ${responseTime.toFixed(2)}ms`
      
      const logData = {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime,
        contentLength: res.get('Content-Length'),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id,
        responseBody: config.logResponse ? sanitizeData(responseBody, config.sensitiveFields!) : undefined,
      }
      
      // Log based on status code
      if (logLevel === 'error') {
        req.logger.error(message, undefined, logData)
      } else if (logLevel === 'warn') {
        req.logger.warn(message, logData)
      } else {
        req.logger.http(message, logData)
      }
      
      // Log slow requests
      if (responseTime > 1000) {
        req.logger.warn(`Slow request detected: ${responseTime.toFixed(2)}ms`, {
          ...logData,
          slowRequest: true,
          threshold: 1000,
        })
      }
      
      // Add Sentry breadcrumb for response
      addBreadcrumb(`HTTP Response ${res.statusCode}`, 'http', {
        correlationId: req.correlationId,
        statusCode: res.statusCode,
        responseTime,
      })
    })
    
    // Log response errors
    res.on('error', (error) => {
      req.logger.error('Response error', error, {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
      })
    })
    
    next()
  }
}

// Determine log level based on status code
function getLogLevel(statusCode: number): string {
  if (statusCode >= 500) return 'error'
  if (statusCode >= 400) return 'warn'
  return 'info'
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

// Sanitize headers
function sanitizeHeaders(headers: any, sensitiveFields: string[]): any {
  const sanitized: any = {}
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase()
    const isSensitive = sensitiveFields.some(field => 
      lowerKey.includes(field.toLowerCase())
    )
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]'
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
}

// Middleware to add correlation ID to all requests
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  req.correlationId = 
    req.get('X-Correlation-ID') || 
    req.get('X-Request-ID') || 
    uuidv4()
  
  res.setHeader('X-Correlation-ID', req.correlationId)
  next()
}

// Error logging middleware
export function errorLoggingMiddleware(error: Error, req: Request, res: Response, next: NextFunction) {
  const logger = req.logger || createRequestLogger(req)
  
  logger.error('Request error', error, {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode || 500,
    stack: error.stack,
    userId: req.user?.id,
  })
  
  next(error)
}

// Request timeout middleware
export function requestTimeoutMiddleware(timeoutMs: number = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        const logger = req.logger || createRequestLogger(req)
        logger.error('Request timeout', undefined, {
          method: req.method,
          url: req.originalUrl,
          timeout: timeoutMs,
        })
        
        res.status(408).json({
          error: 'Request timeout',
          correlationId: req.correlationId,
        })
      }
    }, timeoutMs)
    
    res.on('finish', () => clearTimeout(timeout))
    res.on('close', () => clearTimeout(timeout))
    
    next()
  }
}