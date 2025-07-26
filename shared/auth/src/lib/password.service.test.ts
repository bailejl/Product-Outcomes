import { PasswordService } from './password.service'
import * as bcrypt from 'bcrypt'

// Mock bcrypt
jest.mock('bcrypt')

const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>

// Fix mock return types
mockBcrypt.hash = jest.fn() as any
mockBcrypt.compare = jest.fn() as any

describe('PasswordService', () => {
  let passwordService: PasswordService

  beforeEach(() => {
    jest.clearAllMocks()
    passwordService = new PasswordService()
  })

  describe('Password Hashing', () => {
    it('should hash password with correct salt rounds', async () => {
      const plainPassword = 'SecurePassword123'
      const hashedPassword = 'hashed_password'

      ;(mockBcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword)

      const result = await passwordService.hashPassword(plainPassword)

      expect(mockBcrypt.hash).toHaveBeenCalledWith(plainPassword, 12)
      expect(result).toBe(hashedPassword)
    })

    it('should handle hashing errors', async () => {
      const plainPassword = 'SecurePassword123'

      ;(mockBcrypt.hash as jest.Mock).mockRejectedValue(
        new Error('Hashing failed')
      )

      await expect(passwordService.hashPassword(plainPassword)).rejects.toThrow(
        'Password hashing failed'
      )
    })
  })

  describe('Password Comparison', () => {
    it('should return true for matching passwords', async () => {
      const plainPassword = 'SecurePassword123'
      const hashedPassword = 'hashed_password'

      ;(mockBcrypt.compare as jest.Mock).mockResolvedValue(true)

      const result = await passwordService.comparePassword(
        plainPassword,
        hashedPassword
      )

      expect(mockBcrypt.compare).toHaveBeenCalledWith(
        plainPassword,
        hashedPassword
      )
      expect(result).toBe(true)
    })

    it('should return false for non-matching passwords', async () => {
      const plainPassword = 'SecurePassword123'
      const hashedPassword = 'hashed_password'

      ;(mockBcrypt.compare as jest.Mock).mockResolvedValue(false)

      const result = await passwordService.comparePassword(
        plainPassword,
        hashedPassword
      )

      expect(mockBcrypt.compare).toHaveBeenCalledWith(
        plainPassword,
        hashedPassword
      )
      expect(result).toBe(false)
    })

    it('should handle comparison errors', async () => {
      const plainPassword = 'SecurePassword123'
      const hashedPassword = 'hashed_password'

      ;(mockBcrypt.compare as jest.Mock).mockRejectedValue(
        new Error('Comparison failed')
      )

      await expect(
        passwordService.comparePassword(plainPassword, hashedPassword)
      ).rejects.toThrow('Password comparison failed')
    })
  })

  describe('Password Strength Validation', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = [
        'SecureP@ss123',
        'MyP@ssw0rd!',
        'Test123!',
        'ComplexP@ss123',
        'Valid1P@ssword',
      ]

      strongPasswords.forEach(password => {
        const result = passwordService.validatePasswordStrength(password)
        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })
    })

    it('should reject passwords shorter than 8 characters', () => {
      const result = passwordService.validatePasswordStrength('Short1')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(
        'Password must be at least 8 characters long'
      )
    })

    it('should reject passwords without uppercase letters', () => {
      const result = passwordService.validatePasswordStrength('password123')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(
        'Password must contain at least one uppercase letter'
      )
    })

    it('should reject passwords without lowercase letters', () => {
      const result = passwordService.validatePasswordStrength('PASSWORD123')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(
        'Password must contain at least one lowercase letter'
      )
    })

    it('should reject passwords without numbers', () => {
      const result = passwordService.validatePasswordStrength('SecurePassword!')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(
        'Password must contain at least one number'
      )
    })

    it('should collect multiple validation errors', () => {
      const result = passwordService.validatePasswordStrength('pass')

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(4)
      expect(result.errors).toContain(
        'Password must be at least 8 characters long'
      )
      expect(result.errors).toContain(
        'Password must contain at least one uppercase letter'
      )
      expect(result.errors).toContain(
        'Password must contain at least one number'
      )
      expect(result.errors).toContain(
        'Password must contain at least one special character'
      )
    })

    it('should handle empty password', () => {
      const result = passwordService.validatePasswordStrength('')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Password is required')
    })

    it('should require special characters', () => {
      const passwordsWithSpecialChars = [
        'SecureP@ss123',
        'Test!234',
        'Valid#Pass1',
        'Complex$123',
      ]

      passwordsWithSpecialChars.forEach(password => {
        const result = passwordService.validatePasswordStrength(password)
        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })
    })

    it('should reject passwords without special characters', () => {
      const result = passwordService.validatePasswordStrength('SecurePass123')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(
        'Password must contain at least one special character'
      )
    })

    it('should handle unicode characters', () => {
      const result = passwordService.validatePasswordStrength('Pässwörd123!')

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate password with exactly 8 characters', () => {
      const result = passwordService.validatePasswordStrength('Pass123!')

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle null password for validation', () => {
      const result = passwordService.validatePasswordStrength(null as any)

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should handle undefined password for validation', () => {
      const result = passwordService.validatePasswordStrength(undefined as any)

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should handle very long passwords', () => {
      const longPassword = 'A'.repeat(130) + 'a1@bcdefgh!'
      const result = passwordService.validatePasswordStrength(longPassword)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(
        'Password must be less than 128 characters long'
      )
    })

    it('should handle moderately long passwords', () => {
      const longPassword = 'StrongP@ssw0rd123'
      const result = passwordService.validatePasswordStrength(longPassword)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })
})
