import { ForbiddenError } from '@apollo/server'
import { createMethodDecorator } from 'type-graphql'
import { GraphQLContext } from '../context'

export function RequirePermission(permissions: string | string[]) {
  return createMethodDecorator<GraphQLContext>(async ({ context }, next) => {
    if (!context.user) {
      throw new ForbiddenError('Authentication required')
    }

    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions]
    
    // Check if user has any of the required permissions
    const hasPermission = requiredPermissions.some(permission => 
      context.user!.hasPermission(permission)
    )

    if (!hasPermission) {
      throw new ForbiddenError(`Access denied. Required permission: ${requiredPermissions.join(' or ')}`)
    }

    return next()
  })
}

export function RequireAnyPermission(permissions: string[]) {
  return RequirePermission(permissions)
}

export function RequireAllPermissions(permissions: string[]) {
  return createMethodDecorator<GraphQLContext>(async ({ context }, next) => {
    if (!context.user) {
      throw new ForbiddenError('Authentication required')
    }

    // Check if user has all required permissions
    const hasAllPermissions = permissions.every(permission => 
      context.user!.hasPermission(permission)
    )

    if (!hasAllPermissions) {
      throw new ForbiddenError(`Access denied. Required permissions: ${permissions.join(', ')}`)
    }

    return next()
  })
}

// Resource-based authorization
export function RequireResourceAccess() {
  return createMethodDecorator<GraphQLContext>(async ({ context, args }, next) => {
    if (!context.user) {
      throw new ForbiddenError('Authentication required')
    }

    // For resource-based access, we'll implement the logic in individual resolvers
    // This decorator serves as a marker that the resolver handles its own authorization
    return next()
  })
}