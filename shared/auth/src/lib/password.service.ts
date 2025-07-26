import * as bcrypt from 'bcrypt'

export class PasswordService {
  private readonly saltRounds: number

  constructor() {
    // Use environment variable or default to 12 rounds for development
    this.saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12')
  }

  /**
   * Hash a plain text password
   */
  async hashPassword(plainPassword: string): Promise<string> {
    if (!plainPassword || plainPassword.length < 1) {
      throw new Error('Password cannot be empty')
    }

    try {
      return await bcrypt.hash(plainPassword, this.saltRounds)
    } catch (error) {
      throw new Error('Password hashing failed')
    }
  }

  /**
   * Compare a plain text password with a hashed password
   */
  async comparePassword(
    plainPassword: string,
    hashedPassword: string
  ): Promise<boolean> {
    if (!plainPassword || !hashedPassword) {
      return false
    }

    try {
      return await bcrypt.compare(plainPassword, hashedPassword)
    } catch (error) {
      throw new Error('Password comparison failed')
    }
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (!password) {
      errors.push('Password is required')
      return { isValid: false, errors }
    }

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long')
    }

    if (password.length > 128) {
      errors.push('Password must be less than 128 characters long')
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number')
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character')
    }

    // Check for common weak patterns
    const commonPatterns = [
      /(.)\1{2,}/, // Same character repeated 3+ times
      /123456|654321|abcdef|qwerty/i, // Common sequences
      /password|123456789|12345678/i, // Common passwords
    ]

    for (const pattern of commonPatterns) {
      if (pattern.test(password)) {
        errors.push('Password contains common patterns and is too weak')
        break
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Generate a secure random password
   */
  generateSecurePassword(length: number = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?'

    const allChars = uppercase + lowercase + numbers + symbols

    let password = ''

    // Ensure at least one character from each category
    password += uppercase[Math.floor(Math.random() * uppercase.length)]
    password += lowercase[Math.floor(Math.random() * lowercase.length)]
    password += numbers[Math.floor(Math.random() * numbers.length)]
    password += symbols[Math.floor(Math.random() * symbols.length)]

    // Fill the rest with random characters
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)]
    }

    // Shuffle the password to avoid predictable patterns
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('')
  }

  /**
   * Generate a reset token (used for password reset emails)
   */
  generateResetToken(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    for (let i = 0; i < 32; i++) {
      token += chars[Math.floor(Math.random() * chars.length)]
    }
    return token
  }

  /**
   * Check if password needs to be rehashed (if salt rounds changed)
   */
  async needsRehash(hashedPassword: string): Promise<boolean> {
    try {
      const currentSaltRounds = bcrypt.getRounds(hashedPassword)
      return currentSaltRounds !== this.saltRounds
    } catch (error) {
      // If we can't get rounds, assume it needs rehashing
      return true
    }
  }
}
