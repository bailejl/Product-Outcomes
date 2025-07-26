import * as jwt from 'jsonwebtoken'
import { JwtPayload, AuthTokens, User, UserRole } from './types'

export class JwtService {
  private readonly accessTokenSecret: string
  private readonly refreshTokenSecret: string
  private readonly accessTokenExpiresIn: string
  private readonly refreshTokenExpiresIn: string

  constructor() {
    // Use environment variables or defaults for development
    this.accessTokenSecret =
      process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production'
    this.refreshTokenSecret =
      process.env.JWT_REFRESH_SECRET ||
      'dev-refresh-secret-change-in-production'
    this.accessTokenExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m'
    this.refreshTokenExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  }

  /**
   * Generate access and refresh tokens for a user
   */
  generateTokens(user: Omit<User, 'password'>): AuthTokens {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    }

    const accessToken = jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiresIn as any,
    })

    const refreshToken = jwt.sign(payload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiresIn as any,
    })

    // Calculate expiration time in seconds
    const expiresIn = this.getTokenExpirationTime(this.accessTokenExpiresIn)

    return {
      accessToken,
      refreshToken,
      expiresIn,
    }
  }

  /**
   * Verify and decode an access token
   */
  verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.accessTokenSecret) as JwtPayload
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token has expired')
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token')
      }
      throw new Error('Token verification failed')
    }
  }

  /**
   * Verify and decode a refresh token
   */
  verifyRefreshToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.refreshTokenSecret) as JwtPayload
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token has expired')
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token')
      }
      throw new Error('Refresh token verification failed')
    }
  }

  /**
   * Generate a new access token using a valid refresh token
   */
  refreshAccessToken(refreshToken: string): string {
    const payload = this.verifyRefreshToken(refreshToken)

    // Create new payload without exp and iat
    const newPayload: JwtPayload = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    }

    return jwt.sign(newPayload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiresIn as any,
    })
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) {
      return null
    }

    const parts = authHeader.split(' ')
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null
    }

    return parts[1]
  }

  /**
   * Convert time string to seconds
   */
  private getTokenExpirationTime(expiresIn: string): number {
    // If it's a pure number, treat as seconds
    const numericValue = parseInt(expiresIn)
    if (!isNaN(numericValue) && numericValue.toString() === expiresIn) {
      return numericValue
    }

    const timeValue = parseInt(expiresIn.slice(0, -1))
    const timeUnit = expiresIn.slice(-1)

    if (isNaN(timeValue)) {
      return 900 // Default to 15 minutes
    }

    switch (timeUnit) {
      case 's':
        return timeValue
      case 'm':
        return timeValue * 60
      case 'h':
        return timeValue * 60 * 60
      case 'd':
        return timeValue * 24 * 60 * 60
      default:
        return 900 // Default to 15 minutes
    }
  }

  /**
   * Check if a token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as JwtPayload
      if (!decoded || !decoded.exp) {
        return true
      }
      return Date.now() >= decoded.exp * 1000
    } catch {
      return true
    }
  }

  /**
   * Get time remaining before token expires (in seconds)
   */
  getTokenTimeRemaining(token: string): number {
    try {
      const decoded = jwt.decode(token) as JwtPayload
      if (!decoded || !decoded.exp) {
        return 0
      }
      const remaining = decoded.exp * 1000 - Date.now()
      return Math.max(0, Math.floor(remaining / 1000))
    } catch {
      return 0
    }
  }
}
