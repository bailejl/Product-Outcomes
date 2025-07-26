import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'

export enum UserRole {
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
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole

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
