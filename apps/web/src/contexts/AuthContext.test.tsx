import { renderHook, act, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { AuthProvider, useAuth } from './AuthContext'

// Mock fetch
global.fetch = jest.fn()

const mockFetch = fetch as jest.MockedFunction<typeof fetch>

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
)

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      expect(result.current.state).toEqual({
        user: null,
        tokens: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      })
    })

    it('should load auth data from storage on mount', () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user' as const,
        isActive: true,
        emailVerified: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      }

      const mockTokens = {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresIn: 3600,
      }

      localStorage.setItem('auth_user', JSON.stringify(mockUser))
      localStorage.setItem('auth_tokens', JSON.stringify(mockTokens))

      const { result } = renderHook(() => useAuth(), { wrapper })

      expect(result.current.state.isAuthenticated).toBe(true)
      expect(result.current.state.user).toEqual(mockUser)
      expect(result.current.state.tokens).toEqual(mockTokens)
    })
  })

  describe('Login', () => {
    it('should handle successful login', async () => {
      const mockResponse = {
        user: {
          id: '1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'user',
          isActive: true,
          emailVerified: true,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
        tokens: {
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expiresIn: 3600,
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const { result } = renderHook(() => useAuth(), { wrapper })

      await act(async () => {
        await result.current.login('test@example.com', 'password')
      })

      expect(result.current.state.isAuthenticated).toBe(true)
      expect(result.current.state.user).toEqual(mockResponse.user)
      expect(result.current.state.tokens).toEqual(mockResponse.tokens)
      expect(result.current.state.error).toBe(null)

      // Check localStorage
      expect(localStorage.getItem('auth_user')).toBe(
        JSON.stringify(mockResponse.user)
      )
      expect(localStorage.getItem('auth_tokens')).toBe(
        JSON.stringify(mockResponse.tokens)
      )
    })

    it('should handle login failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid credentials' }),
      } as Response)

      const { result } = renderHook(() => useAuth(), { wrapper })

      await expect(
        act(async () => {
          await result.current.login('test@example.com', 'wrong_password')
        })
      ).rejects.toThrow('Invalid credentials')

      expect(result.current.state.isAuthenticated).toBe(false)
      expect(result.current.state.user).toBe(null)
      expect(result.current.state.tokens).toBe(null)
      expect(result.current.state.error).toBe('Invalid credentials')
    })
  })

  describe('Register', () => {
    it('should handle successful registration', async () => {
      const mockResponse = {
        user: {
          id: '1',
          email: 'new@example.com',
          firstName: 'New',
          lastName: 'User',
          role: 'user',
          isActive: true,
          emailVerified: false,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
        tokens: {
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expiresIn: 3600,
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const { result } = renderHook(() => useAuth(), { wrapper })

      await act(async () => {
        await result.current.register({
          email: 'new@example.com',
          password: 'SecurePass123',
          firstName: 'New',
          lastName: 'User',
        })
      })

      expect(result.current.state.isAuthenticated).toBe(true)
      expect(result.current.state.user).toEqual(mockResponse.user)
      expect(result.current.state.tokens).toEqual(mockResponse.tokens)
    })

    it('should handle registration failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Email already exists' }),
      } as Response)

      const { result } = renderHook(() => useAuth(), { wrapper })

      await expect(
        act(async () => {
          await result.current.register({
            email: 'existing@example.com',
            password: 'SecurePass123',
            firstName: 'Test',
            lastName: 'User',
          })
        })
      ).rejects.toThrow('Email already exists')

      expect(result.current.state.isAuthenticated).toBe(false)
      expect(result.current.state.error).toBe('Email already exists')
    })
  })

  describe('Logout', () => {
    it('should handle logout successfully', async () => {
      // Set initial authenticated state
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user' as const,
        isActive: true,
        emailVerified: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      }

      const mockTokens = {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresIn: 3600,
      }

      localStorage.setItem('auth_user', JSON.stringify(mockUser))
      localStorage.setItem('auth_tokens', JSON.stringify(mockTokens))

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Logged out' }),
      } as Response)

      const { result } = renderHook(() => useAuth(), { wrapper })

      await act(async () => {
        await result.current.logout()
      })

      expect(result.current.state.isAuthenticated).toBe(false)
      expect(result.current.state.user).toBe(null)
      expect(result.current.state.tokens).toBe(null)
      expect(localStorage.getItem('auth_user')).toBe(null)
      expect(localStorage.getItem('auth_tokens')).toBe(null)
    })
  })

  describe('Token Refresh', () => {
    it('should refresh tokens successfully', async () => {
      const initialTokens = {
        accessToken: 'old_access_token',
        refreshToken: 'refresh_token',
        expiresIn: 3600,
      }

      const newTokens = {
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresIn: 3600,
      }

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user' as const,
        isActive: true,
        emailVerified: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      }

      localStorage.setItem('auth_user', JSON.stringify(mockUser))
      localStorage.setItem('auth_tokens', JSON.stringify(initialTokens))

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tokens: newTokens }),
      } as Response)

      const { result } = renderHook(() => useAuth(), { wrapper })

      await act(async () => {
        await result.current.refreshToken()
      })

      expect(result.current.state.tokens).toEqual(newTokens)
      expect(localStorage.getItem('auth_tokens')).toBe(
        JSON.stringify(newTokens)
      )
    })

    it('should logout on refresh token failure', async () => {
      const initialTokens = {
        accessToken: 'access_token',
        refreshToken: 'invalid_refresh_token',
        expiresIn: 3600,
      }

      localStorage.setItem('auth_tokens', JSON.stringify(initialTokens))

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid refresh token' }),
      } as Response)

      const { result } = renderHook(() => useAuth(), { wrapper })

      await expect(
        act(async () => {
          await result.current.refreshToken()
        })
      ).rejects.toThrow('Invalid refresh token')

      expect(result.current.state.isAuthenticated).toBe(false)
      expect(result.current.state.tokens).toBe(null)
    })
  })

  describe('Profile Management', () => {
    it('should update profile successfully', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user' as const,
        isActive: true,
        emailVerified: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      }

      const updatedUser = {
        ...mockUser,
        firstName: 'Updated',
        lastName: 'Name',
      }

      const mockTokens = {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresIn: 3600,
      }

      localStorage.setItem('auth_user', JSON.stringify(mockUser))
      localStorage.setItem('auth_tokens', JSON.stringify(mockTokens))

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: updatedUser }),
      } as Response)

      const { result } = renderHook(() => useAuth(), { wrapper })

      await act(async () => {
        await result.current.updateProfile({
          firstName: 'Updated',
          lastName: 'Name',
        })
      })

      expect(result.current.state.user).toEqual(updatedUser)
    })

    it('should handle change password successfully', async () => {
      const mockTokens = {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresIn: 3600,
      }

      localStorage.setItem('auth_tokens', JSON.stringify(mockTokens))

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password changed' }),
      } as Response)

      const { result } = renderHook(() => useAuth(), { wrapper })

      await act(async () => {
        await result.current.changePassword('currentPass', 'newPass')
      })

      // Should complete without error
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3333/api/auth/change-password',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer access_token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currentPassword: 'currentPass',
            newPassword: 'newPass',
          }),
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('should clear errors', () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      // Set an error state first
      act(() => {
        result.current.state.error = 'Some error'
      })

      act(() => {
        result.current.clearError()
      })

      expect(result.current.state.error).toBe(null)
    })
  })
})
