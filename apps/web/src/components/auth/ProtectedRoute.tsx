import React, { ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'

interface ProtectedRouteProps {
  children: ReactNode | ((user: any) => ReactNode)
  fallback?: ReactNode
  loading?: ReactNode
  requireRole?: 'admin' | 'user' | 'moderator'
  requiredRole?: 'admin' | 'user' | 'moderator' | ('admin' | 'user' | 'moderator')[]
}

export function ProtectedRoute({
  children,
  fallback,
  loading,
  requireRole,
  requiredRole,
}: ProtectedRouteProps) {
  const { state } = useAuth()

  // Support both requireRole and requiredRole for backward compatibility
  const roleToCheck = requiredRole || requireRole

  // Loading state
  if (state.isLoading) {
    if (loading) {
      return <>{loading}</>
    }
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Not authenticated
  if (!state.isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>
    }
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="text-gray-500 text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Authentication Required
          </h2>
          <p className="text-gray-600">
            Please sign in to access this content.
          </p>
        </div>
      </div>
    )
  }

  // Role-based access control
  if (roleToCheck) {
    const hasRequiredRole = Array.isArray(roleToCheck)
      ? roleToCheck.includes(state.user?.role as any)
      : state.user?.role === roleToCheck

    if (!hasRequiredRole) {
      if (fallback) {
        return <>{fallback}</>
      }
      return (
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600">
              You do not have permission to access this content.
            </p>
          </div>
        </div>
      )
    }
  }

  // Render children - support function children pattern
  if (typeof children === 'function') {
    return <>{children(state.user)}</>
  }

  return <>{children}</>
}
