import { render, screen } from '@testing-library/react'
import { ProtectedRoute } from './ProtectedRoute'
import { useAuth } from '../../contexts/AuthContext'

// Mock the useAuth hook
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}))

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

const mockUser = {
  id: '1',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'user' as const,
  isActive: true,
  emailVerified: true,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
}

const authenticatedState = {
  state: {
    user: mockUser,
    tokens: {
      accessToken: 'test-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
    },
    isLoading: false,
    isAuthenticated: true,
    error: null,
  },
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  clearError: jest.fn(),
  refreshToken: jest.fn(),
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  changePassword: jest.fn(),
}

const unauthenticatedState = {
  state: {
    user: null,
    tokens: null,
    isLoading: false,
    isAuthenticated: false,
    error: null,
  },
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  clearError: jest.fn(),
  refreshToken: jest.fn(),
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  changePassword: jest.fn(),
}

const loadingState = {
  state: {
    user: null,
    tokens: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  },
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  clearError: jest.fn(),
  refreshToken: jest.fn(),
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  changePassword: jest.fn(),
}

const TestComponent = () => (
  <div data-testid="protected-content">Protected Content</div>
)

const FallbackComponent = () => (
  <div data-testid="fallback-content">Please sign in</div>
)

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Authenticated User', () => {
    it('should render children when user is authenticated', () => {
      mockUseAuth.mockReturnValue(authenticatedState)

      render(
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      )

      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
      expect(screen.queryByTestId('fallback-content')).not.toBeInTheDocument()
    })

    it('should render children with function as children pattern', () => {
      mockUseAuth.mockReturnValue(authenticatedState)

      render(
        <ProtectedRoute>{() => <TestComponent />}</ProtectedRoute>
      )

      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    })

    it('should pass user data to function children', () => {
      mockUseAuth.mockReturnValue(authenticatedState)

      const childrenFn = jest.fn(() => <TestComponent />)

      render(
        <ProtectedRoute>{childrenFn}</ProtectedRoute>
      )

      expect(childrenFn).toHaveBeenCalledWith(mockUser)
      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    })
  })

  describe('Unauthenticated User', () => {
    it('should render default fallback when user is not authenticated', () => {
      mockUseAuth.mockReturnValue(unauthenticatedState)

      render(
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      )

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
      expect(
        screen.getByText('Please sign in to access this content.')
      ).toBeInTheDocument()
    })

    it('should render custom fallback when provided', () => {
      mockUseAuth.mockReturnValue(unauthenticatedState)

      render(
        <ProtectedRoute fallback={<FallbackComponent />}>
          <TestComponent />
        </ProtectedRoute>
      )

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
      expect(screen.getByTestId('fallback-content')).toBeInTheDocument()
    })

    it('should not render children when user is not authenticated', () => {
      mockUseAuth.mockReturnValue(unauthenticatedState)

      render(
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      )

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    })

    it('should not call function children when user is not authenticated', () => {
      mockUseAuth.mockReturnValue(unauthenticatedState)

      const childrenFn = jest.fn(() => <TestComponent />)

      render(
        <ProtectedRoute fallback={<FallbackComponent />}>
          {childrenFn}
        </ProtectedRoute>
      )

      expect(childrenFn).not.toHaveBeenCalled()
      expect(screen.getByTestId('fallback-content')).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('should render loading indicator when authentication is loading', () => {
      render(
        <AuthProvider value={loadingContext}>
          <ProtectedRoute>
            <TestComponent />
          </ProtectedRoute>
        </AuthProvider>
      )

      expect(screen.getByText('Loading...')).toBeInTheDocument()
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    })

    it('should render custom loading component when provided', () => {
      const CustomLoading = () => (
        <div data-testid="custom-loading">Custom Loading</div>
      )

      render(
        <AuthProvider value={loadingContext}>
          <ProtectedRoute loading={<CustomLoading />}>
            <TestComponent />
          </ProtectedRoute>
        </AuthProvider>
      )

      expect(screen.getByTestId('custom-loading')).toBeInTheDocument()
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    })
  })

  describe('Role-based Access', () => {
    it('should render content when user has required role', () => {
      const adminUser = { ...mockUser, role: 'admin' as const }
      const adminContext = {
        ...authenticatedContext,
        state: {
          ...authenticatedContext.state,
          user: adminUser,
        },
      }

      render(
        <AuthProvider value={adminContext}>
          <ProtectedRoute requiredRole="admin">
            <TestComponent />
          </ProtectedRoute>
        </AuthProvider>
      )

      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    })

    it('should not render content when user lacks required role', () => {
      render(
        <AuthProvider value={authenticatedContext}>
          <ProtectedRoute requiredRole="admin" fallback={<FallbackComponent />}>
            <TestComponent />
          </ProtectedRoute>
        </AuthProvider>
      )

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
      expect(screen.getByTestId('fallback-content')).toBeInTheDocument()
    })

    it('should render default insufficient permissions message', () => {
      render(
        <AuthProvider value={authenticatedContext}>
          <ProtectedRoute requiredRole="admin">
            <TestComponent />
          </ProtectedRoute>
        </AuthProvider>
      )

      expect(
        screen.getByText('You do not have permission to access this content.')
      ).toBeInTheDocument()
    })

    it('should accept array of required roles', () => {
      const moderatorUser = { ...mockUser, role: 'moderator' as const }
      const moderatorContext = {
        ...authenticatedContext,
        state: {
          ...authenticatedContext.state,
          user: moderatorUser,
        },
      }

      render(
        <AuthProvider value={moderatorContext}>
          <ProtectedRoute requiredRole={['admin', 'moderator']}>
            <TestComponent />
          </ProtectedRoute>
        </AuthProvider>
      )

      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    })

    it('should deny access when user role is not in array', () => {
      render(
        <AuthProvider value={authenticatedContext}>
          <ProtectedRoute
            requiredRole={['admin', 'moderator']}
            fallback={<FallbackComponent />}
          >
            <TestComponent />
          </ProtectedRoute>
        </AuthProvider>
      )

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
      expect(screen.getByTestId('fallback-content')).toBeInTheDocument()
    })
  })

  describe('Multiple Conditions', () => {
    it('should render content when both authentication and role requirements are met', () => {
      const adminUser = { ...mockUser, role: 'admin' as const }
      const adminContext = {
        ...authenticatedContext,
        state: {
          ...authenticatedContext.state,
          user: adminUser,
        },
      }

      render(
        <AuthProvider value={adminContext}>
          <ProtectedRoute requiredRole="admin">
            <TestComponent />
          </ProtectedRoute>
        </AuthProvider>
      )

      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    })

    it('should not render content when authentication fails even with correct role', () => {
      render(
        <AuthProvider value={unauthenticatedContext}>
          <ProtectedRoute requiredRole="user" fallback={<FallbackComponent />}>
            <TestComponent />
          </ProtectedRoute>
        </AuthProvider>
      )

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
      expect(screen.getByTestId('fallback-content')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle null user gracefully', () => {
      const nullUserContext = {
        ...authenticatedContext,
        state: {
          ...authenticatedContext.state,
          user: null,
          isAuthenticated: false,
        },
      }

      render(
        <AuthProvider value={nullUserContext}>
          <ProtectedRoute>
            <TestComponent />
          </ProtectedRoute>
        </AuthProvider>
      )

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
      expect(
        screen.getByText('Please sign in to access this content.')
      ).toBeInTheDocument()
    })

    it('should handle missing role property', () => {
      const userWithoutRole = { ...mockUser, role: undefined as any }
      const contextWithoutRole = {
        ...authenticatedContext,
        state: {
          ...authenticatedContext.state,
          user: userWithoutRole,
        },
      }

      render(
        <AuthProvider value={contextWithoutRole}>
          <ProtectedRoute requiredRole="admin" fallback={<FallbackComponent />}>
            <TestComponent />
          </ProtectedRoute>
        </AuthProvider>
      )

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
      expect(screen.getByTestId('fallback-content')).toBeInTheDocument()
    })

    it('should handle empty children gracefully', () => {
      render(
        <AuthProvider value={authenticatedContext}>
          <ProtectedRoute>{null}</ProtectedRoute>
        </AuthProvider>
      )

      // Should not crash and should render empty content for authenticated users
      expect(
        screen.queryByText('Please sign in to access this content.')
      ).not.toBeInTheDocument()
    })
  })
})
