import { Router, Request, Response } from 'express'
import {
  AuthService,
  UserRole,
  LoginRequest,
  RegisterRequest,
  PasswordResetRequest,
  PasswordResetConfirm,
  AuthenticatedRequest,
} from '@product-outcomes/auth'
import { UserRepository, User } from '@product-outcomes/database'
import { sessionManager, sessionMonitor } from '../main'
import { rateLimiters } from '../middleware/rateLimiter'

// Extend the session object to include user data
declare module 'express-session' {
  interface SessionData {
    userId?: string
    user?: Omit<User, 'password'>
    lastAccess?: number
    createdAt?: number
  }
}

const router = Router()
const authService = new AuthService()
const userRepository = new UserRepository()

/**
 * POST /auth/register
 * Register a new user account
 */
router.post('/register', rateLimiters.auth, async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName }: RegisterRequest = req.body

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Email, password, firstName, and lastName are required',
      })
    }

    // Validate email format
    if (!authService.validateEmail(email)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid email format',
      })
    }

    // Check if user already exists
    const existingUser = await userRepository.findByEmail(email)
    if (existingUser) {
      return res.status(409).json({
        error: 'Registration failed',
        message: 'User with this email already exists',
      })
    }

    // Register user using auth service
    const result = await authService.registerUser(
      { email, password, firstName, lastName },
      userData =>
        userRepository.create(
          userData as Omit<User, 'id' | 'createdAt' | 'updatedAt'>
        )
    )

    // Store user data in session after registration
    req.session.userId = result.user.id
    req.session.user = result.user
    req.session.lastAccess = Date.now()
    req.session.createdAt = Date.now()

    // Save session
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    res.status(201).json({
      message: 'User registered successfully',
      user: result.user,
      tokens: result.tokens,
    })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(400).json({
      error: 'Registration failed',
      message:
        error instanceof Error
          ? error.message
          : 'An error occurred during registration',
    })
  }
})

/**
 * POST /auth/login
 * Authenticate user and return tokens
 */
router.post('/login', rateLimiters.login, async (req: Request, res: Response) => {
  try {
    const { email, password, rememberMe }: LoginRequest = req.body

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Email and password are required',
      })
    }

    // Check if user exists and is not locked
    const user = await userRepository.findByEmail(email)
    if (user && !user.canAttemptLogin) {
      return res.status(423).json({
        error: 'Account locked',
        message: 'Account is locked due to too many failed login attempts',
      })
    }

    try {
      // Authenticate user
      const result = await authService.authenticateUser(
        email,
        password,
        email => userRepository.findByEmail(email),
        userId => userRepository.updateLastLogin(userId)
      )

      // Check concurrent session limits
      await sessionManager.enforceConcurrentSessionLimit(result.user.id)

      // Store user data in session
      req.session.userId = result.user.id
      req.session.user = result.user
      req.session.lastAccess = Date.now()
      req.session.createdAt = Date.now()

      // Save session
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err)
          else resolve()
        })
      })

      res.json({
        message: 'Login successful',
        user: result.user,
        tokens: result.tokens,
      })
    } catch (authError) {
      // Increment login attempts on failed login
      await userRepository.incrementLoginAttempts(email)

      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password',
      })
    }
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({
      error: 'Login failed',
      message: 'An error occurred during login',
    })
  }
})

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Refresh token is required',
      })
    }

    // Refresh tokens
    const tokens = await authService.refreshToken(refreshToken, userId =>
      userRepository.findById(userId)
    )

    res.json({
      message: 'Token refreshed successfully',
      tokens,
    })
  } catch (error) {
    console.error('Token refresh error:', error)
    res.status(401).json({
      error: 'Token refresh failed',
      message: error instanceof Error ? error.message : 'Invalid refresh token',
    })
  }
})

/**
 * POST /auth/logout
 * Logout user and invalidate session
 */
router.post(
  '/logout',
  authService.middleware.authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId || req.session.userId

      if (userId) {
        // Invalidate all user sessions
        await sessionManager.invalidateUserSessions(userId)
      }

      // Destroy current session
      await new Promise<void>((resolve, reject) => {
        req.session.destroy((err) => {
          if (err) reject(err)
          else resolve()
        })
      })

      // Clear the session cookie
      res.clearCookie('product-outcomes.sid')

      res.json({
        message: 'Logout successful',
      })
    } catch (error) {
      console.error('Logout error:', error)
      res.status(500).json({
        error: 'Logout failed',
        message: 'An error occurred during logout',
      })
    }
  }
)

/**
 * GET /auth/me
 * Get current user profile
 */
router.get(
  '/me',
  authService.middleware.authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'User ID not found in token',
        })
      }

      const user = await userRepository.findById(req.userId)
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User account no longer exists',
        })
      }

      // Remove password from response
      const { password, ...userWithoutPassword } = user

      res.json({
        user: userWithoutPassword,
      })
    } catch (error) {
      console.error('Get profile error:', error)
      res.status(500).json({
        error: 'Profile fetch failed',
        message: 'An error occurred while fetching user profile',
      })
    }
  }
)

/**
 * PUT /auth/profile
 * Update user profile
 */
router.put(
  '/profile',
  authService.middleware.authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'User ID not found in token',
        })
      }

      const { firstName, lastName, email } = req.body

      // Validate input
      if (email && !authService.validateEmail(email)) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid email format',
        })
      }

      // Update user profile
      const updatedUser = await userRepository.update(req.userId, {
        firstName,
        lastName,
        email,
      })

      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser

      res.json({
        message: 'Profile updated successfully',
        user: userWithoutPassword,
      })
    } catch (error) {
      console.error('Profile update error:', error)

      if (error instanceof Error && error.message.includes('already exists')) {
        return res.status(409).json({
          error: 'Update failed',
          message: error.message,
        })
      }

      res.status(500).json({
        error: 'Profile update failed',
        message: 'An error occurred while updating profile',
      })
    }
  }
)

/**
 * POST /auth/change-password
 * Change user password
 */
router.post(
  '/change-password',
  authService.middleware.authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'User ID not found in token',
        })
      }

      const { currentPassword, newPassword } = req.body

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Current password and new password are required',
        })
      }

      // Get user with password
      const user = await userRepository.findById(req.userId)
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User account no longer exists',
        })
      }

      // Verify current password
      const isCurrentPasswordValid = await authService.password.comparePassword(
        currentPassword,
        user.password
      )
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          error: 'Password change failed',
          message: 'Current password is incorrect',
        })
      }

      // Validate new password strength
      const passwordValidation =
        authService.password.validatePasswordStrength(newPassword)
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          error: 'Password validation failed',
          message: passwordValidation.errors.join(', '),
        })
      }

      // Hash new password and update
      const hashedNewPassword = await authService.password.hashPassword(
        newPassword
      )
      await userRepository.update(req.userId, { password: hashedNewPassword })

      res.json({
        message: 'Password changed successfully',
      })
    } catch (error) {
      console.error('Password change error:', error)
      res.status(500).json({
        error: 'Password change failed',
        message: 'An error occurred while changing password',
      })
    }
  }
)

/**
 * POST /auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', rateLimiters.passwordReset, async (req: Request, res: Response) => {
  try {
    const { email }: PasswordResetRequest = req.body

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Email is required',
      })
    }

    // Request password reset
    const result = await authService.requestPasswordReset(
      { email },
      email => userRepository.findByEmail(email),
      (userId, updates) => userRepository.update(userId, updates)
    )

    res.json(result)
  } catch (error) {
    console.error('Password reset request error:', error)
    res.status(500).json({
      error: 'Password reset failed',
      message: 'An error occurred while processing password reset request',
    })
  }
})

/**
 * GET /auth/reset-password/:token
 * Verify password reset token
 */
router.get('/reset-password/:token', rateLimiters.auth, async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    if (!token) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Reset token is required',
      })
    }

    // Verify token validity
    const result = await authService.verifyResetToken(
      token,
      token => userRepository.findByPasswordResetToken(token)
    )

    if (!result.valid) {
      return res.status(400).json({
        error: 'Invalid token',
        message: result.expired ? 'Reset token has expired' : 'Invalid reset token',
      })
    }

    res.json({
      message: 'Reset token is valid',
      valid: true,
    })
  } catch (error) {
    console.error('Token verification error:', error)
    res.status(500).json({
      error: 'Token verification failed',
      message: 'An error occurred while verifying reset token',
    })
  }
})

/**
 * POST /auth/reset-password
 * Reset password using token
 */
router.post('/reset-password', rateLimiters.auth, async (req: Request, res: Response) => {
  try {
    const { token, newPassword }: PasswordResetConfirm = req.body

    // Validate required fields
    if (!token || !newPassword) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Reset token and new password are required',
      })
    }

    // Reset password
    const result = await authService.resetPassword(
      { token, newPassword },
      token => userRepository.findByPasswordResetToken(token),
      (userId, updates) => userRepository.update(userId, updates)
    )

    res.json(result)
  } catch (error) {
    console.error('Password reset error:', error)
    
    // Handle specific validation errors
    if (error instanceof Error) {
      if (error.message.includes('Invalid or expired')) {
        return res.status(400).json({
          error: 'Reset failed',
          message: error.message,
        })
      }
      
      if (error.message.includes('Password')) {
        return res.status(400).json({
          error: 'Password validation failed',
          message: error.message,
        })
      }
    }

    res.status(500).json({
      error: 'Password reset failed',
      message: 'An error occurred while resetting password',
    })
  }
})

/**
 * GET /auth/sessions
 * Get current user's session info
 */
router.get(
  '/sessions',
  authService.middleware.authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId
      if (!userId) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'User ID not found',
        })
      }

      const sessionCount = await sessionManager.getUserSessionCount(userId)
      
      res.json({
        activeSessions: sessionCount,
        currentSession: {
          id: req.sessionID,
          lastAccess: req.session.lastAccess,
          createdAt: req.session.createdAt,
        },
      })
    } catch (error) {
      console.error('Session info error:', error)
      res.status(500).json({
        error: 'Session info failed',
        message: 'An error occurred while fetching session information',
      })
    }
  }
)

/**
 * DELETE /auth/sessions
 * Invalidate all user sessions except current one
 */
router.delete(
  '/sessions',
  authService.middleware.authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId
      if (!userId) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'User ID not found',
        })
      }

      const currentSessionId = req.sessionID

      // Get all session keys for this user
      await sessionManager.invalidateUserSessions(userId)
      
      // Recreate current session
      req.session.userId = userId
      req.session.lastAccess = Date.now()
      
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err)
          else resolve()
        })
      })

      res.json({
        message: 'All other sessions invalidated successfully',
      })
    } catch (error) {
      console.error('Session invalidation error:', error)
      res.status(500).json({
        error: 'Session invalidation failed',
        message: 'An error occurred while invalidating sessions',
      })
    }
  }
)

/**
 * GET /auth/monitor
 * Get session monitoring report (admin only)
 */
router.get(
  '/monitor',
  authService.middleware.authenticate,
  authService.middleware.requireRole(UserRole.ADMIN),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const report = sessionMonitor.generateReport()
      const detailedStats = await sessionMonitor.getDetailedStats()
      
      res.json({
        report,
        stats: detailedStats,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Session monitoring error:', error)
      res.status(500).json({
        error: 'Monitoring fetch failed',
        message: 'An error occurred while fetching monitoring data',
      })
    }
  }
)

/**
 * POST /auth/monitor/cleanup
 * Manually trigger session cleanup (admin only)
 */
router.post(
  '/monitor/cleanup',
  authService.middleware.authenticate,
  authService.middleware.requireRole(UserRole.ADMIN),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const cleanedCount = await sessionMonitor.triggerCleanup()
      
      res.json({
        message: `Successfully cleaned up ${cleanedCount} expired sessions`,
        cleanedCount,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Manual cleanup error:', error)
      res.status(500).json({
        error: 'Cleanup failed',
        message: 'An error occurred during manual cleanup',
      })
    }
  }
)

/**
 * GET /auth/stats
 * Get authentication statistics (admin only)
 */
router.get(
  '/stats',
  authService.middleware.authenticate,
  authService.middleware.requireRole(UserRole.ADMIN),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userStats = await userRepository.getStatistics()
      const sessionStats = await sessionManager.getSessionStats()
      const monitoringMetrics = sessionMonitor.getMetrics()
      
      res.json({
        users: userStats,
        sessions: sessionStats,
        monitoring: monitoringMetrics,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Auth stats error:', error)
      res.status(500).json({
        error: 'Stats fetch failed',
        message: 'An error occurred while fetching statistics',
      })
    }
  }
)

export default router
