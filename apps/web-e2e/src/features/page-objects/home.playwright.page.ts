import { Page, Locator } from '@playwright/test'

export default class HomePage {
  readonly page: Page
  readonly signInButton: Locator
  readonly signUpButton: Locator
  readonly helloWorldComponent: Locator
  readonly authDemoMessage: Locator
  readonly protectedMessage: Locator

  constructor(page: Page) {
    this.page = page
    this.signInButton = page.getByTestId('header-login')
    this.signUpButton = page.getByTestId('header-register')
    this.helloWorldComponent = page.locator(
      '[data-testid="hello-world-container"]'
    )
    this.authDemoMessage = page.getByText('Authentication Demo')
    this.protectedMessage = page.getByText('You are successfully authenticated')
  }

  async open() {
    await this.page.goto('/')
  }

  async clickSignIn() {
    await this.signInButton.click()
  }

  async clickSignUp() {
    await this.signUpButton.click()
  }

  async isSignInButtonVisible() {
    return await this.signInButton.isVisible()
  }

  async isSignUpButtonVisible() {
    return await this.signUpButton.isVisible()
  }

  async isHelloWorldVisible() {
    return await this.helloWorldComponent.isVisible()
  }

  async isAuthDemoMessageVisible() {
    return await this.authDemoMessage.isVisible()
  }

  async isProtectedMessageVisible() {
    return await this.protectedMessage.isVisible()
  }
}
