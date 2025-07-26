import { render, screen, fireEvent } from '@testing-library/react'
import { AuthModal } from './AuthModal'
import { useAuth } from '../../contexts/AuthContext'

// Mock the useAuth hook
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}))

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

const mockAuthState = {
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

const renderWithAuth = (component: React.ReactElement) => {
  mockUseAuth.mockReturnValue(mockAuthState)
  return render(component)
}

describe('AuthModal', () => {
  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAuth.mockReturnValue(mockAuthState)
  })

  describe('Modal Visibility', () => {
    it('should render when isOpen is true', () => {
      renderWithAuth(<AuthModal isOpen={true} onClose={mockOnClose} />)

      expect(screen.getByTestId('auth-modal')).toBeInTheDocument()
    })

    it('should not render when isOpen is false', () => {
      renderWithAuth(<AuthModal isOpen={false} onClose={mockOnClose} />)

      expect(screen.queryByTestId('auth-modal')).not.toBeInTheDocument()
    })

    it('should call onClose when close button is clicked', () => {
      renderWithAuth(<AuthModal isOpen={true} onClose={mockOnClose} />)

      const closeButton = screen.getByTestId('close-modal')
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when backdrop is clicked', () => {
      renderWithAuth(<AuthModal isOpen={true} onClose={mockOnClose} />)

      const backdrop = screen.getByTestId('modal-backdrop')
      fireEvent.click(backdrop)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when Escape key is pressed', () => {
      renderWithAuth(<AuthModal isOpen={true} onClose={mockOnClose} />)

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should not call onClose when modal content is clicked', () => {
      renderWithAuth(<AuthModal isOpen={true} onClose={mockOnClose} />)

      const modalContent = screen.getByRole('dialog')
      fireEvent.click(modalContent)

      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe('Form Switching', () => {
    it('should show login form by default', () => {
      renderWithAuth(<AuthModal isOpen={true} onClose={mockOnClose} />)

      expect(screen.getByTestId('login-form')).toBeInTheDocument()
      expect(screen.queryByTestId('register-form')).not.toBeInTheDocument()
    })

    it('should switch to register form when Sign up here is clicked', () => {
      renderWithAuth(<AuthModal isOpen={true} onClose={mockOnClose} />)

      const switchToRegister = screen.getByText('Sign up here')
      fireEvent.click(switchToRegister)

      expect(screen.getByTestId('register-form')).toBeInTheDocument()
      expect(screen.queryByTestId('login-form')).not.toBeInTheDocument()
    })

    it('should switch back to login form when Sign in here is clicked', () => {
      renderWithAuth(<AuthModal isOpen={true} onClose={mockOnClose} />)

      // Switch to register first
      const switchToRegister = screen.getByText('Sign up here')
      fireEvent.click(switchToRegister)

      // Switch back to login
      const switchToLogin = screen.getByText('Sign in here')
      fireEvent.click(switchToLogin)

      expect(screen.getByTestId('login-form')).toBeInTheDocument()
      expect(screen.queryByTestId('register-form')).not.toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('should show loading indicator when isLoading is true', () => {
      const loadingState = {
        ...mockAuthState,
        state: {
          ...mockAuthState.state,
          isLoading: true,
        },
      }

      mockUseAuth.mockReturnValue(loadingState)
      render(<AuthModal isOpen={true} onClose={mockOnClose} />)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('should disable form inputs when loading', () => {
      const loadingState = {
        ...mockAuthState,
        state: {
          ...mockAuthState.state,
          isLoading: true,
        },
      }

      mockUseAuth.mockReturnValue(loadingState)
      render(<AuthModal isOpen={true} onClose={mockOnClose} />)

      const emailInput = screen.getByRole('textbox', { name: /email/i })
      expect(emailInput).toBeDisabled()
    })
  })

  describe('Error Display', () => {
    it('should display error message when error exists', () => {
      const errorState = {
        ...mockAuthState,
        state: {
          ...mockAuthState.state,
          error: 'Invalid credentials',
        },
      }

      mockUseAuth.mockReturnValue(errorState)
      render(<AuthModal isOpen={true} onClose={mockOnClose} />)

      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })

    it('should clear error when switching between forms', () => {
      const errorState = {
        ...mockAuthState,
        state: {
          ...mockAuthState.state,
          error: 'Some error',
        },
      }

      mockUseAuth.mockReturnValue(errorState)
      render(<AuthModal isOpen={true} onClose={mockOnClose} />)

      const switchToRegister = screen.getByText('Sign up here')
      fireEvent.click(switchToRegister)

      expect(mockAuthState.clearError).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      renderWithAuth(<AuthModal isOpen={true} onClose={mockOnClose} />)

      const modal = screen.getByRole('dialog')
      expect(modal).toHaveAttribute('aria-modal', 'true')
      expect(modal).toHaveAttribute('aria-labelledby')
    })

    it('should trap focus within modal', () => {
      renderWithAuth(<AuthModal isOpen={true} onClose={mockOnClose} />)

      const modal = screen.getByRole('dialog')
      const firstFocusableElement = screen.getByRole('textbox', {
        name: /email/i,
      })

      expect(document.activeElement).toBe(firstFocusableElement)
    })

    it('should handle Tab key navigation correctly', () => {
      renderWithAuth(<AuthModal isOpen={true} onClose={mockOnClose} />)

      const emailInput = screen.getByRole('textbox', { name: /email/i })
      const passwordInput = screen.getByLabelText(/password/i)

      // Tab should move focus to next element
      fireEvent.keyDown(emailInput, { key: 'Tab' })
      expect(document.activeElement).toBe(passwordInput)
    })
  })

  describe('Auto-close on Success', () => {
    it('should close modal after successful login', () => {
      const authenticatedState = {
        ...mockAuthState,
        state: {
          ...mockAuthState.state,
          isAuthenticated: true,
          user: {
            id: '1',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            role: 'user' as const,
            isActive: true,
            emailVerified: true,
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
        },
      }

      mockUseAuth.mockReturnValue(authenticatedState)
      render(<AuthModal isOpen={true} onClose={mockOnClose} />)

      // Modal should auto-close when user becomes authenticated
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })
})
