import { Request, Response, NextFunction } from 'express'
import { JwtService } from './jwt.service'
import { AuthenticatedRequest, UserRole } from './types'

export class AuthMiddleware {
  private jwtService: JwtService

  constructor() {
    this.jwtService = new JwtService()
  }

  /**
   * Middleware to verify JWT token and attach user to request
   */
  authenticate = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const authHeader = req.headers['authorization']
      const token = this.jwtService.extractTokenFromHeader(authHeader)

      if (!token) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'No token provided',
        })
      }

      const payload = this.jwtService.verifyAccessToken(token)

      // Attach user info to request
      req.userId = payload.userId
      req.user = {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
        firstName: '', // Will be populated by user lookup if needed
        lastName: '',
        isActive: true,
        emailVerified: true,
        loginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      next()
    } catch (error) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: error instanceof Error ? error.message : 'Invalid token',
      })
    }
  }

  /**
   * Middleware to check if user has required role
   */
  requireRole = (roles: UserRole | UserRole[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'User not authenticated',
        })
      }

      const allowedRoles = Array.isArray(roles) ? roles : [roles]

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          error: 'Access denied',
          message: `Required role: ${allowedRoles.join(' or ')}`,
        })
      }

      next()
    }
  }

  /**
   * Middleware to check if user is admin
   */
  requireAdmin = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    return this.requireRole(UserRole.ADMIN)(req, res, next)
  }

  /**
   * Optional authentication - doesn't fail if no token provided
   */
  optionalAuth = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const authHeader = req.headers['authorization']
      const token = this.jwtService.extractTokenFromHeader(authHeader)

      if (!token) {
        // No token provided, continue without authentication
        return next()
      }

      const payload = this.jwtService.verifyAccessToken(token)

      // Attach user info to request
      req.userId = payload.userId
      req.user = {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
        firstName: '',
        lastName: '',
        isActive: true,
        emailVerified: true,
        loginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      next()
    } catch (error) {
      // Invalid token, but continue without authentication
      next()
    }
  }

  /**
   * Rate limiting middleware for sensitive endpoints
   */
  rateLimit = (options: { windowMs: number; maxRequests: number }) => {
    const requests = new Map<string, { count: number; resetTime: number }>()

    return (req: Request, res: Response, next: NextFunction) => {
      const clientId = req.ip || 'unknown'
      const now = Date.now()
      const windowStart = now - options.windowMs

      // Clean up old entries
      for (const [key, value] of requests.entries()) {
        if (value.resetTime < windowStart) {
          requests.delete(key)
        }
      }

      const clientRequests = requests.get(clientId) || {
        count: 0,
        resetTime: now + options.windowMs,
      }

      if (clientRequests.resetTime < now) {
        // Reset window
        clientRequests.count = 0
        clientRequests.resetTime = now + options.windowMs
      }

      clientRequests.count++
      requests.set(clientId, clientRequests)

      if (clientRequests.count > options.maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil((clientRequests.resetTime - now) / 1000),
        })
      }

      next()
    }
  }

  /**
   * CORS middleware for authentication endpoints
   */
  corsAuth = (req: Request, res: Response, next: NextFunction) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:4200',
    ]

    const origin = req.headers.origin
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
    }

    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    )
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Credentials', 'true')

    if (req.method === 'OPTIONS') {
      return res.status(200).end()
    }

    next()
  }
}
