// Main authentication service that combines all auth functionality
import { JwtService } from './jwt.service'
import { PasswordService } from './password.service'
import { AuthMiddleware } from './middleware'
import {
  User,
  UserRole,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  AuthTokens,
  JwtPayload,
} from './types'

export class AuthService {
  public readonly jwt: JwtService
  public readonly password: PasswordService
  public readonly middleware: AuthMiddleware

  constructor() {
    this.jwt = new JwtService()
    this.password = new PasswordService()
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
   * Remove password from user object for safe transmission
   */
  private excludePassword(user: User): Omit<User, 'password'> {
    const { password, ...userWithoutPassword } = user
    return userWithoutPassword
  }
}
