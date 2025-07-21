import { Page, Locator } from '@playwright/test'

export default class HelloWorldPage {
  readonly page: Page
  readonly messageElement: Locator
  readonly headerElement: Locator
  readonly errorElement: Locator
  readonly loadingElement: Locator

  constructor(page: Page) {
    this.page = page
    this.messageElement = page.getByTestId('hello-message')
    this.headerElement = page.getByRole('heading', { level: 1 })
    this.errorElement = page.getByTestId('error-message')
    this.loadingElement = page.getByText('Loading...')
  }

  async open() {
    await this.page.goto('http://localhost:4200')
  }

  async getMessageText(): Promise<string> {
    return (await this.messageElement.textContent()) || ''
  }

  async getHeaderText(): Promise<string> {
    return (await this.headerElement.textContent()) || ''
  }

  async waitForMessage() {
    await this.messageElement.waitFor({ state: 'visible' })
  }

  async isErrorVisible(): Promise<boolean> {
    return await this.errorElement.isVisible()
  }

  async isLoadingVisible(): Promise<boolean> {
    return await this.loadingElement.isVisible()
  }
}
