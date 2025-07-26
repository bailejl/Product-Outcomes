import { Request, Response, NextFunction } from 'express'

// Custom decorator interface for Express routes
export interface RoleDecoratorOptions {
  roles?: string[]
  permissions?: string[]
  requireAll?: boolean // If true, user must have ALL roles/permissions, otherwise ANY
  allowSelf?: boolean // If true, user can access their own resources
  resourceUserIdParam?: string // Parameter name that contains the user ID to check for self access
}

// Decorator function type
export type RoleDecorator = (
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) => void

// Storage for role metadata
const ROLE_METADATA_KEY = Symbol('roles')

// Store role requirements for a method
export function setRoleMetadata(target: any, key: string, options: RoleDecoratorOptions): void {
  Reflect.defineMetadata(ROLE_METADATA_KEY, options, target, key)
}

// Retrieve role requirements for a method
export function getRoleMetadata(target: any, key: string): RoleDecoratorOptions | undefined {
  return Reflect.getMetadata(ROLE_METADATA_KEY, target, key)
}

/**
 * Requires user to have specific roles
 * @param roles Array of role names required
 * @param requireAll If true, user must have ALL roles (default: false - ANY role)
 */
export function RequireRoles(roles: string[], requireAll = false): RoleDecorator {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    setRoleMetadata(target, propertyKey, { roles, requireAll })
  }
}

/**
 * Requires user to have specific permissions
 * @param permissions Array of permissions required
 * @param requireAll If true, user must have ALL permissions (default: false - ANY permission)
 */
export function RequirePermissions(permissions: string[], requireAll = false): RoleDecorator {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    setRoleMetadata(target, propertyKey, { permissions, requireAll })
  }
}

/**
 * Combined role and permission decorator
 * @param options Full options for role-based access control
 */
export function RequireAuth(options: RoleDecoratorOptions): RoleDecorator {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    setRoleMetadata(target, propertyKey, options)
  }
}

/**
 * Allows user to access only their own resources
 * @param userIdParam Parameter name that contains the user ID (default: 'userId')
 */
export function AllowSelfOnly(userIdParam = 'userId'): RoleDecorator {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    setRoleMetadata(target, propertyKey, { 
      allowSelf: true, 
      resourceUserIdParam: userIdParam 
    })
  }
}

/**
 * Requires admin role
 */
export function RequireAdmin(): RoleDecorator {
  return RequireRoles(['Administrator'])
}

/**
 * Requires moderator role or higher
 */
export function RequireModerator(): RoleDecorator {
  return RequireRoles(['Administrator', 'Moderator'])
}

/**
 * Decorator for routes that require authentication but no specific roles
 */
export function RequireAuthentication(): RoleDecorator {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    setRoleMetadata(target, propertyKey, {})
  }
}

// Utility function to check if method has role requirements
export function hasRoleRequirements(target: any, methodName: string): boolean {
  return getRoleMetadata(target, methodName) !== undefined
}

// Export commonly used role combinations
export const CommonRoles = {
  ADMIN_ONLY: ['Administrator'],
  ADMIN_OR_MODERATOR: ['Administrator', 'Moderator'],
  ALL_AUTHENTICATED: [], // Empty array means any authenticated user
} as const

// Export commonly used permissions
export const CommonPermissions = {
  USER_MANAGEMENT: ['create:user', 'read:user', 'update:user', 'delete:user'],
  CONTENT_MODERATION: ['moderate:message', 'delete:message'],
  SYSTEM_ACCESS: ['system:config', 'system:logs'],
  READ_ONLY: ['read:user', 'read:message'],
} as const