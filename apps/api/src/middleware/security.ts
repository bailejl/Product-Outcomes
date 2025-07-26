import helmet from 'helmet'
import hpp from 'hpp'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import slowDown from 'express-slow-down'
import { body, header, param, query, validationResult } from 'express-validator'
import { Request, Response, NextFunction } from 'express'
import Redis from 'ioredis'
import DOMPurify from 'isomorphic-dompurify'

// Redis client for rate limiting
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
})

redis.on('error', (err) => {
  console.error('Redis connection error for rate limiting:', err)
})

// Custom rate limit store using Redis
class RedisRateLimitStore {
  private prefix: string

  constructor(prefix = 'rate_limit:') {
    this.prefix = prefix
  }

  async increment(key: string, ttl: number): Promise<{ totalHits: number; timeToExpire?: number }> {
    const redisKey = `${this.prefix}${key}`
    
    try {
      const multi = redis.multi()
      multi.incr(redisKey)
      multi.ttl(redisKey)
      
      const [hits, currentTtl] = await multi.exec() as [[null, number], [null, number]]
      
      if (currentTtl[1] === -1) {
        // Key has no expiry, set it
        await redis.expire(redisKey, ttl)
      }
      
      return {
        totalHits: hits[1],
        timeToExpire: currentTtl[1] > 0 ? currentTtl[1] * 1000 : ttl * 1000
      }
    } catch (error) {
      console.error('Redis rate limit error:', error)
      // Fallback to allow request if Redis fails
      return { totalHits: 1 }
    }
  }

  async decrement(key: string): Promise<void> {
    const redisKey = `${this.prefix}${key}`
    
    try {
      await redis.decr(redisKey)
    } catch (error) {
      console.error('Redis decrement error:', error)
    }
  }

  async resetKey(key: string): Promise<void> {
    const redisKey = `${this.prefix}${key}`
    
    try {
      await redis.del(redisKey)
    } catch (error) {
      console.error('Redis reset error:', error)
    }
  }

  async resetAll(): Promise<void> {
    try {
      const keys = await redis.keys(`${this.prefix}*`)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } catch (error) {
      console.error('Redis reset all error:', error)
    }
  }
}

const redisStore = new RedisRateLimitStore()

// Enhanced helmet configuration for production security
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for some UI libraries
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net"
      ],
      scriptSrc: [
        "'self'",
        "'unsafe-eval'", // Required for development
        process.env.NODE_ENV === 'development' ? "'unsafe-inline'" : null,
        "https://cdn.jsdelivr.net",
        "https://js.sentry-cdn.com"
      ].filter(Boolean),
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "data:"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:",
        "blob:"
      ],
      connectSrc: [
        "'self'",
        "wss:",
        "ws:",
        process.env.SENTRY_DSN ? "https://sentry.io" : null,
        process.env.GRAFANA_URL || null
      ].filter(Boolean),
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    },
    reportOnly: process.env.NODE_ENV === 'development'
  },
  crossOriginEmbedderPolicy: false, // Disable for compatibility
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
})

// Compression middleware
export const compressionMiddleware = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false
    }
    return compression.filter(req, res)
  },
  threshold: 1024, // Only compress responses > 1KB
  level: 6, // Compression level (1-9, 6 is good balance)
})

// HPP protection against parameter pollution
export const hppProtection = hpp({
  whitelist: ['tags', 'categories', 'roles'] // Allow arrays for these parameters
})

// Advanced rate limiting configurations
export const createRateLimit = (options: {
  windowMs: number
  max: number
  message?: string
  keyGenerator?: (req: Request) => string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  onLimitReached?: (req: Request, res: Response, options: any) => void
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      error: 'Rate limit exceeded',
      message: options.message || 'Too many requests from this IP, please try again later',
      retryAfter: Math.ceil(options.windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: {
      incr: async (key: string) => {
        const result = await redisStore.increment(key, Math.ceil(options.windowMs / 1000))
        return result
      },
      decrement: async (key: string) => {
        await redisStore.decrement(key)
      },
      resetKey: async (key: string) => {
        await redisStore.resetKey(key)
      },
      resetAll: async () => {
        await redisStore.resetAll()
      }
    },
    keyGenerator: options.keyGenerator || ((req: Request) => {
      // Use user ID if authenticated, otherwise IP
      const user = req.session?.user || req.user
      return user ? `user:${user.id}` : `ip:${req.ip}`
    }),
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    onLimitReached: options.onLimitReached || ((req, res, options) => {
      console.warn(`Rate limit exceeded for ${req.ip}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl,
        method: req.method
      })
    })
  })
}

// Slow down middleware for progressive delays
export const createSlowDown = (options: {
  windowMs: number
  delayAfter: number
  delayMs: number
  maxDelayMs?: number
}) => {
  return slowDown({
    windowMs: options.windowMs,
    delayAfter: options.delayAfter,
    delayMs: options.delayMs,
    maxDelayMs: options.maxDelayMs || options.delayMs * 10,
    keyGenerator: (req: Request) => {
      const user = req.session?.user || req.user
      return user ? `user:${user.id}` : `ip:${req.ip}`
    }
  })
}

// Pre-configured rate limiters
export const rateLimiters = {
  // Strict authentication rate limiting
  auth: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: 'Too many authentication attempts, please try again later',
    skipSuccessfulRequests: true,
    keyGenerator: (req: Request) => `auth:${req.ip}:${req.body?.email || 'unknown'}`
  }),

  // Login attempts with progressive penalties
  login: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many login attempts, account temporarily locked',
    skipSuccessfulRequests: true,
    keyGenerator: (req: Request) => `login:${req.ip}:${req.body?.email || 'unknown'}`
  }),

  // Password reset protection
  passwordReset: createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts per hour
    message: 'Too many password reset requests, please try again later',
    keyGenerator: (req: Request) => `pwd-reset:${req.ip}:${req.body?.email || 'unknown'}`
  }),

  // General API rate limiting (per user)
  apiUser: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per user per window
    message: 'API rate limit exceeded for user account',
    keyGenerator: (req: Request) => {
      const user = req.session?.user || req.user
      return user ? `api-user:${user.id}` : `api-ip:${req.ip}`
    }
  }),

  // General API rate limiting (per IP)
  apiIP: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per IP per window (for unauthenticated)
    message: 'API rate limit exceeded for IP address',
    keyGenerator: (req: Request) => `api-ip:${req.ip}`
  }),

  // File upload rate limiting
  upload: createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 uploads per hour
    message: 'Too many file uploads, please try again later',
    keyGenerator: (req: Request) => {
      const user = req.session?.user || req.user
      return user ? `upload:${user.id}` : `upload-ip:${req.ip}`
    }
  }),

  // GraphQL specific rate limiting
  graphql: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 GraphQL operations per window
    message: 'GraphQL rate limit exceeded',
    keyGenerator: (req: Request) => {
      const user = req.session?.user || req.user
      return user ? `graphql:${user.id}` : `graphql-ip:${req.ip}`
    }
  })
}

// Slow down configurations
export const slowDownConfigs = {
  // Auth endpoints get progressively slower
  auth: createSlowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 3, // Start slowing down after 3 requests
    delayMs: 1000, // 1 second delay
    maxDelayMs: 10000 // Max 10 second delay
  }),

  // API endpoints slow down for heavy usage
  api: createSlowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 50, // Start slowing down after 50 requests
    delayMs: 100, // 100ms delay
    maxDelayMs: 2000 // Max 2 second delay
  })
}

// Input sanitization middleware
export const sanitizeInput = (fields: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sanitize body fields
      if (req.body && typeof req.body === 'object') {
        for (const [key, value] of Object.entries(req.body)) {
          if (fields.length === 0 || fields.includes(key)) {
            if (typeof value === 'string') {
              req.body[key] = DOMPurify.sanitize(value, {
                ALLOWED_TAGS: [], // No HTML tags allowed
                ALLOWED_ATTR: []
              })
            }
          }
        }
      }

      // Sanitize query parameters
      if (req.query && typeof req.query === 'object') {
        for (const [key, value] of Object.entries(req.query)) {
          if (fields.length === 0 || fields.includes(key)) {
            if (typeof value === 'string') {
              req.query[key] = DOMPurify.sanitize(value, {
                ALLOWED_TAGS: [],
                ALLOWED_ATTR: []
              })
            }
          }
        }
      }

      next()
    } catch (error) {
      console.error('Input sanitization error:', error)
      res.status(400).json({ error: 'Invalid input detected' })
    }
  }
}

// Validation error handler
export const validationErrorHandler = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.type === 'field' ? err.path : err.type,
        message: err.msg,
        value: err.type === 'field' ? err.value : undefined
      }))
    })
  }
  next()
}

// Common validation rules
export const validationRules = {
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  password: body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be 8-128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  
  name: body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be 1-100 characters')
    .matches(/^[a-zA-Z\s-']+$/)
    .withMessage('Name can only contain letters, spaces, hyphens and apostrophes'),
  
  id: param('id')
    .isUUID()
    .withMessage('Valid UUID required'),
  
  authorization: header('authorization')
    .optional()
    .matches(/^Bearer\s[\w-]+\.[\w-]+\.[\w-]+$/)
    .withMessage('Invalid JWT token format'),
  
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Page must be between 1 and 1000'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ]
}

// Security monitoring middleware
export const securityMonitoring = (req: Request, res: Response, next: NextFunction) => {
  // Log suspicious patterns
  const suspiciousPatterns = [
    /\b(union|select|insert|delete|drop|create|alter|exec|script)\b/i,
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/i,
    /on\w+\s*=/i
  ]

  const checkString = (str: string, source: string) => {
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(str)) {
        console.warn(`Suspicious pattern detected in ${source}:`, {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          url: req.originalUrl,
          pattern: pattern.toString(),
          value: str
        })
      }
    }
  }

  // Check URL
  checkString(req.originalUrl, 'URL')

  // Check headers
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') {
      checkString(value, `header:${key}`)
    }
  }

  // Check body
  if (req.body && typeof req.body === 'object') {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        checkString(value, `body:${key}`)
      }
    }
  }

  next()
}

// CORS configuration for production
export const corsConfig = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)

    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:4200',
      'http://localhost:3000',
      'https://your-production-domain.com'
    ]

    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      console.warn(`CORS blocked origin: ${origin}`)
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Correlation-ID'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Correlation-ID'
  ],
  maxAge: 86400 // 24 hours
}

// Export Redis client for cleanup
export { redis as securityRedis }