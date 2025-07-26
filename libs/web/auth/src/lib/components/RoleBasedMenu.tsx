import React, { ReactNode } from 'react'
import { useAuth, RoleGuard } from './RoleGuard'

// Types for menu items
export interface MenuItem {
  id: string
  label: string
  icon?: ReactNode
  href?: string
  onClick?: () => void
  roles?: string[]
  permissions?: string[]
  requireAll?: boolean
  children?: MenuItem[]
  divider?: boolean
  disabled?: boolean
}

export interface RoleBasedMenuProps {
  items: MenuItem[]
  className?: string
  renderItem?: (item: MenuItem, index: number) => ReactNode
  renderDivider?: (index: number) => ReactNode
  onItemClick?: (item: MenuItem) => void
}

// Default item renderer
function DefaultMenuItemRenderer({ 
  item, 
  index, 
  onItemClick 
}: { 
  item: MenuItem
  index: number
  onItemClick?: (item: MenuItem) => void
}) {
  const handleClick = () => {
    if (item.onClick) {
      item.onClick()
    }
    if (onItemClick) {
      onItemClick(item)
    }
  }

  if (item.divider) {
    return (
      <div key={`divider-${index}`} className="border-t border-gray-200 my-1" />
    )
  }

  const itemClass = `
    flex items-center px-4 py-2 text-sm cursor-pointer hover:bg-gray-100
    ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}
  `.trim()

  const content = (
    <div className={itemClass} onClick={item.disabled ? undefined : handleClick}>
      {item.icon && <span className="mr-3">{item.icon}</span>}
      <span>{item.label}</span>
    </div>
  )

  if (item.href && !item.disabled) {
    return (
      <a key={item.id} href={item.href} className="block">
        {content}
      </a>
    )
  }

  return <div key={item.id}>{content}</div>
}

// Role-based menu component
export function RoleBasedMenu({
  items,
  className = '',
  renderItem,
  renderDivider,
  onItemClick,
}: RoleBasedMenuProps) {
  const auth = useAuth()

  const filterMenuItem = (item: MenuItem): boolean => {
    // Always show dividers
    if (item.divider) return true

    // Check if user has required roles
    if (item.roles?.length) {
      const hasRole = item.requireAll
        ? auth.hasAllRoles(item.roles)
        : auth.hasAnyRole(item.roles)
      if (!hasRole) return false
    }

    // Check if user has required permissions
    if (item.permissions?.length) {
      const hasPermission = item.requireAll
        ? auth.hasAllPermissions(item.permissions)
        : auth.hasAnyPermission(item.permissions)
      if (!hasPermission) return false
    }

    return true
  }

  const renderMenuItem = (item: MenuItem, index: number): ReactNode => {
    // Use custom renderer if provided
    if (renderItem) {
      return renderItem(item, index)
    }

    // Handle dividers
    if (item.divider) {
      return renderDivider ? renderDivider(index) : (
        <div key={`divider-${index}`} className="border-t border-gray-200 my-1" />
      )
    }

    // Render menu item with role guard
    return (
      <RoleGuard
        key={item.id}
        roles={item.roles}
        permissions={item.permissions}
        requireAll={item.requireAll}
      >
        <DefaultMenuItemRenderer
          item={item}
          index={index}
          onItemClick={onItemClick}
        />
      </RoleGuard>
    )
  }

  const visibleItems = items.filter(filterMenuItem)

  return (
    <div className={`bg-white shadow-lg rounded-lg ${className}`}>
      {visibleItems.map((item, index) => renderMenuItem(item, index))}
    </div>
  )
}

// Navigation bar with role-based items
export interface RoleBasedNavProps {
  brand?: ReactNode
  items: MenuItem[]
  className?: string
  mobileMenuButton?: ReactNode
  userMenu?: ReactNode
}

export function RoleBasedNav({
  brand,
  items,
  className = '',
  mobileMenuButton,
  userMenu,
}: RoleBasedNavProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)

  return (
    <nav className={`bg-white shadow-lg ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Brand */}
          <div className="flex items-center">
            {brand}
          </div>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center space-x-4">
            {items.map((item, index) => (
              <RoleGuard
                key={item.id}
                roles={item.roles}
                permissions={item.permissions}
                requireAll={item.requireAll}
              >
                <a
                  href={item.href}
                  onClick={item.onClick}
                  className={`
                    px-3 py-2 rounded-md text-sm font-medium
                    hover:bg-gray-100 transition-colors
                    ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {item.icon && <span className="mr-2">{item.icon}</span>}
                  {item.label}
                </a>
              </RoleGuard>
            ))}
            {userMenu}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            {mobileMenuButton || (
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-md hover:bg-gray-100"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-2">
            {items.map((item, index) => (
              <RoleGuard
                key={item.id}
                roles={item.roles}
                permissions={item.permissions}
                requireAll={item.requireAll}
              >
                <a
                  href={item.href}
                  onClick={item.onClick}
                  className="block px-4 py-2 text-sm hover:bg-gray-100"
                >
                  {item.icon && <span className="mr-2">{item.icon}</span>}
                  {item.label}
                </a>
              </RoleGuard>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}

// Utility function to create common menu structures
export const MenuUtils = {
  createAdminSection: (items: Omit<MenuItem, 'roles'>[]): MenuItem[] => {
    return items.map(item => ({
      ...item,
      roles: ['Administrator'],
    }))
  },

  createModeratorSection: (items: Omit<MenuItem, 'roles'>[]): MenuItem[] => {
    return items.map(item => ({
      ...item,
      roles: ['Administrator', 'Moderator'],
    }))
  },

  createUserSection: (items: Omit<MenuItem, 'roles'>[]): MenuItem[] => {
    return items.map(item => ({
      ...item,
      roles: ['Administrator', 'Moderator', 'User'],
    }))
  },

  createPermissionSection: (permission: string, items: Omit<MenuItem, 'permissions'>[]): MenuItem[] => {
    return items.map(item => ({
      ...item,
      permissions: [permission],
    }))
  },

  addDivider: (id: string): MenuItem => ({
    id,
    label: '',
    divider: true,
  }),
}

// Common menu items
export const CommonMenuItems = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
  },
  
  users: {
    id: 'users',
    label: 'Users',
    href: '/users',
    permissions: ['read:user'],
  },
  
  userManagement: {
    id: 'user-management',
    label: 'User Management',
    href: '/admin/users',
    permissions: ['create:user', 'update:user', 'delete:user'],
    requireAll: false,
  },
  
  roleManagement: {
    id: 'role-management',
    label: 'Role Management',
    href: '/admin/roles',
    permissions: ['create:role', 'update:role', 'delete:role'],
    requireAll: false,
  },
  
  systemSettings: {
    id: 'system-settings',
    label: 'System Settings',
    href: '/admin/settings',
    permissions: ['system:config'],
  },
  
  reports: {
    id: 'reports',
    label: 'Reports',
    href: '/reports',
    permissions: ['view:reports'],
  },
  
  profile: {
    id: 'profile',
    label: 'Profile',
    href: '/profile',
  },
  
  logout: {
    id: 'logout',
    label: 'Logout',
    onClick: () => {
      // Implement logout logic
      console.log('Logout clicked')
    },
  },
}