import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from './LoginForm'
import { AuthProvider } from '../../contexts/AuthContext'

// Mock the auth context
jest.mock('../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../contexts/AuthContext'),
  useAuth: () => ({
    login: mockLogin,
    state: mockAuthState,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

let mockLogin = jest.fn()
let mockAuthState = {
  isLoading: false,
  error: null,
}

describe('LoginForm', () => {
  beforeEach(() => {
    mockLogin = jest.fn()
    mockAuthState = {
      isLoading: false,
      error: null,
    }
  })

  it('should render login form elements', () => {
    render(<LoginForm />)

    expect(screen.getByText('Welcome Back')).toBeInTheDocument()
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Remember me')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
    expect(screen.getByText('Forgot password?')).toBeInTheDocument()
  })

  it('should display error message when state has error', () => {
    mockAuthState = {
      isLoading: false,
      error: 'Invalid credentials',
    }

    render(<LoginForm />)

    expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
  })

  it('should validate required fields', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    const submitButton = screen.getByRole('button', { name: 'Sign In' })
    await user.click(submitButton)

    expect(screen.getByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('should validate email format', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    const emailInput = screen.getByLabelText('Email Address')
    await user.type(emailInput, 'invalid-email')

    const submitButton = screen.getByRole('button', { name: 'Sign In' })
    await user.click(submitButton)

    expect(
      screen.getByText('Please enter a valid email address')
    ).toBeInTheDocument()
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('should clear errors when user starts typing', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    // First submit to trigger errors
    const submitButton = screen.getByRole('button', { name: 'Sign In' })
    await user.click(submitButton)

    expect(screen.getByText('Email is required')).toBeInTheDocument()

    // Start typing in email field
    const emailInput = screen.getByLabelText('Email Address')
    await user.type(emailInput, 't')

    expect(screen.queryByText('Email is required')).not.toBeInTheDocument()
  })

  it('should submit form with valid data', async () => {
    const user = userEvent.setup()
    const onSuccess = jest.fn()
    mockLogin.mockResolvedValue(undefined)

    render(<LoginForm onSuccess={onSuccess} />)

    const emailInput = screen.getByLabelText('Email Address')
    const passwordInput = screen.getByLabelText('Password')
    const rememberMeCheckbox = screen.getByLabelText('Remember me')

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(rememberMeCheckbox)

    const submitButton = screen.getByRole('button', { name: 'Sign In' })
    await user.click(submitButton)

    expect(mockLogin).toHaveBeenCalledWith(
      'test@example.com',
      'password123',
      true
    )
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('should show loading state during login', async () => {
    const user = userEvent.setup()
    mockAuthState = {
      isLoading: true,
      error: null,
    }

    render(<LoginForm />)

    const submitButton = screen.getByRole('button', { name: /Signing in/ })
    expect(submitButton).toBeDisabled()
    expect(screen.getByText('Signing in...')).toBeInTheDocument()
  })

  it('should handle login failure', async () => {
    const user = userEvent.setup()
    const onSuccess = jest.fn()
    mockLogin.mockRejectedValue(new Error('Login failed'))

    render(<LoginForm onSuccess={onSuccess} />)

    const emailInput = screen.getByLabelText('Email Address')
    const passwordInput = screen.getByLabelText('Password')

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')

    const submitButton = screen.getByRole('button', { name: 'Sign In' })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled()
      expect(onSuccess).not.toHaveBeenCalled()
    })
  })

  it('should toggle to register form when link is clicked', async () => {
    const user = userEvent.setup()
    const onToggleMode = jest.fn()

    render(<LoginForm onToggleMode={onToggleMode} />)

    const toggleLink = screen.getByTestId('toggle-register')
    await user.click(toggleLink)

    expect(onToggleMode).toHaveBeenCalled()
  })

  it('should not show toggle link when onToggleMode is not provided', () => {
    render(<LoginForm />)

    expect(screen.queryByText("Don't have an account?")).not.toBeInTheDocument()
    expect(screen.queryByTestId('toggle-register')).not.toBeInTheDocument()
  })
})
