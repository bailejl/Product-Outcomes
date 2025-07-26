import { test, expect } from '@playwright/test'

test.describe('Authentication E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application home page before each test
    await page.goto('/')
  })

  test.describe('Login Flow', () => {
    test('should display login form when Sign In button is clicked', async ({
      page,
    }) => {
      // Click the Sign In button
      await page.click('button:has-text("Sign In")')

      // Verify login form is displayed
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible()
      await expect(page.locator('h2:has-text("Welcome Back")')).toBeVisible()

      // Verify form fields are present
      await expect(page.locator('input[type="email"]')).toBeVisible()
      await expect(page.locator('input[type="password"]')).toBeVisible()
      await expect(page.locator('input[type="checkbox"]')).toBeVisible() // Remember me
      await expect(page.locator('button:has-text("Sign In")')).toBeVisible()
    })

    test('should show validation errors for empty login form', async ({
      page,
    }) => {
      // Click Sign In to open modal
      await page.click('button:has-text("Sign In")')

      // Try to submit empty form
      await page.click('button[type="submit"]:has-text("Sign In")')

      // Verify validation errors are displayed
      await expect(page.locator('text=Email is required')).toBeVisible()
      await expect(page.locator('text=Password is required')).toBeVisible()
    })

    test('should show validation error for invalid email format', async ({
      page,
    }) => {
      // Click Sign In to open modal
      await page.click('button:has-text("Sign In")')

      // Enter invalid email
      await page.fill('input[type="email"]', 'invalid-email')
      await page.click('button[type="submit"]:has-text("Sign In")')

      // Verify email validation error
      await expect(
        page.locator('text=Please enter a valid email address')
      ).toBeVisible()
    })

    test('should show error for invalid credentials', async ({ page }) => {
      // Click Sign In to open modal
      await page.click('button:has-text("Sign In")')

      // Enter invalid credentials
      await page.fill('input[type="email"]', 'nonexistent@example.com')
      await page.fill('input[type="password"]', 'wrongpassword')
      await page.click('button[type="submit"]:has-text("Sign In")')

      // Verify authentication error
      await expect(page.locator('text=Invalid email or password')).toBeVisible()
    })

    test('should successfully login with valid credentials', async ({
      page,
    }) => {
      // First register a test user through API
      await page.request.post('/api/auth/register', {
        data: {
          email: 'testuser@example.com',
          password: 'TestPass123!',
          firstName: 'Test',
          lastName: 'User',
        },
      })

      // Click Sign In to open modal
      await page.click('button:has-text("Sign In")')

      // Enter valid credentials
      await page.fill('input[type="email"]', 'testuser@example.com')
      await page.fill('input[type="password"]', 'TestPass123!')
      await page.click('button[type="submit"]:has-text("Sign In")')

      // Verify successful login
      await expect(page.locator('text=Welcome back, Test!')).toBeVisible()
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
      await expect(page.locator('text=Test User')).toBeVisible()

      // Verify modal is closed
      await expect(page.locator('[data-testid="auth-modal"]')).not.toBeVisible()
    })

    test('should remember login state with Remember Me checkbox', async ({
      page,
    }) => {
      // Register a test user
      await page.request.post('/api/auth/register', {
        data: {
          email: 'rememberuser@example.com',
          password: 'TestPass123!',
          firstName: 'Remember',
          lastName: 'User',
        },
      })

      // Click Sign In to open modal
      await page.click('button:has-text("Sign In")')

      // Enter credentials and check Remember Me
      await page.fill('input[type="email"]', 'rememberuser@example.com')
      await page.fill('input[type="password"]', 'TestPass123!')
      await page.check('input[type="checkbox"]') // Remember me
      await page.click('button[type="submit"]:has-text("Sign In")')

      // Verify login
      await expect(page.locator('text=Welcome back, Remember!')).toBeVisible()

      // Refresh page and verify user is still logged in
      await page.reload()
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
      await expect(page.locator('text=Remember User')).toBeVisible()
    })
  })

  test.describe('Registration Flow', () => {
    test('should display registration form when Sign Up button is clicked', async ({
      page,
    }) => {
      // Click the Sign Up button
      await page.click('button:has-text("Sign Up")')

      // Verify registration form is displayed
      await expect(page.locator('[data-testid="register-form"]')).toBeVisible()
      await expect(page.locator('h2:has-text("Create Account")')).toBeVisible()

      // Verify form fields are present
      await expect(page.locator('input[name="firstName"]')).toBeVisible()
      await expect(page.locator('input[name="lastName"]')).toBeVisible()
      await expect(page.locator('input[type="email"]')).toBeVisible()
      await expect(page.locator('input[name="password"]')).toBeVisible()
      await expect(page.locator('input[name="confirmPassword"]')).toBeVisible()
      await expect(
        page.locator('button:has-text("Create Account")')
      ).toBeVisible()
    })

    test('should show validation errors for empty registration form', async ({
      page,
    }) => {
      // Click Sign Up to open modal
      await page.click('button:has-text("Sign Up")')

      // Try to submit empty form
      await page.click('button[type="submit"]:has-text("Create Account")')

      // Verify validation errors are displayed
      await expect(page.locator('text=First name is required')).toBeVisible()
      await expect(page.locator('text=Last name is required')).toBeVisible()
      await expect(page.locator('text=Email is required')).toBeVisible()
      await expect(page.locator('text=Password is required')).toBeVisible()
      await expect(
        page.locator('text=Please confirm your password')
      ).toBeVisible()
    })

    test('should show password strength validation', async ({ page }) => {
      // Click Sign Up to open modal
      await page.click('button:has-text("Sign Up")')

      // Enter weak password
      await page.fill('input[name="password"]', 'weak')
      await page.click('button[type="submit"]:has-text("Create Account")')

      // Verify password strength error
      await expect(
        page.locator('text=Password must be at least 8 characters long')
      ).toBeVisible()
    })

    test('should show password mismatch error', async ({ page }) => {
      // Click Sign Up to open modal
      await page.click('button:has-text("Sign Up")')

      // Enter mismatched passwords
      await page.fill('input[name="password"]', 'StrongPass123!')
      await page.fill('input[name="confirmPassword"]', 'DifferentPass123!')
      await page.click('button[type="submit"]:has-text("Create Account")')

      // Verify password mismatch error
      await expect(page.locator('text=Passwords do not match')).toBeVisible()
    })

    test('should successfully register new user', async ({ page }) => {
      // Click Sign Up to open modal
      await page.click('button:has-text("Sign Up")')

      // Fill registration form
      await page.fill('input[name="firstName"]', 'John')
      await page.fill('input[name="lastName"]', 'Doe')
      await page.fill('input[name="email"]', 'john.doe@example.com')
      await page.fill('input[name="password"]', 'SecurePass123!')
      await page.fill('input[name="confirmPassword"]', 'SecurePass123!')
      await page.click('button[type="submit"]:has-text("Create Account")')

      // Verify successful registration and automatic login
      await expect(page.locator('text=Welcome back, John!')).toBeVisible()
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
      await expect(page.locator('text=John Doe')).toBeVisible()

      // Verify modal is closed
      await expect(page.locator('[data-testid="auth-modal"]')).not.toBeVisible()
    })

    test('should show error for duplicate email registration', async ({
      page,
    }) => {
      // First registration
      await page.request.post('/api/auth/register', {
        data: {
          email: 'duplicate@example.com',
          password: 'TestPass123!',
          firstName: 'First',
          lastName: 'User',
        },
      })

      // Try to register with same email
      await page.click('button:has-text("Sign Up")')
      await page.fill('input[name="firstName"]', 'Second')
      await page.fill('input[name="lastName"]', 'User')
      await page.fill('input[name="email"]', 'duplicate@example.com')
      await page.fill('input[name="password"]', 'TestPass123!')
      await page.fill('input[name="confirmPassword"]', 'TestPass123!')
      await page.click('button[type="submit"]:has-text("Create Account")')

      // Verify duplicate email error
      await expect(
        page.locator('text=User with this email already exists')
      ).toBeVisible()
    })
  })

  test.describe('Form Navigation', () => {
    test('should toggle between login and registration forms', async ({
      page,
    }) => {
      // Start with login form
      await page.click('button:has-text("Sign In")')
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible()

      // Switch to registration form
      await page.click('text=Sign up here')
      await expect(page.locator('[data-testid="register-form"]')).toBeVisible()
      await expect(page.locator('[data-testid="login-form"]')).not.toBeVisible()

      // Switch back to login form
      await page.click('text=Sign in here')
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible()
      await expect(
        page.locator('[data-testid="register-form"]')
      ).not.toBeVisible()
    })

    test('should close authentication modal when close button is clicked', async ({
      page,
    }) => {
      // Open login modal
      await page.click('button:has-text("Sign In")')
      await expect(page.locator('[data-testid="auth-modal"]')).toBeVisible()

      // Close modal
      await page.click('[data-testid="close-modal"]')
      await expect(page.locator('[data-testid="auth-modal"]')).not.toBeVisible()
    })

    test('should close modal when clicking outside', async ({ page }) => {
      // Open login modal
      await page.click('button:has-text("Sign In")')
      await expect(page.locator('[data-testid="auth-modal"]')).toBeVisible()

      // Click outside modal (on backdrop)
      await page.click('[data-testid="modal-backdrop"]')
      await expect(page.locator('[data-testid="auth-modal"]')).not.toBeVisible()
    })
  })

  test.describe('Logout Flow', () => {
    test('should successfully logout user', async ({ page }) => {
      // Register and login a user
      await page.request.post('/api/auth/register', {
        data: {
          email: 'logoutuser@example.com',
          password: 'TestPass123!',
          firstName: 'Logout',
          lastName: 'User',
        },
      })

      await page.click('button:has-text("Sign In")')
      await page.fill('input[type="email"]', 'logoutuser@example.com')
      await page.fill('input[type="password"]', 'TestPass123!')
      await page.click('button[type="submit"]:has-text("Sign In")')

      // Verify login
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()

      // Click user menu to open dropdown
      await page.click('[data-testid="user-menu"]')

      // Click logout
      await page.click('text=Sign Out')

      // Verify logout
      await expect(page.locator('button:has-text("Sign In")')).toBeVisible()
      await expect(page.locator('button:has-text("Sign Up")')).toBeVisible()
      await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible()
    })
  })

  test.describe('Protected Content Access', () => {
    test('should show public content for unauthenticated users', async ({
      page,
    }) => {
      // Verify public content is visible
      await expect(page.locator('text=Authentication Demo')).toBeVisible()
      await expect(
        page.locator(
          'text=Sign in or create an account to access protected features'
        )
      ).toBeVisible()

      // Verify HelloWorld component is visible (public)
      await expect(page.locator('[data-testid="hello-world"]')).toBeVisible()
    })

    test('should show protected content for authenticated users', async ({
      page,
    }) => {
      // Register and login a user
      await page.request.post('/api/auth/register', {
        data: {
          email: 'protecteduser@example.com',
          password: 'TestPass123!',
          firstName: 'Protected',
          lastName: 'User',
        },
      })

      await page.click('button:has-text("Sign In")')
      await page.fill('input[type="email"]', 'protecteduser@example.com')
      await page.fill('input[type="password"]', 'TestPass123!')
      await page.click('button[type="submit"]:has-text("Sign In")')

      // Verify protected content is now visible
      await expect(
        page.locator('text=You are successfully authenticated')
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="protected-hello-world"]')
      ).toBeVisible()
    })
  })

  test.describe('Session Management', () => {
    test('should maintain session across page refreshes', async ({ page }) => {
      // Register and login a user
      await page.request.post('/api/auth/register', {
        data: {
          email: 'sessionuser@example.com',
          password: 'TestPass123!',
          firstName: 'Session',
          lastName: 'User',
        },
      })

      await page.click('button:has-text("Sign In")')
      await page.fill('input[type="email"]', 'sessionuser@example.com')
      await page.fill('input[type="password"]', 'TestPass123!')
      await page.click('button[type="submit"]:has-text("Sign In")')

      // Verify login
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()

      // Refresh page
      await page.reload()

      // Verify user is still logged in
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
      await expect(page.locator('text=Session User')).toBeVisible()
    })

    test('should handle expired tokens gracefully', async ({ page }) => {
      // This test would require setting up expired tokens
      // For now, we'll test the logout scenario which clears tokens

      // Register and login a user
      await page.request.post('/api/auth/register', {
        data: {
          email: 'expireduser@example.com',
          password: 'TestPass123!',
          firstName: 'Expired',
          lastName: 'User',
        },
      })

      await page.click('button:has-text("Sign In")')
      await page.fill('input[type="email"]', 'expireduser@example.com')
      await page.fill('input[type="password"]', 'TestPass123!')
      await page.click('button[type="submit"]:has-text("Sign In")')

      // Clear localStorage to simulate expired session
      await page.evaluate(() => {
        localStorage.clear()
      })

      // Refresh page
      await page.reload()

      // Verify user is logged out
      await expect(page.locator('button:has-text("Sign In")')).toBeVisible()
      await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible()
    })
  })
})
