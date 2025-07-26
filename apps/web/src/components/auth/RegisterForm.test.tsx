import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RegisterForm } from './RegisterForm'

// Mock the auth context
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    register: mockRegister,
    state: mockAuthState,
  }),
}))

let mockRegister = jest.fn()
let mockAuthState = {
  isLoading: false,
  error: null,
}

describe('RegisterForm', () => {
  beforeEach(() => {
    mockRegister = jest.fn()
    mockAuthState = {
      isLoading: false,
      error: null,
    }
  })

  it('should render registration form elements', () => {
    render(<RegisterForm />)

    expect(screen.getByText('Create Account')).toBeInTheDocument()
    expect(screen.getByText('Sign up for a new account')).toBeInTheDocument()
    expect(screen.getByLabelText('First Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Last Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Create Account' })
    ).toBeInTheDocument()
  })

  it('should display error message when state has error', () => {
    mockAuthState = {
      isLoading: false,
      error: 'Email already exists',
    }

    render(<RegisterForm />)

    expect(screen.getByText('Email already exists')).toBeInTheDocument()
  })

  it('should validate required fields', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    const submitButton = screen.getByRole('button', { name: 'Create Account' })
    await user.click(submitButton)

    expect(screen.getByText('First name is required')).toBeInTheDocument()
    expect(screen.getByText('Last name is required')).toBeInTheDocument()
    expect(screen.getByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(screen.getByText('Please confirm your password')).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('should validate email format', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    const emailInput = screen.getByLabelText('Email Address')
    await user.type(emailInput, 'invalid-email')

    const submitButton = screen.getByRole('button', { name: 'Create Account' })
    await user.click(submitButton)

    expect(
      screen.getByText('Please enter a valid email address')
    ).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('should validate password strength', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    const passwordInput = screen.getByLabelText('Password')
    await user.type(passwordInput, 'weak')

    const submitButton = screen.getByRole('button', { name: 'Create Account' })
    await user.click(submitButton)

    expect(
      screen.getByText('Password must be at least 8 characters long')
    ).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('should validate password complexity', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    const passwordInput = screen.getByLabelText('Password')
    await user.type(passwordInput, 'alllowercase')

    const submitButton = screen.getByRole('button', { name: 'Create Account' })
    await user.click(submitButton)

    expect(
      screen.getByText(
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      )
    ).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('should validate password confirmation match', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    const passwordInput = screen.getByLabelText('Password')
    const confirmPasswordInput = screen.getByLabelText('Confirm Password')

    await user.type(passwordInput, 'SecurePass123')
    await user.type(confirmPasswordInput, 'DifferentPass123')

    const submitButton = screen.getByRole('button', { name: 'Create Account' })
    await user.click(submitButton)

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('should clear errors when user starts typing', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    // First submit to trigger errors
    const submitButton = screen.getByRole('button', { name: 'Create Account' })
    await user.click(submitButton)

    expect(screen.getByText('First name is required')).toBeInTheDocument()

    // Start typing in first name field
    const firstNameInput = screen.getByLabelText('First Name')
    await user.type(firstNameInput, 'J')

    expect(screen.queryByText('First name is required')).not.toBeInTheDocument()
  })

  it('should submit form with valid data', async () => {
    const user = userEvent.setup()
    const onSuccess = jest.fn()
    mockRegister.mockResolvedValue(undefined)

    render(<RegisterForm onSuccess={onSuccess} />)

    const firstNameInput = screen.getByLabelText('First Name')
    const lastNameInput = screen.getByLabelText('Last Name')
    const emailInput = screen.getByLabelText('Email Address')
    const passwordInput = screen.getByLabelText('Password')
    const confirmPasswordInput = screen.getByLabelText('Confirm Password')

    await user.type(firstNameInput, 'John')
    await user.type(lastNameInput, 'Doe')
    await user.type(emailInput, 'john.doe@example.com')
    await user.type(passwordInput, 'SecurePass123')
    await user.type(confirmPasswordInput, 'SecurePass123')

    const submitButton = screen.getByRole('button', { name: 'Create Account' })
    await user.click(submitButton)

    expect(mockRegister).toHaveBeenCalledWith({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'SecurePass123',
    })

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('should trim whitespace from names', async () => {
    const user = userEvent.setup()
    mockRegister.mockResolvedValue(undefined)

    render(<RegisterForm />)

    const firstNameInput = screen.getByLabelText('First Name')
    const lastNameInput = screen.getByLabelText('Last Name')
    const emailInput = screen.getByLabelText('Email Address')
    const passwordInput = screen.getByLabelText('Password')
    const confirmPasswordInput = screen.getByLabelText('Confirm Password')

    await user.type(firstNameInput, '  John  ')
    await user.type(lastNameInput, '  Doe  ')
    await user.type(emailInput, 'john.doe@example.com')
    await user.type(passwordInput, 'SecurePass123')
    await user.type(confirmPasswordInput, 'SecurePass123')

    const submitButton = screen.getByRole('button', { name: 'Create Account' })
    await user.click(submitButton)

    expect(mockRegister).toHaveBeenCalledWith({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'SecurePass123',
    })
  })

  it('should show loading state during registration', () => {
    mockAuthState = {
      isLoading: true,
      error: null,
    }

    render(<RegisterForm />)

    const submitButton = screen.getByRole('button', {
      name: /Creating account/,
    })
    expect(submitButton).toBeDisabled()
    expect(screen.getByText('Creating account...')).toBeInTheDocument()
  })

  it('should handle registration failure', async () => {
    const user = userEvent.setup()
    const onSuccess = jest.fn()
    mockRegister.mockRejectedValue(new Error('Registration failed'))

    render(<RegisterForm onSuccess={onSuccess} />)

    const firstNameInput = screen.getByLabelText('First Name')
    const lastNameInput = screen.getByLabelText('Last Name')
    const emailInput = screen.getByLabelText('Email Address')
    const passwordInput = screen.getByLabelText('Password')
    const confirmPasswordInput = screen.getByLabelText('Confirm Password')

    await user.type(firstNameInput, 'John')
    await user.type(lastNameInput, 'Doe')
    await user.type(emailInput, 'john.doe@example.com')
    await user.type(passwordInput, 'SecurePass123')
    await user.type(confirmPasswordInput, 'SecurePass123')

    const submitButton = screen.getByRole('button', { name: 'Create Account' })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled()
      expect(onSuccess).not.toHaveBeenCalled()
    })
  })

  it('should toggle to login form when link is clicked', async () => {
    const user = userEvent.setup()
    const onToggleMode = jest.fn()

    render(<RegisterForm onToggleMode={onToggleMode} />)

    const toggleLink = screen.getByTestId('toggle-login')
    await user.click(toggleLink)

    expect(onToggleMode).toHaveBeenCalled()
  })

  it('should not show toggle link when onToggleMode is not provided', () => {
    render(<RegisterForm />)

    expect(
      screen.queryByText('Already have an account?')
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('toggle-login')).not.toBeInTheDocument()
  })
})
