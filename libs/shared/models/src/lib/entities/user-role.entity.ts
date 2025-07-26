import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  Index,
} from 'typeorm'

// Enum for built-in system permissions
export enum Permission {
  // User management
  CREATE_USER = 'create:user',
  READ_USER = 'read:user',
  UPDATE_USER = 'update:user',
  DELETE_USER = 'delete:user',
  
  // Role management
  CREATE_ROLE = 'create:role',
  READ_ROLE = 'read:role',
  UPDATE_ROLE = 'update:role',
  DELETE_ROLE = 'delete:role',
  ASSIGN_ROLE = 'assign:role',
  
  // Message management
  CREATE_MESSAGE = 'create:message',
  READ_MESSAGE = 'read:message',
  UPDATE_MESSAGE = 'update:message',
  DELETE_MESSAGE = 'delete:message',
  MODERATE_MESSAGE = 'moderate:message',
  
  // System administration
  SYSTEM_CONFIG = 'system:config',
  SYSTEM_LOGS = 'system:logs',
  SYSTEM_BACKUP = 'system:backup',
  
  // Organization management
  CREATE_ORG = 'create:organization',
  READ_ORG = 'read:organization',
  UPDATE_ORG = 'update:organization',
  DELETE_ORG = 'delete:organization',
  
  // Reports and analytics
  VIEW_REPORTS = 'view:reports',
  EXPORT_DATA = 'export:data',
}

@Entity('user_roles')
@Index(['name'], { unique: true })
export class UserRole {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ unique: true, length: 100 })
  name!: string

  @Column({ length: 500, nullable: true })
  description?: string

  @Column({
    type: 'text',
    array: true,
    default: () => "'{}'"
  })
  permissions!: Permission[]

  @Column({ name: 'is_system_role', default: false })
  isSystemRole!: boolean

  @Column({ name: 'is_active', default: true })
  isActive!: boolean

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  // Convenience methods for permission management
  hasPermission(permission: Permission): boolean {
    return this.permissions.includes(permission)
  }

  hasAnyPermission(permissions: Permission[]): boolean {
    return permissions.some(permission => this.permissions.includes(permission))
  }

  hasAllPermissions(permissions: Permission[]): boolean {
    return permissions.every(permission => this.permissions.includes(permission))
  }

  addPermission(permission: Permission): void {
    if (!this.hasPermission(permission)) {
      this.permissions.push(permission)
    }
  }

  removePermission(permission: Permission): void {
    this.permissions = this.permissions.filter(p => p !== permission)
  }

  addPermissions(permissions: Permission[]): void {
    permissions.forEach(permission => this.addPermission(permission))
  }

  removePermissions(permissions: Permission[]): void {
    permissions.forEach(permission => this.removePermission(permission))
  }

  // Static methods for creating common roles
  static createAdminRole(): Partial<UserRole> {
    return {
      name: 'Administrator',
      description: 'Full system access with all permissions',
      permissions: Object.values(Permission),
      isSystemRole: true,
      isActive: true,
    }
  }

  static createModeratorRole(): Partial<UserRole> {
    return {
      name: 'Moderator',
      description: 'Content moderation and user management capabilities',
      permissions: [
        Permission.READ_USER,
        Permission.UPDATE_USER,
        Permission.READ_MESSAGE,
        Permission.UPDATE_MESSAGE,
        Permission.DELETE_MESSAGE,
        Permission.MODERATE_MESSAGE,
        Permission.VIEW_REPORTS,
      ],
      isSystemRole: true,
      isActive: true,
    }
  }

  static createUserRole(): Partial<UserRole> {
    return {
      name: 'User',
      description: 'Standard user with basic permissions',
      permissions: [
        Permission.READ_USER,
        Permission.UPDATE_USER, // Can update own profile
        Permission.CREATE_MESSAGE,
        Permission.READ_MESSAGE,
        Permission.UPDATE_MESSAGE, // Can update own messages
      ],
      isSystemRole: true,
      isActive: true,
    }
  }

  static createViewerRole(): Partial<UserRole> {
    return {
      name: 'Viewer',
      description: 'Read-only access to system',
      permissions: [
        Permission.READ_USER,
        Permission.READ_MESSAGE,
      ],
      isSystemRole: true,
      isActive: true,
    }
  }
}