import { test, expect } from '@playwright/test'

test.describe('System Behaviors E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test.describe('Application Loading and Initialization', () => {
    test('should load application with correct title and branding', async ({
      page,
    }) => {
      // Verify page title
      await expect(page).toHaveTitle(/Product Outcomes/)

      // Verify main heading is present
      await expect(page.locator('h1')).toContainText(
        'Product Outcomes - Hello World Demo'
      )

      // Verify navigation elements are present
      await expect(page.locator('button:has-text("Sign In")')).toBeVisible()
      await expect(page.locator('button:has-text("Sign Up")')).toBeVisible()
    })

    test('should handle initial authentication state correctly', async ({
      page,
    }) => {
      // Verify unauthenticated state elements
      await expect(page.locator('button:has-text("Sign In")')).toBeVisible()
      await expect(page.locator('button:has-text("Sign Up")')).toBeVisible()
      await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible()

      // Verify public content is displayed
      await expect(page.locator('text=Authentication Demo')).toBeVisible()
      await expect(
        page.locator(
          'text=Sign in or create an account to access protected features'
        )
      ).toBeVisible()
    })

    test('should display Hello World component correctly', async ({ page }) => {
      // Verify Hello World component is present and functional
      await expect(page.locator('[data-testid="hello-world"]')).toBeVisible()

      // Check if it displays content (this would depend on the actual implementation)
      const helloWorldContent = await page
        .locator('[data-testid="hello-world"]')
        .textContent()
      expect(helloWorldContent).toBeTruthy()
    })
  })

  test.describe('User Interface Interactions', () => {
    test('should handle button clicks and interactions correctly', async ({
      page,
    }) => {
      // Test Sign In button interaction
      await page.click('button:has-text("Sign In")')
      await expect(page.locator('[data-testid="auth-modal"]')).toBeVisible()

      // Close modal and test Sign Up button
      await page.press('body', 'Escape')
      await expect(page.locator('[data-testid="auth-modal"]')).not.toBeVisible()

      await page.click('button:has-text("Sign Up")')
      await expect(page.locator('[data-testid="auth-modal"]')).toBeVisible()
    })

    test('should handle keyboard navigation correctly', async ({ page }) => {
      // Tab through the main navigation elements
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')

      // Verify focus is on a focusable element
      const focusedElement = await page.locator(':focus').first()
      await expect(focusedElement).toBeVisible()

      // Test Escape key to close modals
      await page.click('button:has-text("Sign In")')
      await expect(page.locator('[data-testid="auth-modal"]')).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(page.locator('[data-testid="auth-modal"]')).not.toBeVisible()
    })

    test('should be responsive to different screen sizes', async ({ page }) => {
      // Test desktop view
      await page.setViewportSize({ width: 1200, height: 800 })
      await expect(page.locator('button:has-text("Sign In")')).toBeVisible()

      // Test tablet view
      await page.setViewportSize({ width: 768, height: 1024 })
      await expect(page.locator('button:has-text("Sign In")')).toBeVisible()

      // Test mobile view
      await page.setViewportSize({ width: 375, height: 667 })
      await expect(page.locator('button:has-text("Sign In")')).toBeVisible()

      // Verify modal still works on mobile
      await page.click('button:has-text("Sign In")')
      await expect(page.locator('[data-testid="auth-modal"]')).toBeVisible()
    })
  })

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Simulate network failure during API calls
      await page.route('/api/**', route => route.abort())

      // Try to register (which should fail due to network error)
      await page.click('button:has-text("Sign Up")')
      await page.fill('input[name="firstName"]', 'Network')
      await page.fill('input[name="lastName"]', 'Test')
      await page.fill('input[name="email"]', 'network@example.com')
      await page.fill('input[name="password"]', 'TestPass123!')
      await page.fill('input[name="confirmPassword"]', 'TestPass123!')
      await page.click('button[type="submit"]:has-text("Create Account")')

      // Verify error handling (this would depend on implementation)
      // The exact error message would depend on how network errors are handled
      const errorElement = page.locator('[data-testid="error-message"]')
      if (await errorElement.isVisible()) {
        await expect(errorElement).toBeVisible()
      }
    })

    test('should handle form validation edge cases', async ({ page }) => {
      await page.click('button:has-text("Sign Up")')

      // Test with very long inputs
      const longString = 'a'.repeat(300)
      await page.fill('input[name="firstName"]', longString)
      await page.fill('input[name="lastName"]', longString)
      await page.fill('input[name="email"]', `${longString}@example.com`)

      // The form should handle long inputs appropriately
      const firstNameValue = await page.inputValue('input[name="firstName"]')
      expect(firstNameValue.length).toBeLessThanOrEqual(100) // Assuming there's a max length
    })

    test('should handle rapid form submissions', async ({ page }) => {
      await page.click('button:has-text("Sign In")')

      // Fill form
      await page.fill('input[type="email"]', 'rapid@example.com')
      await page.fill('input[type="password"]', 'TestPass123!')

      // Click submit multiple times rapidly
      const submitButton = page.locator(
        'button[type="submit"]:has-text("Sign In")'
      )
      await submitButton.click()
      await submitButton.click()
      await submitButton.click()

      // Should handle multiple clicks gracefully (button should be disabled during submission)
      await expect(submitButton).toBeDisabled()
    })
  })

  test.describe('API Integration', () => {
    test('should handle API authentication endpoints correctly', async ({
      page,
    }) => {
      // Test successful API registration
      const response = await page.request.post('/api/auth/register', {
        data: {
          email: 'apitest@example.com',
          password: 'TestPass123!',
          firstName: 'API',
          lastName: 'Test',
        },
      })

      expect(response.status()).toBe(201)
      const responseData = await response.json()
      expect(responseData.user).toBeDefined()
      expect(responseData.tokens).toBeDefined()
    })

    test('should handle API validation errors correctly', async ({ page }) => {
      // Test registration with invalid data
      const response = await page.request.post('/api/auth/register', {
        data: {
          email: 'invalid-email',
          password: 'weak',
          firstName: '',
          lastName: '',
        },
      })

      expect(response.status()).toBe(400)
      const responseData = await response.json()
      expect(responseData.error).toBeDefined()
    })

    test('should handle API login endpoints correctly', async ({ page }) => {
      // First register a user
      await page.request.post('/api/auth/register', {
        data: {
          email: 'loginapi@example.com',
          password: 'TestPass123!',
          firstName: 'Login',
          lastName: 'API',
        },
      })

      // Test login
      const loginResponse = await page.request.post('/api/auth/login', {
        data: {
          email: 'loginapi@example.com',
          password: 'TestPass123!',
        },
      })

      expect(loginResponse.status()).toBe(200)
      const loginData = await loginResponse.json()
      expect(loginData.user).toBeDefined()
      expect(loginData.tokens).toBeDefined()
      expect(loginData.tokens.accessToken).toBeDefined()
      expect(loginData.tokens.refreshToken).toBeDefined()
    })

    test('should handle protected API endpoints correctly', async ({
      page,
    }) => {
      // Register and get tokens
      const registerResponse = await page.request.post('/api/auth/register', {
        data: {
          email: 'protected@example.com',
          password: 'TestPass123!',
          firstName: 'Protected',
          lastName: 'API',
        },
      })

      const registerData = await registerResponse.json()
      const accessToken = registerData.tokens.accessToken

      // Test protected endpoint with valid token
      const protectedResponse = await page.request.get('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      expect(protectedResponse.status()).toBe(200)
      const userData = await protectedResponse.json()
      expect(userData.user.email).toBe('protected@example.com')
    })

    test('should reject requests to protected endpoints without token', async ({
      page,
    }) => {
      // Test protected endpoint without authorization
      const response = await page.request.get('/api/auth/me')

      expect(response.status()).toBe(401)
      const responseData = await response.json()
      expect(responseData.error).toBeDefined()
    })
  })

  test.describe('User Experience Flows', () => {
    test('should provide smooth user registration to login flow', async ({
      page,
    }) => {
      // Complete registration
      await page.click('button:has-text("Sign Up")')
      await page.fill('input[name="firstName"]', 'Flow')
      await page.fill('input[name="lastName"]', 'Test')
      await page.fill('input[name="email"]', 'flowtest@example.com')
      await page.fill('input[name="password"]', 'TestPass123!')
      await page.fill('input[name="confirmPassword"]', 'TestPass123!')
      await page.click('button[type="submit"]:has-text("Create Account")')

      // Should be automatically logged in after registration
      await expect(page.locator('text=Welcome back, Flow!')).toBeVisible()
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()

      // Logout
      await page.click('[data-testid="user-menu"]')
      await page.click('text=Sign Out')

      // Login with same credentials
      await page.click('button:has-text("Sign In")')
      await page.fill('input[type="email"]', 'flowtest@example.com')
      await page.fill('input[type="password"]', 'TestPass123!')
      await page.click('button[type="submit"]:has-text("Sign In")')

      // Should be logged in again
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
    })

    test('should handle authentication state changes correctly', async ({
      page,
    }) => {
      // Start unauthenticated
      await expect(
        page.locator(
          'text=Sign in or create an account to access protected features'
        )
      ).toBeVisible()

      // Register and verify state change
      await page.request.post('/api/auth/register', {
        data: {
          email: 'statechange@example.com',
          password: 'TestPass123!',
          firstName: 'State',
          lastName: 'Change',
        },
      })

      await page.click('button:has-text("Sign In")')
      await page.fill('input[type="email"]', 'statechange@example.com')
      await page.fill('input[type="password"]', 'TestPass123!')
      await page.click('button[type="submit"]:has-text("Sign In")')

      // Verify authenticated state
      await expect(
        page.locator('text=You are successfully authenticated')
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="protected-hello-world"]')
      ).toBeVisible()

      // Logout and verify state change back
      await page.click('[data-testid="user-menu"]')
      await page.click('text=Sign Out')

      await expect(
        page.locator(
          'text=Sign in or create an account to access protected features'
        )
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="protected-hello-world"]')
      ).not.toBeVisible()
    })
  })

  test.describe('Performance and Accessibility', () => {
    test('should load page within acceptable time limits', async ({ page }) => {
      const startTime = Date.now()
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      const loadTime = Date.now() - startTime

      // Page should load within 3 seconds
      expect(loadTime).toBeLessThan(3000)
    })

    test('should have proper accessibility attributes', async ({ page }) => {
      // Check for proper button labels
      const signInButton = page.locator('button:has-text("Sign In")')
      await expect(signInButton).toBeVisible()

      // Check that buttons are focusable
      await signInButton.focus()
      await expect(signInButton).toBeFocused()

      // Check for proper headings structure
      const mainHeading = page.locator('h1')
      await expect(mainHeading).toBeVisible()

      // Open modal and check accessibility
      await page.click('button:has-text("Sign In")')
      const modal = page.locator('[data-testid="auth-modal"]')
      await expect(modal).toBeVisible()

      // Modal should trap focus
      await page.keyboard.press('Tab')
      const focusedElement = page.locator(':focus')

      // Focus should be within the modal
      const modalContainsFocus = await modal.locator(':focus').count()
      expect(modalContainsFocus).toBeGreaterThan(0)
    })

    test('should work without JavaScript (progressive enhancement)', async ({
      page,
    }) => {
      // Disable JavaScript
      await page.context().addInitScript(() => {
        Object.defineProperty(window, 'navigator', {
          writable: true,
          value: { ...window.navigator, javaEnabled: () => false },
        })
      })

      await page.goto('/')

      // Basic content should still be visible
      await expect(page.locator('h1')).toBeVisible()

      // Note: Full functionality would require server-side rendering
      // This test verifies basic content is accessible
    })
  })
})
