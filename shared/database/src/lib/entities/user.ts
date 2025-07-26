import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToMany,
  JoinTable,
} from 'typeorm'
import { UserRole } from '@product-outcomes/shared-models'

export enum LegacyUserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator',
}

@Entity('users')
@Index(['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true, length: 255 })
  email: string

  @Column({ length: 255 })
  password: string

  @Column({ name: 'first_name', length: 100 })
  firstName: string

  @Column({ name: 'last_name', length: 100 })
  lastName: string

  @Column({
    type: 'enum',
    enum: LegacyUserRole,
    default: LegacyUserRole.USER,
    nullable: true,
  })
  legacyRole?: LegacyUserRole

  @ManyToMany(() => UserRole, { eager: true })
  @JoinTable({
    name: 'user_role_assignments',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: UserRole[]

  @Column({ name: 'is_active', default: true })
  isActive: boolean

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean

  @Column({ name: 'email_verification_token', nullable: true, length: 255 })
  emailVerificationToken?: string

  @Column({ name: 'password_reset_token', nullable: true, length: 255 })
  passwordResetToken?: string

  @Column({ name: 'password_reset_expires', nullable: true })
  passwordResetExpires?: Date

  @Column({ name: 'last_login_at', nullable: true })
  lastLoginAt?: Date

  @Column({ name: 'login_attempts', default: 0 })
  loginAttempts: number

  @Column({ name: 'locked_until', nullable: true })
  lockedUntil?: Date

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  // Virtual properties for computed values
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim()
  }

  get isLocked(): boolean {
    return !!(this.lockedUntil && this.lockedUntil > new Date())
  }

  get canAttemptLogin(): boolean {
    return this.isActive && !this.isLocked && this.loginAttempts < 5
  }

  // Method to increment login attempts
  incrementLoginAttempts(): void {
    this.loginAttempts += 1

    // Lock account after 5 failed attempts for 30 minutes
    if (this.loginAttempts >= 5) {
      this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    }
  }

  // Method to reset login attempts on successful login
  resetLoginAttempts(): void {
    this.loginAttempts = 0
    this.lockedUntil = undefined
    this.lastLoginAt = new Date()
  }

  // Method to generate email verification token
  generateEmailVerificationToken(): string {
    const token = this.generateRandomToken()
    this.emailVerificationToken = token
    return token
  }

  // Method to generate password reset token
  generatePasswordResetToken(): string {
    const token = this.generateRandomToken()
    this.passwordResetToken = token
    this.passwordResetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    return token
  }

  // Method to verify password reset token
  isPasswordResetTokenValid(token: string): boolean {
    return !!(
      this.passwordResetToken === token &&
      this.passwordResetExpires &&
      this.passwordResetExpires > new Date()
    )
  }

  // Method to clear password reset token
  clearPasswordResetToken(): void {
    this.passwordResetToken = undefined
    this.passwordResetExpires = undefined
  }

  // Method to verify email
  verifyEmail(): void {
    this.emailVerified = true
    this.emailVerificationToken = undefined
  }

  // Role-based authorization methods
  hasRole(roleName: string): boolean {
    return this.roles?.some(role => role.name === roleName && role.isActive) || false
  }

  hasAnyRole(roleNames: string[]): boolean {
    return roleNames.some(roleName => this.hasRole(roleName))
  }

  hasAllRoles(roleNames: string[]): boolean {
    return roleNames.every(roleName => this.hasRole(roleName))
  }

  hasPermission(permission: string): boolean {
    return this.roles?.some(role => 
      role.isActive && role.hasPermission(permission as any)
    ) || false
  }

  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(permission))
  }

  hasAllPermissions(permissions: string[]): boolean {
    return permissions.every(permission => this.hasPermission(permission))
  }

  addRole(role: UserRole): void {
    if (!this.roles) {
      this.roles = []
    }
    if (!this.hasRole(role.name)) {
      this.roles.push(role)
    }
  }

  removeRole(roleName: string): void {
    if (this.roles) {
      this.roles = this.roles.filter(role => role.name !== roleName)
    }
  }

  // Get all permissions from all assigned roles
  getAllPermissions(): string[] {
    if (!this.roles) return []
    
    const permissions = new Set<string>()
    this.roles
      .filter(role => role.isActive)
      .forEach(role => {
        role.permissions.forEach(permission => permissions.add(permission))
      })
    
    return Array.from(permissions)
  }

  // Check if user is admin (has admin role or admin permissions)
  isAdmin(): boolean {
    return this.hasRole('Administrator') || 
           this.hasPermission('system:config') ||
           this.legacyRole === LegacyUserRole.ADMIN
  }

  // Check if user is moderator
  isModerator(): boolean {
    return this.hasRole('Moderator') || 
           this.hasPermission('moderate:message') ||
           this.legacyRole === LegacyUserRole.MODERATOR
  }

  // Private method to generate random tokens
  private generateRandomToken(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    for (let i = 0; i < 32; i++) {
      token += chars[Math.floor(Math.random() * chars.length)]
    }
    return token
  }
}
