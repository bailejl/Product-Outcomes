import React, { ReactNode } from 'react'

// Types for user and role information
export interface UserWithRoles {
  id: string
  email: string
  roles: Array<{
    id: string
    name: string
    permissions: string[]
    isActive: boolean
  }>
  permissions?: string[]
  isActive: boolean
}

// Props for role-based components
export interface RoleGuardProps {
  children: ReactNode
  user?: UserWithRoles | null
  roles?: string[]
  permissions?: string[]
  requireAll?: boolean
  allowSelf?: boolean
  resourceUserId?: string
  fallback?: ReactNode
  loading?: ReactNode
}

// Context for sharing user and role information
export interface AuthContextType {
  user: UserWithRoles | null
  isLoading: boolean
  hasRole: (roleName: string) => boolean
  hasAnyRole: (roleNames: string[]) => boolean
  hasAllRoles: (roleNames: string[]) => boolean
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  isAdmin: () => boolean
  isModerator: () => boolean
  canAccessResource: (resourceUserId: string) => boolean
}

export const AuthContext = React.createContext<AuthContextType | null>(null)

// Hook to access auth context
export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Auth provider component
export interface AuthProviderProps {
  children: ReactNode
  user: UserWithRoles | null
  isLoading?: boolean
}

export function AuthProvider({ children, user, isLoading = false }: AuthProviderProps) {
  const hasRole = React.useCallback((roleName: string): boolean => {
    return user?.roles?.some(role => role.name === roleName && role.isActive) || false
  }, [user])

  const hasAnyRole = React.useCallback((roleNames: string[]): boolean => {
    return roleNames.some(roleName => hasRole(roleName))
  }, [hasRole])

  const hasAllRoles = React.useCallback((roleNames: string[]): boolean => {
    return roleNames.every(roleName => hasRole(roleName))
  }, [hasRole])

  const getUserPermissions = React.useCallback((): string[] => {
    if (!user?.roles) return []
    
    const permissions = new Set<string>()
    user.roles
      .filter(role => role.isActive)
      .forEach(role => {
        role.permissions.forEach(permission => permissions.add(permission))
      })
    
    return Array.from(permissions)
  }, [user])

  const hasPermission = React.useCallback((permission: string): boolean => {
    const userPermissions = getUserPermissions()
    return userPermissions.includes(permission)
  }, [getUserPermissions])

  const hasAnyPermission = React.useCallback((permissions: string[]): boolean => {
    return permissions.some(permission => hasPermission(permission))
  }, [hasPermission])

  const hasAllPermissions = React.useCallback((permissions: string[]): boolean => {
    return permissions.every(permission => hasPermission(permission))
  }, [hasPermission])

  const isAdmin = React.useCallback((): boolean => {
    return hasRole('Administrator') || hasPermission('system:config')
  }, [hasRole, hasPermission])

  const isModerator = React.useCallback((): boolean => {
    return hasRole('Moderator') || hasRole('Administrator') || hasPermission('moderate:message')
  }, [hasRole, hasPermission])

  const canAccessResource = React.useCallback((resourceUserId: string): boolean => {
    return user?.id === resourceUserId || isAdmin()
  }, [user?.id, isAdmin])

  const contextValue: AuthContextType = {
    user,
    isLoading,
    hasRole,
    hasAnyRole,
    hasAllRoles,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin,
    isModerator,
    canAccessResource,
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

// Main RoleGuard component
export function RoleGuard({
  children,
  user: propUser,
  roles,
  permissions,
  requireAll = false,
  allowSelf = false,
  resourceUserId,
  fallback = null,
  loading = null,
}: RoleGuardProps) {
  // Use context user if no user prop provided
  const auth = React.useContext(AuthContext)
  const user = propUser || auth?.user

  // Show loading state
  if (auth?.isLoading && loading) {
    return <>{loading}</>
  }

  // If no user, deny access
  if (!user || !user.isActive) {
    return <>{fallback}</>
  }

  // Check self access
  if (allowSelf && resourceUserId && user.id === resourceUserId) {
    return <>{children}</>
  }

  // If no specific requirements, allow any authenticated user
  if (!roles?.length && !permissions?.length) {
    return <>{children}</>
  }

  // Check roles
  if (roles?.length) {
    const userRoles = user.roles?.filter(r => r.isActive).map(r => r.name) || []
    const roleCheck = requireAll
      ? roles.every(role => userRoles.includes(role))
      : roles.some(role => userRoles.includes(role))

    if (!roleCheck) {
      return <>{fallback}</>
    }
  }

  // Check permissions
  if (permissions?.length) {
    const userPermissions = new Set<string>()
    user.roles?.filter(r => r.isActive).forEach(role => {
      role.permissions.forEach(permission => userPermissions.add(permission))
    })

    const permissionCheck = requireAll
      ? permissions.every(permission => userPermissions.has(permission))
      : permissions.some(permission => userPermissions.has(permission))

    if (!permissionCheck) {
      return <>{fallback}</>
    }
  }

  return <>{children}</>
}

// Convenience components for common role checks
export interface AdminOnlyProps {
  children: ReactNode
  fallback?: ReactNode
}

export function AdminOnly({ children, fallback = null }: AdminOnlyProps) {
  return (
    <RoleGuard roles={['Administrator']} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

export function ModeratorOrAdmin({ children, fallback = null }: AdminOnlyProps) {
  return (
    <RoleGuard roles={['Administrator', 'Moderator']} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

export function AuthenticatedOnly({ children, fallback = null }: AdminOnlyProps) {
  return (
    <RoleGuard fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

// Permission-based guards
export interface PermissionGuardProps {
  children: ReactNode
  permission: string
  fallback?: ReactNode
}

export function PermissionGuard({ children, permission, fallback = null }: PermissionGuardProps) {
  return (
    <RoleGuard permissions={[permission]} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

// Self-access guard
export interface SelfAccessGuardProps {
  children: ReactNode
  resourceUserId: string
  fallback?: ReactNode
  allowAdmin?: boolean
}

export function SelfAccessGuard({ 
  children, 
  resourceUserId, 
  fallback = null,
  allowAdmin = true 
}: SelfAccessGuardProps) {
  const auth = useAuth()
  
  const canAccess = auth.user?.id === resourceUserId || (allowAdmin && auth.isAdmin())
  
  if (!canAccess) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

// Higher-order component for role-based access
export function withRoleGuard<P extends object>(
  Component: React.ComponentType<P>,
  guardProps: Omit<RoleGuardProps, 'children'>
) {
  return function GuardedComponent(props: P) {
    return (
      <RoleGuard {...guardProps}>
        <Component {...props} />
      </RoleGuard>
    )
  }
}

// Hook for imperative role checking
export function useRoleCheck() {
  const auth = useAuth()
  
  return {
    hasRole: auth.hasRole,
    hasAnyRole: auth.hasAnyRole,
    hasAllRoles: auth.hasAllRoles,
    hasPermission: auth.hasPermission,
    hasAnyPermission: auth.hasAnyPermission,
    hasAllPermissions: auth.hasAllPermissions,
    isAdmin: auth.isAdmin,
    isModerator: auth.isModerator,
    canAccessResource: auth.canAccessResource,
    user: auth.user,
  }
}