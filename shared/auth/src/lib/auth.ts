// Main authentication service that combines all auth functionality
import { JwtService } from './jwt.service'
import { PasswordService } from './password.service'
import { EmailService } from './email.service'
import { AuthMiddleware } from './middleware'
import {
  User,
  UserRole,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  AuthTokens,
  JwtPayload,
  PasswordResetRequest,
  PasswordResetConfirm,
} from './types'

export class AuthService {
  public readonly jwt: JwtService
  public readonly password: PasswordService
  public readonly email: EmailService
  public readonly middleware: AuthMiddleware

  constructor() {
    this.jwt = new JwtService()
    this.password = new PasswordService()
    this.email = new EmailService()
    this.middleware = new AuthMiddleware()
  }

  /**
   * Authenticate user with email and password
   * Returns tokens if successful, throws error if failed
   */
  async authenticateUser(
    email: string,
    password: string,
    getUserByEmail: (email: string) => Promise<User | null>,
    updateLastLogin: (userId: string) => Promise<void>
  ): Promise<AuthResponse> {
    // Find user by email
    const user = await getUserByEmail(email.toLowerCase())
    if (!user) {
      throw new Error('Invalid email or password')
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is deactivated')
    }

    // Verify password
    if (!user.password) {
      throw new Error('User has no password set')
    }

    const isValidPassword = await this.password.comparePassword(
      password,
      user.password
    )
    if (!isValidPassword) {
      throw new Error('Invalid email or password')
    }

    // Update last login
    await updateLastLogin(user.id)

    // Generate tokens
    const userWithoutPassword = this.excludePassword(user)
    const tokens = this.jwt.generateTokens(userWithoutPassword)

    return {
      user: userWithoutPassword,
      tokens,
    }
  }

  /**
   * Register a new user
   */
  async registerUser(
    request: RegisterRequest,
    createUser: (
      userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>
    ) => Promise<User>
  ): Promise<AuthResponse> {
    // Validate email format
    if (!this.validateEmail(request.email)) {
      throw new Error('Invalid email format')
    }

    // Validate password strength
    const passwordValidation = this.password.validatePasswordStrength(
      request.password
    )
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.errors.join(', '))
    }

    // Hash password
    const hashedPassword = await this.password.hashPassword(request.password)

    // Create user data
    const userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'> = {
      email: request.email.toLowerCase(),
      password: hashedPassword,
      firstName: request.firstName.trim(),
      lastName: request.lastName.trim(),
      role: UserRole.USER,
      isActive: true,
      emailVerified: false,
      loginAttempts: 0,
    }

    // Create user
    const user = await createUser(userData)

    // Generate tokens
    const userWithoutPassword = this.excludePassword(user)
    const tokens = this.jwt.generateTokens(userWithoutPassword)

    return {
      user: userWithoutPassword,
      tokens,
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(
    refreshToken: string,
    getUserById: (userId: string) => Promise<User | null>
  ): Promise<AuthTokens> {
    // Verify refresh token
    const payload = this.jwt.verifyRefreshToken(refreshToken)

    // Check if user still exists and is active
    const user = await getUserById(payload.userId)
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive')
    }

    // Generate new tokens
    const userWithoutPassword = this.excludePassword(user)
    return this.jwt.generateTokens(userWithoutPassword)
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Request password reset - generates token and sends email
   */
  async requestPasswordReset(
    request: PasswordResetRequest,
    getUserByEmail: (email: string) => Promise<User | null>,
    updateUser: (userId: string, updates: Partial<User>) => Promise<User>
  ): Promise<{ message: string }> {
    // Validate email format
    if (!this.validateEmail(request.email)) {
      throw new Error('Invalid email format')
    }

    // Find user by email
    const user = await getUserByEmail(request.email.toLowerCase())
    if (!user) {
      // Don't reveal if email exists for security
      return { message: 'If the email exists, a password reset link has been sent' }
    }

    // Check if user is active
    if (!user.isActive) {
      return { message: 'If the email exists, a password reset link has been sent' }
    }

    // Generate reset token (using User entity method)
    const resetToken = this.generateSecureToken()
    const resetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Update user with reset token
    await updateUser(user.id, {
      passwordResetToken: resetToken,
      passwordResetExpires: resetExpires
    })

    try {
      // Send reset email
      await this.email.sendPasswordResetEmail(
        user.email,
        resetToken,
        user.firstName
      )
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError)
      // Clear the reset token if email fails
      await updateUser(user.id, {
        passwordResetToken: undefined,
        passwordResetExpires: undefined
      })
      throw new Error('Failed to send password reset email')
    }

    return { message: 'If the email exists, a password reset link has been sent' }
  }

  /**
   * Reset password using token
   */
  async resetPassword(
    request: PasswordResetConfirm,
    getUserByResetToken: (token: string) => Promise<User | null>,
    updateUser: (userId: string, updates: Partial<User>) => Promise<User>
  ): Promise<{ message: string }> {
    // Find user by reset token
    const user = await getUserByResetToken(request.token)
    if (!user) {
      throw new Error('Invalid or expired password reset token')
    }

    // Check if token is still valid (using User entity method)
    if (!user.passwordResetToken || !user.passwordResetExpires || 
        user.passwordResetToken !== request.token ||
        user.passwordResetExpires < new Date()) {
      throw new Error('Invalid or expired password reset token')
    }

    // Validate new password strength
    const passwordValidation = this.password.validatePasswordStrength(request.newPassword)
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.errors.join(', '))
    }

    // Hash new password
    const hashedPassword = await this.password.hashPassword(request.newPassword)

    // Update user with new password and clear reset token
    await updateUser(user.id, {
      password: hashedPassword,
      passwordResetToken: undefined,
      passwordResetExpires: undefined,
      // Reset login attempts on successful password reset
      loginAttempts: 0,
      lockedUntil: undefined
    })

    return { message: 'Password has been reset successfully' }
  }

  /**
   * Verify password reset token validity
   */
  async verifyResetToken(
    token: string,
    getUserByResetToken: (token: string) => Promise<User | null>
  ): Promise<{ valid: boolean; expired?: boolean }> {
    if (!token) {
      return { valid: false }
    }

    const user = await getUserByResetToken(token)
    if (!user || !user.passwordResetToken || user.passwordResetToken !== token) {
      return { valid: false }
    }

    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return { valid: false, expired: true }
    }

    return { valid: true }
  }

  /**
   * Generate secure random token
   */
  private generateSecureToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    const length = 64 // Longer token for better security
    
    for (let i = 0; i < length; i++) {
      token += chars[Math.floor(Math.random() * chars.length)]
    }
    
    return token
  }

  /**
   * Remove password from user object for safe transmission
   */
  private excludePassword(user: User): Omit<User, 'password'> {
    const { password, ...userWithoutPassword } = user
    return userWithoutPassword
  }
}
