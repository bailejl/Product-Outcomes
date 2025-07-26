import { test, expect } from '@playwright/test'

test.describe('Password Reset Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/')
  })

  test('should display forgot password form when forgot password is clicked', async ({ page }) => {
    // Open auth modal (assuming there's a login button)
    await page.click('[data-testid="login-button"]') // You may need to adjust this selector

    // Click forgot password link
    await page.click('[data-testid="forgot-password-link"]')

    // Verify forgot password form is displayed
    await expect(page.locator('[data-testid="forgot-password-form"]')).toBeVisible()
    await expect(page.locator('text=Forgot Password?')).toBeVisible()
    await expect(page.locator('[data-testid="forgot-password-email"]')).toBeVisible()
    await expect(page.locator('[data-testid="forgot-password-submit"]')).toBeVisible()
  })

  test('should show validation error for invalid email', async ({ page }) => {
    // Open forgot password form
    await page.click('[data-testid="login-button"]')
    await page.click('[data-testid="forgot-password-link"]')

    // Enter invalid email
    await page.fill('[data-testid="forgot-password-email"]', 'invalid-email')
    await page.click('[data-testid="forgot-password-submit"]')

    // Verify validation error
    await expect(page.locator('text=Please enter a valid email address')).toBeVisible()
  })

  test('should show success message for valid email', async ({ page }) => {
    // Open forgot password form
    await page.click('[data-testid="login-button"]')
    await page.click('[data-testid="forgot-password-link"]')

    // Enter valid email
    await page.fill('[data-testid="forgot-password-email"]', 'test@example.com')
    await page.click('[data-testid="forgot-password-submit"]')

    // Verify success message (may take a moment for API call)
    await expect(page.locator('text=Email sent successfully!')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Check your email and click the reset link')).toBeVisible()
  })

  test('should allow user to go back to login from forgot password', async ({ page }) => {
    // Open forgot password form
    await page.click('[data-testid="login-button"]')
    await page.click('[data-testid="forgot-password-link"]')

    // Click back to login
    await page.click('[data-testid="back-to-login"]')

    // Verify we're back to login form
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible()
    await expect(page.locator('text=Welcome Back')).toBeVisible()
  })

  test('should display reset password form with valid token', async ({ page }) => {
    // Navigate directly to reset password page with a mock token
    const mockToken = 'test-reset-token-123'
    await page.goto(`/auth/reset-password?token=${mockToken}`)

    // Verify reset password form loads (may show verifying state first)
    await expect(page.locator('[data-testid="reset-password-form"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Reset Your Password')).toBeVisible()
    await expect(page.locator('[data-testid="reset-new-password"]')).toBeVisible()
    await expect(page.locator('[data-testid="reset-confirm-password"]')).toBeVisible()
  })

  test('should show validation errors for password requirements', async ({ page }) => {
    const mockToken = 'test-reset-token-123'
    await page.goto(`/auth/reset-password?token=${mockToken}`)

    // Wait for form to load
    await expect(page.locator('[data-testid="reset-password-form"]')).toBeVisible({ timeout: 10000 })

    // Enter weak password
    await page.fill('[data-testid="reset-new-password"]', 'weak')
    await page.fill('[data-testid="reset-confirm-password"]', 'weak')
    await page.click('[data-testid="reset-password-submit"]')

    // Verify password validation errors
    await expect(page.locator('text=Password must be at least 8 characters long')).toBeVisible()
  })

  test('should show error for mismatched passwords', async ({ page }) => {
    const mockToken = 'test-reset-token-123'
    await page.goto(`/auth/reset-password?token=${mockToken}`)

    // Wait for form to load
    await expect(page.locator('[data-testid="reset-password-form"]')).toBeVisible({ timeout: 10000 })

    // Enter mismatched passwords
    await page.fill('[data-testid="reset-new-password"]', 'StrongPassword123!')
    await page.fill('[data-testid="reset-confirm-password"]', 'DifferentPassword123!')
    await page.click('[data-testid="reset-password-submit"]')

    // Verify mismatch error
    await expect(page.locator('text=Passwords do not match')).toBeVisible()
  })

  test('should show password requirements', async ({ page }) => {
    const mockToken = 'test-reset-token-123'
    await page.goto(`/auth/reset-password?token=${mockToken}`)

    // Wait for form to load
    await expect(page.locator('[data-testid="reset-password-form"]')).toBeVisible({ timeout: 10000 })

    // Verify password requirements are displayed
    await expect(page.locator('text=Password Requirements:')).toBeVisible()
    await expect(page.locator('text=At least 8 characters long')).toBeVisible()
    await expect(page.locator('text=At least one uppercase letter')).toBeVisible()
    await expect(page.locator('text=At least one lowercase letter')).toBeVisible()
    await expect(page.locator('text=At least one number')).toBeVisible()
    await expect(page.locator('text=At least one special character')).toBeVisible()
  })
})