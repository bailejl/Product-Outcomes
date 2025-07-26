import { Request, Response, NextFunction } from 'express'
import { JwtPayload, verify } from 'jsonwebtoken'
import { 
  getRoleMetadata, 
  RoleDecoratorOptions,
  hasRoleRequirements 
} from '../decorators/roles.decorator'

// Extended request interface with user information
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    roles: string[]
    permissions: string[]
    isActive: boolean
  }
  userId?: string
  userRole?: string[]
  userPermissions?: string[]
}

// Role guard configuration
export interface RoleGuardConfig {
  jwtSecret: string
  getUserRoles?: (userId: string) => Promise<string[]>
  getUserPermissions?: (userId: string) => Promise<string[]>
  getUserById?: (userId: string) => Promise<any>
  onUnauthorized?: (req: Request, res: Response, reason: string) => void
  onForbidden?: (req: Request, res: Response, reason: string) => void
}

// Default error handlers
const defaultUnauthorized = (req: Request, res: Response, reason: string) => {
  res.status(401).json({ 
    error: 'Unauthorized', 
    message: 'Authentication required',
    reason 
  })
}

const defaultForbidden = (req: Request, res: Response, reason: string) => {
  res.status(403).json({ 
    error: 'Forbidden', 
    message: 'Insufficient permissions',
    reason 
  })
}

/**
 * Creates a role guard middleware factory
 */
export function createRoleGuard(config: RoleGuardConfig) {
  const {
    jwtSecret,
    getUserRoles,
    getUserPermissions,
    getUserById,
    onUnauthorized = defaultUnauthorized,
    onForbidden = defaultForbidden
  } = config

  /**
   * Middleware to check role-based authorization
   */
  return function roleGuard(
    target: any,
    methodName: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ) {
      try {
        // Check if this method requires authorization
        if (!hasRoleRequirements(target, methodName)) {
          return originalMethod.call(this, req, res, next)
        }

        // Get role requirements for this method
        const roleOptions = getRoleMetadata(target, methodName)
        if (!roleOptions) {
          return originalMethod.call(this, req, res, next)
        }

        // Extract and verify JWT token
        const token = extractToken(req)
        if (!token) {
          return onUnauthorized(req, res, 'No token provided')
        }

        let decoded: JwtPayload
        try {
          decoded = verify(token, jwtSecret) as JwtPayload
        } catch (error) {
          return onUnauthorized(req, res, 'Invalid token')
        }

        const userId = decoded.userId || decoded.sub
        if (!userId) {
          return onUnauthorized(req, res, 'Invalid token payload')
        }

        // Load user information
        let userRoles: string[] = []
        let userPermissions: string[] = []

        if (getUserRoles) {
          userRoles = await getUserRoles(userId)
        }

        if (getUserPermissions) {
          userPermissions = await getUserPermissions(userId)
        }

        // Set user information on request
        req.user = {
          id: userId,
          email: decoded.email,
          roles: userRoles,
          permissions: userPermissions,
          isActive: true
        }
        req.userId = userId
        req.userRole = userRoles
        req.userPermissions = userPermissions

        // Check authorization
        const authorized = await checkAuthorization(req, roleOptions, getUserById)
        if (!authorized.allowed) {
          return onForbidden(req, res, authorized.reason)
        }

        // Authorization passed, proceed with original method
        return originalMethod.call(this, req, res, next)
      } catch (error) {
        console.error('Role guard error:', error)
        return res.status(500).json({ 
          error: 'Internal Server Error',
          message: 'Authorization check failed'
        })
      }
    }

    return descriptor
  }
}

/**
 * Express middleware version of role guard
 */
export function createRoleMiddleware(config: RoleGuardConfig) {
  const {
    jwtSecret,
    getUserRoles,
    getUserPermissions,
    getUserById,
    onUnauthorized = defaultUnauthorized,
    onForbidden = defaultForbidden
  } = config

  return function (roleOptions: RoleDecoratorOptions) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        // Extract and verify JWT token
        const token = extractToken(req)
        if (!token) {
          return onUnauthorized(req, res, 'No token provided')
        }

        let decoded: JwtPayload
        try {
          decoded = verify(token, jwtSecret) as JwtPayload
        } catch (error) {
          return onUnauthorized(req, res, 'Invalid token')
        }

        const userId = decoded.userId || decoded.sub
        if (!userId) {
          return onUnauthorized(req, res, 'Invalid token payload')
        }

        // Load user information
        let userRoles: string[] = []
        let userPermissions: string[] = []

        if (getUserRoles) {
          userRoles = await getUserRoles(userId)
        }

        if (getUserPermissions) {
          userPermissions = await getUserPermissions(userId)
        }

        // Set user information on request
        req.user = {
          id: userId,
          email: decoded.email,
          roles: userRoles,
          permissions: userPermissions,
          isActive: true
        }
        req.userId = userId
        req.userRole = userRoles
        req.userPermissions = userPermissions

        // Check authorization
        const authorized = await checkAuthorization(req, roleOptions, getUserById)
        if (!authorized.allowed) {
          return onForbidden(req, res, authorized.reason)
        }

        next()
      } catch (error) {
        console.error('Role middleware error:', error)
        return res.status(500).json({ 
          error: 'Internal Server Error',
          message: 'Authorization check failed'
        })
      }
    }
  }
}

/**
 * Extract JWT token from request headers
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return null
}

/**
 * Check if user is authorized based on role options
 */
async function checkAuthorization(
  req: AuthenticatedRequest,
  options: RoleDecoratorOptions,
  getUserById?: (userId: string) => Promise<any>
): Promise<{ allowed: boolean; reason: string }> {
  const { roles, permissions, requireAll, allowSelf, resourceUserIdParam } = options

  // If no specific requirements, just need to be authenticated
  if (!roles?.length && !permissions?.length && !allowSelf) {
    return { allowed: true, reason: 'Authenticated user' }
  }

  const userRoles = req.user?.roles || []
  const userPermissions = req.user?.permissions || []

  // Check self-access
  if (allowSelf && resourceUserIdParam) {
    const resourceUserId = req.params[resourceUserIdParam] || req.body[resourceUserIdParam]
    if (resourceUserId === req.userId) {
      return { allowed: true, reason: 'Self access allowed' }
    }
  }

  // Check roles
  if (roles?.length) {
    const roleCheck = requireAll
      ? roles.every(role => userRoles.includes(role))
      : roles.some(role => userRoles.includes(role))

    if (!roleCheck) {
      return { 
        allowed: false, 
        reason: `Required roles: ${roles.join(requireAll ? ' AND ' : ' OR ')}`
      }
    }
  }

  // Check permissions
  if (permissions?.length) {
    const permissionCheck = requireAll
      ? permissions.every(permission => userPermissions.includes(permission))
      : permissions.some(permission => userPermissions.includes(permission))

    if (!permissionCheck) {
      return { 
        allowed: false, 
        reason: `Required permissions: ${permissions.join(requireAll ? ' AND ' : ' OR ')}`
      }
    }
  }

  return { allowed: true, reason: 'Authorization requirements met' }
}

// Utility functions for common authorization checks
export const AuthUtils = {
  /**
   * Check if user has admin role
   */
  isAdmin: (req: AuthenticatedRequest): boolean => {
    return req.user?.roles.includes('Administrator') || false
  },

  /**
   * Check if user has moderator role or higher
   */
  isModerator: (req: AuthenticatedRequest): boolean => {
    const userRoles = req.user?.roles || []
    return userRoles.includes('Administrator') || userRoles.includes('Moderator')
  },

  /**
   * Check if user can access resource (self or admin)
   */
  canAccessResource: (req: AuthenticatedRequest, resourceUserId: string): boolean => {
    return req.userId === resourceUserId || AuthUtils.isAdmin(req)
  },

  /**
   * Get user's effective permissions
   */
  getUserPermissions: (req: AuthenticatedRequest): string[] => {
    return req.user?.permissions || []
  },

  /**
   * Check if user has specific permission
   */
  hasPermission: (req: AuthenticatedRequest, permission: string): boolean => {
    return req.user?.permissions.includes(permission) || false
  }
}