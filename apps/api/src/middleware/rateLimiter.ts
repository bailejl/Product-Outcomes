import { Request, Response, NextFunction } from 'express'

interface RateLimiterOptions {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum number of requests per window
  message?: string // Custom error message
  skipSuccessfulRequests?: boolean // Skip counting successful requests
  keyGenerator?: (req: Request) => string // Custom key generator function
}

interface RateLimitInfo {
  count: number
  resetTime: number
}

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, RateLimitInfo>()

/**
 * Rate limiting middleware to prevent abuse
 */
export function rateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
    keyGenerator = (req: Request) => req.ip || 'unknown'
  } = options

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req)
    const now = Date.now()
    const windowStart = now - windowMs

    // Clean up expired entries
    const info = rateLimitStore.get(key)
    if (info && info.resetTime <= now) {
      rateLimitStore.delete(key)
    }

    // Get current count
    const currentInfo = rateLimitStore.get(key)
    const currentCount = currentInfo?.count || 0
    const resetTime = currentInfo?.resetTime || now + windowMs

    // Check if limit exceeded
    if (currentCount >= maxRequests) {
      const remainingTime = Math.ceil((resetTime - now) / 1000)
      
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message,
        retryAfter: remainingTime,
        limit: maxRequests,
        windowMs,
      })
    }

    // Store original end function to intercept response
    const originalEnd = res.end
    let requestCounted = false

    res.end = function(chunk?: any, encoding?: any) {
      // Count request if not already counted and conditions are met
      if (!requestCounted) {
        const shouldCount = skipSuccessfulRequests 
          ? res.statusCode >= 400 
          : true

        if (shouldCount) {
          rateLimitStore.set(key, {
            count: currentCount + 1,
            resetTime: resetTime
          })
        }
        requestCounted = true
      }

      // Call original end function
      originalEnd.call(this, chunk, encoding)
    }

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, maxRequests - currentCount - 1).toString(),
      'X-RateLimit-Reset': new Date(resetTime).toISOString(),
    })

    next()
  }
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  // Strict rate limiting for password reset requests
  passwordReset: rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 3, // Maximum 3 password reset requests per 15 minutes
    message: 'Too many password reset requests. Please try again in 15 minutes.',
    skipSuccessfulRequests: true, // Only count failed requests
    keyGenerator: (req: Request) => `password-reset:${req.ip}:${req.body?.email || 'unknown'}`
  }),

  // General auth rate limiting
  auth: rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // Maximum 10 auth requests per 15 minutes
    message: 'Too many authentication requests. Please try again later.',
    keyGenerator: (req: Request) => `auth:${req.ip}`
  }),

  // Login attempts rate limiting
  login: rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // Maximum 5 login attempts per 15 minutes
    message: 'Too many login attempts. Please try again in 15 minutes.',
    skipSuccessfulRequests: true, // Only count failed login attempts
    keyGenerator: (req: Request) => `login:${req.ip}:${req.body?.email || 'unknown'}`
  }),

  // General API rate limiting
  api: rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // Maximum 100 requests per 15 minutes
    message: 'Too many requests. Please try again later.',
    keyGenerator: (req: Request) => `api:${req.ip}`
  }),

  // Email verification rate limiting
  emailVerification: rateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 2, // Maximum 2 email verification requests per 5 minutes
    message: 'Too many email verification requests. Please try again in 5 minutes.',
    keyGenerator: (req: Request) => `email-verify:${req.ip}:${req.body?.email || 'unknown'}`
  })
}

/**
 * Clean up expired rate limit entries (call this periodically)
 */
export function cleanupRateLimitStore() {
  const now = Date.now()
  for (const [key, info] of rateLimitStore.entries()) {
    if (info.resetTime <= now) {
      rateLimitStore.delete(key)
    }
  }
}

// Clean up expired entries every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000)