import React, { ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'

interface RoleBasedAccessProps {
  children: ReactNode
  allowedRoles: ('admin' | 'user' | 'moderator')[]
  fallback?: ReactNode
  requireAuth?: boolean
}

/**
 * Component for role-based access control
 * Shows children only if user has one of the allowed roles
 */
export function RoleBasedAccess({
  children,
  allowedRoles,
  fallback = null,
  requireAuth = true,
}: RoleBasedAccessProps) {
  const { state } = useAuth()

  // If authentication is required but user is not authenticated
  if (requireAuth && !state.isAuthenticated) {
    return <>{fallback}</>
  }

  // If user is authenticated and has one of the allowed roles
  if (state.user && allowedRoles.includes(state.user.role)) {
    return <>{children}</>
  }

  // If user doesn't have required role, show fallback
  return <>{fallback}</>
}

// Convenience components for common role checks
export function AdminOnly({
  children,
  fallback = null,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  return (
    <RoleBasedAccess allowedRoles={['admin']} fallback={fallback}>
      {children}
    </RoleBasedAccess>
  )
}

export function ModeratorOrAdmin({
  children,
  fallback = null,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  return (
    <RoleBasedAccess allowedRoles={['admin', 'moderator']} fallback={fallback}>
      {children}
    </RoleBasedAccess>
  )
}

export function AuthenticatedOnly({
  children,
  fallback = null,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  return (
    <RoleBasedAccess
      allowedRoles={['admin', 'moderator', 'user']}
      fallback={fallback}
      requireAuth={true}
    >
      {children}
    </RoleBasedAccess>
  )
}

// Hook for role-based logic in components
export function useRoleAccess() {
  const { state } = useAuth()

  const hasRole = (role: 'admin' | 'user' | 'moderator') => {
    return state.user?.role === role
  }

  const hasAnyRole = (roles: ('admin' | 'user' | 'moderator')[]) => {
    return state.user ? roles.includes(state.user.role) : false
  }

  const isAdmin = () => hasRole('admin')
  const isModerator = () => hasRole('moderator')
  const isUser = () => hasRole('user')
  const isModeratorOrAdmin = () => hasAnyRole(['admin', 'moderator'])

  return {
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    hasRole,
    hasAnyRole,
    isAdmin,
    isModerator,
    isUser,
    isModeratorOrAdmin,
  }
}