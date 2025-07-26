import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UserMenu } from './UserMenu'
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

const mockAuthState = {
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
  updateProfile: jest.fn(),
  changePassword: jest.fn(),
}

const renderWithAuth = (component: React.ReactElement) => {
  mockUseAuth.mockReturnValue(mockAuthState)
  return render(component)
}

describe('UserMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAuth.mockReturnValue(mockAuthState)
  })

  describe('User Display', () => {
    it('should display user full name', () => {
      renderWithAuth(<UserMenu />)

      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    it('should display user email', async () => {
      renderWithAuth(<UserMenu />)

      const menuButton = screen.getByTestId('user-menu')
      fireEvent.click(menuButton)

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument()
      })
    })

    it('should have user menu trigger button', () => {
      renderWithAuth(<UserMenu />)

      const menuButton = screen.getByTestId('user-menu')
      expect(menuButton).toBeInTheDocument()
      expect(menuButton).toHaveAttribute('aria-haspopup', 'true')
    })

    it('should display user initials in avatar', () => {
      renderWithAuth(<UserMenu />)

      expect(screen.getByText('JD')).toBeInTheDocument()
    })
  })

  describe('Menu Interactions', () => {
    it('should open menu when clicked', async () => {
      renderWithAuth(<UserMenu />)

      const menuButton = screen.getByTestId('user-menu')
      fireEvent.click(menuButton)

      await waitFor(() => {
        expect(screen.getByText('View Profile')).toBeInTheDocument()
        expect(screen.getByText('Settings')).toBeInTheDocument()
        expect(screen.getByText('Sign Out')).toBeInTheDocument()
      })
    })

    it('should close menu when clicked outside', async () => {
      renderWithAuth(<UserMenu />)

      const menuButton = screen.getByTestId('user-menu')
      fireEvent.click(menuButton)

      await waitFor(() => {
        expect(screen.getByText('Sign Out')).toBeInTheDocument()
      })

      // Click outside
      fireEvent.mouseDown(document.body)

      await waitFor(() => {
        expect(screen.queryByText('Sign Out')).not.toBeInTheDocument()
      })
    })

    it('should close menu when same button is clicked again', async () => {
      renderWithAuth(<UserMenu />)

      const menuButton = screen.getByTestId('user-menu')

      // Open menu
      fireEvent.click(menuButton)
      await waitFor(() => {
        expect(screen.getByText('Sign Out')).toBeInTheDocument()
      })

      // Close menu
      fireEvent.click(menuButton)
      await waitFor(() => {
        expect(screen.queryByText('Sign Out')).not.toBeInTheDocument()
      })
    })
  })

  describe('Menu Options', () => {
    it('should display Sign Out option', async () => {
      renderWithAuth(<UserMenu />)

      const menuButton = screen.getByTestId('user-menu')
      fireEvent.click(menuButton)

      await waitFor(() => {
        expect(screen.getByText('Sign Out')).toBeInTheDocument()
      })
    })

    it('should display Profile option', async () => {
      renderWithAuth(<UserMenu />)

      const menuButton = screen.getByTestId('user-menu')
      fireEvent.click(menuButton)

      await waitFor(() => {
        expect(screen.getByText('View Profile')).toBeInTheDocument()
      })
    })

    it('should display Settings option', async () => {
      renderWithAuth(<UserMenu />)

      const menuButton = screen.getByTestId('user-menu')
      fireEvent.click(menuButton)

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument()
      })
    })
  })

  describe('Logout Functionality', () => {
    it('should call logout when Sign Out is clicked', async () => {
      renderWithAuth(<UserMenu />)

      const menuButton = screen.getByTestId('user-menu')
      fireEvent.click(menuButton)

      await waitFor(() => {
        expect(screen.getByText('Sign Out')).toBeInTheDocument()
      })

      const signOutButton = screen.getByText('Sign Out')
      fireEvent.click(signOutButton)

      expect(mockAuthState.logout).toHaveBeenCalledTimes(1)
    })

    it('should close menu after logout', async () => {
      renderWithAuth(<UserMenu />)

      const menuButton = screen.getByTestId('user-menu')
      fireEvent.click(menuButton)

      await waitFor(() => {
        expect(screen.getByText('Sign Out')).toBeInTheDocument()
      })

      const signOutButton = screen.getByText('Sign Out')
      fireEvent.click(signOutButton)

      await waitFor(() => {
        expect(screen.queryByText('Sign Out')).not.toBeInTheDocument()
      })
    })
  })

  describe('Menu Item Actions', () => {
    it('should handle Profile click', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      renderWithAuth(<UserMenu />)

      const menuButton = screen.getByTestId('user-menu')
      fireEvent.click(menuButton)

      await waitFor(() => {
        expect(screen.getByText('View Profile')).toBeInTheDocument()
      })

      const profileButton = screen.getByText('View Profile')
      fireEvent.click(profileButton)

      expect(consoleSpy).toHaveBeenCalledWith('View profile clicked')
      consoleSpy.mockRestore()
    })

    it('should handle Settings click', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      renderWithAuth(<UserMenu />)

      const menuButton = screen.getByTestId('user-menu')
      fireEvent.click(menuButton)

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument()
      })

      const settingsButton = screen.getByText('Settings')
      fireEvent.click(settingsButton)

      expect(consoleSpy).toHaveBeenCalledWith('Settings clicked')
      consoleSpy.mockRestore()
    })

    it('should close menu after Profile click', async () => {
      renderWithAuth(<UserMenu />)

      const menuButton = screen.getByTestId('user-menu')
      fireEvent.click(menuButton)

      await waitFor(() => {
        expect(screen.getByText('View Profile')).toBeInTheDocument()
      })

      const profileButton = screen.getByText('View Profile')
      fireEvent.click(profileButton)

      await waitFor(() => {
        expect(screen.queryByText('View Profile')).not.toBeInTheDocument()
      })
    })

    it('should close menu after Settings click', async () => {
      renderWithAuth(<UserMenu />)

      const menuButton = screen.getByTestId('user-menu')
      fireEvent.click(menuButton)

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument()
      })

      const settingsButton = screen.getByText('Settings')
      fireEvent.click(settingsButton)

      await waitFor(() => {
        expect(screen.queryByText('Settings')).not.toBeInTheDocument()
      })
    })

    it('should handle logout error gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      const mockLogoutError = jest.fn().mockRejectedValue(new Error('Logout failed'))
      
      mockUseAuth.mockReturnValue({
        ...mockAuthState,
        logout: mockLogoutError,
      })

      render(<UserMenu />)

      const menuButton = screen.getByTestId('user-menu')
      fireEvent.click(menuButton)

      await waitFor(() => {
        expect(screen.getByText('Sign Out')).toBeInTheDocument()
      })

      const signOutButton = screen.getByText('Sign Out')
      fireEvent.click(signOutButton)

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Logout failed:', expect.any(Error))
      })

      expect(mockLogoutError).toHaveBeenCalledTimes(1)
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      renderWithAuth(<UserMenu />)

      const menuButton = screen.getByTestId('user-menu')
      expect(menuButton).toHaveAttribute('aria-haspopup', 'true')
      expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    })

    it('should update aria-expanded when menu is opened', async () => {
      renderWithAuth(<UserMenu />)

      const menuButton = screen.getByTestId('user-menu')
      fireEvent.click(menuButton)

      await waitFor(() => {
        expect(menuButton).toHaveAttribute('aria-expanded', 'true')
      })
    })

    it('should be keyboard navigable', async () => {
      renderWithAuth(<UserMenu />)

      const menuButton = screen.getByTestId('user-menu')

      // Focus and press Enter to open menu
      menuButton.focus()
      fireEvent.keyDown(menuButton, { key: 'Enter' })

      await waitFor(() => {
        expect(screen.getByText('Sign Out')).toBeInTheDocument()
      })

      // Press Escape to close menu
      fireEvent.keyDown(document, { key: 'Escape' })

      await waitFor(() => {
        expect(screen.queryByText('Sign Out')).not.toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle user with missing name gracefully', async () => {
      const mockStateWithoutName = {
        ...mockAuthState,
        state: {
          ...mockAuthState.state,
          user: {
            ...mockUser,
            firstName: '',
            lastName: '',
          },
        },
      }

      mockUseAuth.mockReturnValue(mockStateWithoutName)
      render(<UserMenu />)

      const menuButton = screen.getByTestId('user-menu')
      fireEvent.click(menuButton)

      // Should still display the email
      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument()
      })
    })

    it('should handle very long names appropriately', () => {
      const mockStateWithLongName = {
        ...mockAuthState,
        state: {
          ...mockAuthState.state,
          user: {
            ...mockUser,
            firstName: 'VeryLongFirstNameThatExceedsNormalLength',
            lastName: 'VeryLongLastNameThatExceedsNormalLengthAsWell',
          },
        },
      }

      mockUseAuth.mockReturnValue(mockStateWithLongName)
      render(<UserMenu />)

      const userName = screen.getByText(
        /VeryLongFirstNameThatExceedsNormalLength VeryLongLastNameThatExceedsNormalLengthAsWell/
      )
      expect(userName).toBeInTheDocument()
    })

    it('should not render when user is not authenticated', () => {
      const unauthenticatedState = {
        ...mockAuthState,
        state: {
          ...mockAuthState.state,
          isAuthenticated: false,
          user: null,
        },
      }

      mockUseAuth.mockReturnValue(unauthenticatedState)
      render(<UserMenu />)

      expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument()
    })

    it('should not render when user is null', () => {
      const nullUserState = {
        ...mockAuthState,
        state: {
          ...mockAuthState.state,
          user: null,
        },
      }

      mockUseAuth.mockReturnValue(nullUserState)
      render(<UserMenu />)

      expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument()
    })
  })
})