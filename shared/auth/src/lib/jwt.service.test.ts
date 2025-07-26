import { JwtService } from './jwt.service'
import * as jwt from 'jsonwebtoken'
import { User, UserRole } from './types'

// Mock jsonwebtoken
jest.mock('jsonwebtoken')

const mockJwt = jwt as jest.Mocked<typeof jwt>

// Fix mock return types
mockJwt.sign = jest.fn() as any
mockJwt.verify = jest.fn() as any

describe('JwtService', () => {
  let jwtService: JwtService

  const mockUser: Omit<User, 'password'> = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.USER,
    isActive: true,
    emailVerified: true,
    loginAttempts: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset environment variables
    process.env.JWT_ACCESS_SECRET = 'test-access-secret'
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'
    process.env.JWT_ACCESS_EXPIRES_IN = '15m'
    process.env.JWT_REFRESH_EXPIRES_IN = '7d'

    jwtService = new JwtService()
  })

  describe('Token Generation', () => {
    it('should generate access and refresh tokens', () => {
      ;(mockJwt.sign as jest.Mock)
        .mockReturnValueOnce('access_token')
        .mockReturnValueOnce('refresh_token')

      const result = jwtService.generateTokens(mockUser)

      expect(result).toEqual({
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresIn: 900, // 15 minutes in seconds
      })

      // Check access token generation
      expect(mockJwt.sign).toHaveBeenNthCalledWith(
        1,
        {
          userId: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
        },
        'test-access-secret',
        { expiresIn: '15m' as any }
      )

      // Check refresh token generation
      expect(mockJwt.sign).toHaveBeenNthCalledWith(
        2,
        {
          userId: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
        },
        'test-refresh-secret',
        { expiresIn: '7d' as any }
      )
    })

    it('should use default secrets when environment variables are not set', () => {
      delete process.env.JWT_ACCESS_SECRET
      delete process.env.JWT_REFRESH_SECRET

      const service = new JwtService()

      ;(mockJwt.sign as jest.Mock)
        .mockReturnValueOnce('access_token')
        .mockReturnValueOnce('refresh_token')

      service.generateTokens(mockUser)

      expect(mockJwt.sign).toHaveBeenNthCalledWith(
        1,
        expect.any(Object),
        'dev-access-secret-change-in-production',
        expect.any(Object)
      )

      expect(mockJwt.sign).toHaveBeenNthCalledWith(
        2,
        expect.any(Object),
        'dev-refresh-secret-change-in-production',
        expect.any(Object)
      )
    })

    it('should handle admin user role', () => {
      const adminUser = { ...mockUser, role: UserRole.ADMIN }

      ;(mockJwt.sign as jest.Mock)
        .mockReturnValueOnce('admin_access_token')
        .mockReturnValueOnce('admin_refresh_token')

      const result = jwtService.generateTokens(adminUser)

      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          role: UserRole.ADMIN,
        }),
        expect.any(String),
        expect.any(Object)
      )

      expect(result.accessToken).toBe('admin_access_token')
    })
  })

  describe('Token Verification', () => {
    it('should verify valid access token', () => {
      const token = 'valid_access_token'
      const decodedPayload = {
        userId: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
      }

      ;(mockJwt.verify as jest.Mock).mockReturnValue(decodedPayload as any)

      const result = jwtService.verifyAccessToken(token)

      expect(mockJwt.verify).toHaveBeenCalledWith(token, 'test-access-secret')
      expect(result).toEqual(decodedPayload)
    })

    it('should throw error for invalid access token', () => {
      const token = 'invalid_token'

      ;(mockJwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token')
      })

      expect(() => jwtService.verifyAccessToken(token)).toThrow(
        'Token verification failed'
      )
    })

    it('should verify valid refresh token', () => {
      const token = 'valid_refresh_token'
      const decodedPayload = {
        userId: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 604800, // 7 days
      }

      ;(mockJwt.verify as jest.Mock).mockReturnValue(decodedPayload as any)

      const result = jwtService.verifyRefreshToken(token)

      expect(mockJwt.verify).toHaveBeenCalledWith(token, 'test-refresh-secret')
      expect(result).toEqual(decodedPayload)
    })

    it('should throw error for invalid refresh token', () => {
      const token = 'invalid_refresh_token'

      ;(mockJwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid refresh token')
      })

      expect(() => jwtService.verifyRefreshToken(token)).toThrow(
        'Refresh token verification failed'
      )
    })

    it('should handle expired tokens', () => {
      const token = 'expired_token'

      ;(mockJwt.verify as jest.Mock).mockImplementation(() => {
        const error = new jwt.TokenExpiredError('jwt expired', new Date())
        throw error
      })

      expect(() => jwtService.verifyAccessToken(token)).toThrow(
        'Access token has expired'
      )
    })

    it('should handle malformed tokens', () => {
      const token = 'malformed_token'

      ;(mockJwt.verify as jest.Mock).mockImplementation(() => {
        const error = new jwt.JsonWebTokenError('jwt malformed')
        throw error
      })

      expect(() => jwtService.verifyAccessToken(token)).toThrow(
        'Invalid access token'
      )
    })
  })

  describe('Expiry Time Calculation', () => {
    it('should calculate expiry time in seconds for minutes', () => {
      process.env.JWT_ACCESS_EXPIRES_IN = '30m'
      const service = new JwtService()

      ;(mockJwt.sign as jest.Mock)
        .mockReturnValueOnce('token')
        .mockReturnValueOnce('refresh')

      const result = service.generateTokens(mockUser)

      expect(result.expiresIn).toBe(1800) // 30 minutes in seconds
    })

    it('should calculate expiry time in seconds for hours', () => {
      process.env.JWT_ACCESS_EXPIRES_IN = '2h'
      const service = new JwtService()

      ;(mockJwt.sign as jest.Mock)
        .mockReturnValueOnce('token')
        .mockReturnValueOnce('refresh')

      const result = service.generateTokens(mockUser)

      expect(result.expiresIn).toBe(7200) // 2 hours in seconds
    })

    it('should calculate expiry time in seconds for days', () => {
      process.env.JWT_ACCESS_EXPIRES_IN = '1d'
      const service = new JwtService()

      ;(mockJwt.sign as jest.Mock)
        .mockReturnValueOnce('token')
        .mockReturnValueOnce('refresh')

      const result = service.generateTokens(mockUser)

      expect(result.expiresIn).toBe(86400) // 1 day in seconds
    })

    it('should handle numeric expiry times', () => {
      process.env.JWT_ACCESS_EXPIRES_IN = '3600'
      const service = new JwtService()

      ;(mockJwt.sign as jest.Mock)
        .mockReturnValueOnce('token')
        .mockReturnValueOnce('refresh')

      const result = service.generateTokens(mockUser)

      expect(result.expiresIn).toBe(3600)
    })

    it('should use default expiry time for invalid format', () => {
      process.env.JWT_ACCESS_EXPIRES_IN = 'invalid'
      const service = new JwtService()

      ;(mockJwt.sign as jest.Mock)
        .mockReturnValueOnce('token')
        .mockReturnValueOnce('refresh')

      const result = service.generateTokens(mockUser)

      expect(result.expiresIn).toBe(900) // Default 15 minutes
    })
  })

  describe('Edge Cases', () => {
    it('should handle user with minimal data', () => {
      const minimalUser = {
        id: '1',
        email: 'min@example.com',
        role: UserRole.USER,
      } as Omit<User, 'password'>

      ;(mockJwt.sign as jest.Mock)
        .mockReturnValueOnce('token')
        .mockReturnValueOnce('refresh')

      const result = jwtService.generateTokens(minimalUser)

      expect(result.accessToken).toBe('token')
      expect(mockJwt.sign).toHaveBeenCalledWith(
        {
          userId: '1',
          email: 'min@example.com',
          role: UserRole.USER,
        },
        expect.any(String),
        expect.any(Object)
      )
    })

    it('should handle empty token verification', () => {
      expect(() => jwtService.verifyAccessToken('')).toThrow()
      expect(() => jwtService.verifyRefreshToken('')).toThrow()
    })

    it('should handle null token verification', () => {
      expect(() => jwtService.verifyAccessToken(null as any)).toThrow()
      expect(() => jwtService.verifyRefreshToken(null as any)).toThrow()
    })

    it('should handle undefined token verification', () => {
      expect(() => jwtService.verifyAccessToken(undefined as any)).toThrow()
      expect(() => jwtService.verifyRefreshToken(undefined as any)).toThrow()
    })
  })
})
