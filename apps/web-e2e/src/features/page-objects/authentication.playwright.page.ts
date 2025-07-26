import { Page, Locator } from '@playwright/test'

export default class AuthenticationPage {
  readonly page: Page

  // Common elements
  readonly authModal: Locator
  readonly closeButton: Locator

  // Login form elements
  readonly loginForm: Locator
  readonly loginEmailInput: Locator
  readonly loginPasswordInput: Locator
  readonly rememberMeCheckbox: Locator
  readonly loginSubmitButton: Locator
  readonly forgotPasswordLink: Locator
  readonly toggleToRegisterLink: Locator

  // Register form elements
  readonly registerForm: Locator
  readonly firstNameInput: Locator
  readonly lastNameInput: Locator
  readonly registerEmailInput: Locator
  readonly registerPasswordInput: Locator
  readonly confirmPasswordInput: Locator
  readonly registerSubmitButton: Locator
  readonly toggleToLoginLink: Locator

  // User menu elements
  readonly userMenuButton: Locator
  readonly userMenuDropdown: Locator
  readonly signOutButton: Locator

  // Error and success messages
  readonly errorMessages: Locator
  readonly successMessages: Locator
  readonly welcomeMessage: Locator
  readonly authDemoInfo: Locator

  constructor(page: Page) {
    this.page = page

    // Common elements
    this.authModal = page.getByTestId('auth-modal-backdrop')
    this.closeButton = page.getByTestId('auth-modal-close')

    // Login form elements
    this.loginForm = page.locator('form').filter({ hasText: 'Welcome Back' })
    this.loginEmailInput = page.getByTestId('login-email')
    this.loginPasswordInput = page.getByTestId('login-password')
    this.rememberMeCheckbox = page.getByTestId('login-remember')
    this.loginSubmitButton = page.getByTestId('login-submit')
    this.forgotPasswordLink = page.getByText('Forgot password?')
    this.toggleToRegisterLink = page.getByTestId('toggle-register')

    // Register form elements
    this.registerForm = page
      .locator('form')
      .filter({ hasText: 'Create Account' })
    this.firstNameInput = page.getByTestId('register-firstName')
    this.lastNameInput = page.getByTestId('register-lastName')
    this.registerEmailInput = page.getByTestId('register-email')
    this.registerPasswordInput = page.getByTestId('register-password')
    this.confirmPasswordInput = page.getByTestId('register-confirmPassword')
    this.registerSubmitButton = page.getByTestId('register-submit')
    this.toggleToLoginLink = page.getByTestId('toggle-login')

    // User menu elements
    this.userMenuButton = page.getByTestId('user-menu-button')
    this.userMenuDropdown = page.locator('[role="menu"]')
    this.signOutButton = page.getByTestId('user-menu-logout')

    // Messages
    this.errorMessages = page.locator('.text-red-600')
    this.successMessages = page.locator('.text-green-600')
    this.welcomeMessage = page.getByText(/Welcome back,/)
    this.authDemoInfo = page.getByText('Authentication Demo')
  }

  async fillLoginForm(email: string, password: string) {
    await this.loginEmailInput.fill(email)
    await this.loginPasswordInput.fill(password)
  }

  async fillRegisterForm(
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    confirmPassword: string
  ) {
    await this.firstNameInput.fill(firstName)
    await this.lastNameInput.fill(lastName)
    await this.registerEmailInput.fill(email)
    await this.registerPasswordInput.fill(password)
    await this.confirmPasswordInput.fill(confirmPassword)
  }

  async submitLogin() {
    await this.loginSubmitButton.click()
  }

  async submitRegister() {
    await this.registerSubmitButton.click()
  }

  async toggleToRegister() {
    await this.toggleToRegisterLink.click()
  }

  async toggleToLogin() {
    await this.toggleToLoginLink.click()
  }

  async closeModal() {
    await this.closeButton.click()
  }

  async openUserMenu() {
    await this.userMenuButton.click()
  }

  async signOut() {
    await this.openUserMenu()
    await this.signOutButton.click()
  }

  async isModalVisible() {
    return await this.authModal.isVisible()
  }

  async isLoginFormVisible() {
    return await this.loginForm.isVisible()
  }

  async isRegisterFormVisible() {
    return await this.registerForm.isVisible()
  }

  async isUserMenuVisible() {
    return await this.userMenuButton.isVisible()
  }

  async getErrorMessages() {
    return await this.errorMessages.allTextContents()
  }

  async hasErrorMessage(message: string) {
    return await this.page.getByText(message).isVisible()
  }

  async getUserMenuText() {
    return await this.userMenuButton.textContent()
  }
}
