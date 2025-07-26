import { AuthService } from './auth'
import { UserRole } from './types'
import * as jwt from 'jsonwebtoken'

// Mock jwt and bcrypt
jest.mock('jsonwebtoken')
jest.mock('bcrypt')

const mockJwt = jwt as jest.Mocked<typeof jwt>

// Fix mock return types
mockJwt.sign = jest.fn() as any
mockJwt.verify = jest.fn() as any

describe('AuthService', () => {
  let authService: AuthService

  beforeEach(() => {
    jest.clearAllMocks()
    authService = new AuthService()
  })

  describe('Email Validation', () => {
    it('should validate correct email formats', () => {
      expect(authService.validateEmail('test@example.com')).toBe(true)
      expect(authService.validateEmail('user.name@domain.co.uk')).toBe(true)
      expect(authService.validateEmail('user+tag@example.com')).toBe(true)
    })

    it('should reject invalid email formats', () => {
      expect(authService.validateEmail('invalid')).toBe(false)
      expect(authService.validateEmail('invalid@')).toBe(false)
      expect(authService.validateEmail('@example.com')).toBe(false)
      expect(authService.validateEmail('user@')).toBe(false)
      expect(authService.validateEmail('user@.com')).toBe(false)
    })
  })

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecureP@ss123',
        firstName: 'Test',
        lastName: 'User',
      }

      const hashedPassword = 'hashed_password'
      authService.password.hashPassword = jest
        .fn()
        .mockResolvedValue(hashedPassword)

      const mockUser = {
        id: '1',
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: 'user',
        isActive: true,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const createUser = jest.fn().mockResolvedValue(mockUser)

      ;(mockJwt.sign as jest.Mock).mockReturnValue('mock_token')

      const result = await authService.registerUser(userData, createUser)

      expect(authService.password.hashPassword).toHaveBeenCalledWith(
        userData.password
      )
      expect(createUser).toHaveBeenCalledWith({
        email: userData.email.toLowerCase(),
        password: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: 'user',
        isActive: true,
        emailVerified: false,
      })
      expect(result.user).toEqual(mockUser)
      expect(result.tokens.accessToken).toBeDefined()
      expect(result.tokens.refreshToken).toBeDefined()
    })

    it('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'SecureP@ss123',
        firstName: 'Test',
        lastName: 'User',
      }

      const createUser = jest.fn()

      await expect(
        authService.registerUser(userData, createUser)
      ).rejects.toThrow('Invalid email format')

      expect(createUser).not.toHaveBeenCalled()
    })

    it('should reject registration with weak password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'weak',
        firstName: 'Test',
        lastName: 'User',
      }

      authService.password.validatePasswordStrength = jest
        .fn()
        .mockReturnValue({
          isValid: false,
          errors: ['Password is too short'],
        })

      const createUser = jest.fn()

      await expect(
        authService.registerUser(userData, createUser)
      ).rejects.toThrow('Password is too short')

      expect(createUser).not.toHaveBeenCalled()
    })

    it('should handle user creation errors', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecureP@ss123',
        firstName: 'Test',
        lastName: 'User',
      }

      authService.password.hashPassword = jest
        .fn()
        .mockResolvedValue('hashed_password')
      authService.password.validatePasswordStrength = jest
        .fn()
        .mockReturnValue({
          isValid: true,
          errors: [],
        })

      const createUser = jest
        .fn()
        .mockRejectedValue(new Error('Database error'))

      await expect(
        authService.registerUser(userData, createUser)
      ).rejects.toThrow('Database error')
    })
  })

  describe('User Authentication', () => {
    it('should authenticate user with valid credentials', async () => {
      const email = 'test@example.com'
      const password = 'SecurePass123'

      const mockUser = {
        id: '1',
        email,
        password: 'hashed_password',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        isActive: true,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const findUser = jest.fn().mockResolvedValue(mockUser)
      const updateLastLogin = jest.fn()

      authService.password.comparePassword = jest.fn().mockResolvedValue(true)
      ;(mockJwt.sign as jest.Mock).mockReturnValue('mock_token')

      const result = await authService.authenticateUser(
        email,
        password,
        findUser,
        updateLastLogin
      )

      expect(findUser).toHaveBeenCalledWith(email.toLowerCase())
      expect(authService.password.comparePassword).toHaveBeenCalledWith(
        password,
        mockUser.password
      )
      expect(updateLastLogin).toHaveBeenCalledWith(mockUser.id)

      expect(result.user).toEqual(
        expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
        })
      )
      expect(result.tokens.accessToken).toBeDefined()
      expect(result.tokens.refreshToken).toBeDefined()
    })

    it('should reject authentication with non-existent user', async () => {
      const email = 'nonexistent@example.com'
      const password = 'password'

      const findUser = jest.fn().mockResolvedValue(null)
      const updateLastLogin = jest.fn()

      await expect(
        authService.authenticateUser(email, password, findUser, updateLastLogin)
      ).rejects.toThrow('Invalid email or password')

      expect(updateLastLogin).not.toHaveBeenCalled()
    })

    it('should reject authentication with invalid password', async () => {
      const email = 'test@example.com'
      const password = 'wrong_password'

      const mockUser = {
        id: '1',
        email,
        password: 'hashed_password',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        isActive: true,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const findUser = jest.fn().mockResolvedValue(mockUser)
      const updateLastLogin = jest.fn()

      authService.password.comparePassword = jest.fn().mockResolvedValue(false)

      await expect(
        authService.authenticateUser(email, password, findUser, updateLastLogin)
      ).rejects.toThrow('Invalid email or password')

      expect(updateLastLogin).not.toHaveBeenCalled()
    })

    it('should reject authentication for inactive user', async () => {
      const email = 'test@example.com'
      const password = 'password'

      const mockUser = {
        id: '1',
        email,
        password: 'hashed_password',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        isActive: false,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const findUser = jest.fn().mockResolvedValue(mockUser)
      const updateLastLogin = jest.fn()

      await expect(
        authService.authenticateUser(email, password, findUser, updateLastLogin)
      ).rejects.toThrow('Account is deactivated')

      expect(updateLastLogin).not.toHaveBeenCalled()
    })
  })

  describe('Token Refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const refreshToken = 'valid_refresh_token'
      const userId = 'user-123'

      const decodedToken = {
        userId,
        email: 'test@example.com',
        role: 'user',
      }

      const mockUser = {
        id: userId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        isActive: true,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(mockJwt.verify as jest.Mock).mockReturnValue(decodedToken)
      ;(mockJwt.sign as jest.Mock).mockReturnValue('new_token')

      const findUser = jest.fn().mockResolvedValue(mockUser)

      const result = await authService.refreshToken(refreshToken, findUser)

      expect(mockJwt.verify).toHaveBeenCalledWith(
        refreshToken,
        'dev-refresh-secret-change-in-production'
      )
      expect(findUser).toHaveBeenCalledWith(userId)
      expect(result.accessToken).toBeDefined()
      expect(result.refreshToken).toBeDefined()
    })

    it('should reject invalid refresh token', async () => {
      const refreshToken = 'invalid_token'

      ;(mockJwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token')
      })

      const findUser = jest.fn()

      await expect(
        authService.refreshToken(refreshToken, findUser)
      ).rejects.toThrow('Refresh token verification failed')

      expect(findUser).not.toHaveBeenCalled()
    })

    it('should reject refresh token for non-existent user', async () => {
      const refreshToken = 'valid_refresh_token'
      const userId = 'user-123'

      const decodedToken = {
        userId,
        email: 'test@example.com',
        role: 'user',
      }

      ;(mockJwt.verify as jest.Mock).mockReturnValue(decodedToken)

      const findUser = jest.fn().mockResolvedValue(null)

      await expect(
        authService.refreshToken(refreshToken, findUser)
      ).rejects.toThrow('User not found')
    })

    it('should reject refresh token for inactive user', async () => {
      const refreshToken = 'valid_refresh_token'
      const userId = 'user-123'

      const decodedToken = {
        userId,
        email: 'test@example.com',
        role: 'user',
      }

      const mockUser = {
        id: userId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        isActive: false,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(mockJwt.verify as jest.Mock).mockReturnValue(decodedToken)

      const findUser = jest.fn().mockResolvedValue(mockUser)

      await expect(
        authService.refreshToken(refreshToken, findUser)
      ).rejects.toThrow('User not found or inactive')
    })
  })

  describe('Middleware', () => {
    describe('authenticate middleware', () => {
      it('should authenticate valid token', async () => {
        const req = {
          headers: {
            authorization: 'Bearer valid_token',
          },
        } as any
        const res = {} as any
        const next = jest.fn()

        const decodedToken = {
          userId: 'user-123',
          email: 'test@example.com',
          role: 'user',
        }

        ;(mockJwt.verify as jest.Mock).mockReturnValue(decodedToken)

        await authService.middleware.authenticate(req, res, next)

        expect(req.userId).toBe(decodedToken.userId)
        expect(req.user.email).toBe(decodedToken.email)
        expect(req.user.role).toBe(decodedToken.role)
        expect(next).toHaveBeenCalled()
      })

      it('should reject missing authorization header', async () => {
        const req = {
          headers: {},
        } as any
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any
        const next = jest.fn()

        await authService.middleware.authenticate(req, res, next)

        expect(res.status).toHaveBeenCalledWith(401)
        expect(res.json).toHaveBeenCalledWith({
          error: 'Authentication required',
          message: 'No token provided',
        })
        expect(next).not.toHaveBeenCalled()
      })

      it('should reject invalid token format', async () => {
        const req = {
          headers: {
            authorization: 'InvalidFormat',
          },
        } as any
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any
        const next = jest.fn()

        await authService.middleware.authenticate(req, res, next)

        expect(res.status).toHaveBeenCalledWith(401)
        expect(res.json).toHaveBeenCalledWith({
          error: 'Authentication required',
          message: 'No token provided',
        })
        expect(next).not.toHaveBeenCalled()
      })

      it('should reject invalid token', async () => {
        const req = {
          headers: {
            authorization: 'Bearer invalid_token',
          },
        } as any
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any
        const next = jest.fn()

        ;(mockJwt.verify as jest.Mock).mockImplementation(() => {
          throw new Error('Invalid token')
        })

        await authService.middleware.authenticate(req, res, next)

        expect(res.status).toHaveBeenCalledWith(401)
        expect(res.json).toHaveBeenCalledWith({
          error: 'Authentication failed',
          message: 'Token verification failed',
        })
        expect(next).not.toHaveBeenCalled()
      })
    })

    describe('requireRole middleware', () => {
      it('should allow access for correct role', () => {
        const req = {
          user: {
            id: 'user-123',
            email: 'admin@example.com',
            role: UserRole.ADMIN,
            firstName: 'Admin',
            lastName: 'User',
            isActive: true,
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        } as any
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any
        const next = jest.fn()

        const middleware = authService.middleware.requireRole(UserRole.ADMIN)
        middleware(req, res, next)

        expect(next).toHaveBeenCalled()
      })

      it('should deny access for incorrect role', () => {
        const req = {
          user: {
            id: 'user-123',
            email: 'user@example.com',
            role: UserRole.USER,
            firstName: 'Regular',
            lastName: 'User',
            isActive: true,
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        } as any
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any
        const next = jest.fn()

        const middleware = authService.middleware.requireRole(UserRole.ADMIN)
        middleware(req, res, next)

        expect(res.status).toHaveBeenCalledWith(403)
        expect(res.json).toHaveBeenCalledWith({
          error: 'Access denied',
          message: 'Required role: admin',
        })
        expect(next).not.toHaveBeenCalled()
      })

      it('should deny access when no role is set', () => {
        const req = {} as any
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any
        const next = jest.fn()

        const middleware = authService.middleware.requireRole(UserRole.ADMIN)
        middleware(req, res, next)

        expect(res.status).toHaveBeenCalledWith(401)
        expect(res.json).toHaveBeenCalledWith({
          error: 'Authentication required',
          message: 'User not authenticated',
        })
        expect(next).not.toHaveBeenCalled()
      })
    })
  })
})
