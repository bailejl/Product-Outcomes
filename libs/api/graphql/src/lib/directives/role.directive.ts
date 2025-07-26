import { ForbiddenError } from '@apollo/server'
import { createMethodDecorator } from 'type-graphql'
import { GraphQLContext } from '../context'

export function RequireRole(roles: string | string[]) {
  return createMethodDecorator<GraphQLContext>(async ({ context }, next) => {
    if (!context.user) {
      throw new ForbiddenError('Authentication required')
    }

    const requiredRoles = Array.isArray(roles) ? roles : [roles]
    
    // Check if user has any of the required roles
    const hasRole = requiredRoles.some(role => 
      context.user!.hasRole(role) || 
      (role === 'admin' && context.user!.isAdmin()) ||
      (role === 'moderator' && context.user!.isModerator())
    )

    if (!hasRole) {
      throw new ForbiddenError(`Access denied. Required role: ${requiredRoles.join(' or ')}`)
    }

    return next()
  })
}

export function RequireAnyRole(roles: string[]) {
  return RequireRole(roles)
}

export function RequireAllRoles(roles: string[]) {
  return createMethodDecorator<GraphQLContext>(async ({ context }, next) => {
    if (!context.user) {
      throw new ForbiddenError('Authentication required')
    }

    // Check if user has all required roles
    const hasAllRoles = roles.every(role => 
      context.user!.hasRole(role) || 
      (role === 'admin' && context.user!.isAdmin()) ||
      (role === 'moderator' && context.user!.isModerator())
    )

    if (!hasAllRoles) {
      throw new ForbiddenError(`Access denied. Required roles: ${roles.join(', ')}`)
    }

    return next()
  })
}

// Convenience decorators for common roles
export function AdminOnly() {
  return RequireRole('admin')
}

export function ModeratorOnly() {
  return RequireRole(['admin', 'moderator'])
}