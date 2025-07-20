import { Page } from '@playwright/test'

export default class PlaywrightPage {
  protected page: Page

  constructor(page: Page) {
    this.page = page
  }

  async open(path: string = '') {
    const baseUrl = process.env.BASE_URL || 'http://localhost:4200'
    await this.page.goto(`${baseUrl}/${path}`)
  }

  async waitForElement(selector: string) {
    await this.page.waitForSelector(selector, { state: 'visible' })
  }

  async click(selector: string) {
    await this.page.click(selector)
  }

  async fill(selector: string, value: string) {
    await this.page.fill(selector, value)
  }

  async selectOption(selector: string, value: string) {
    // Wait for the element to be visible and interactable with longer timeout
    await this.page.waitForSelector(selector, {
      state: 'visible',
      timeout: 10000,
    })
    // Additional wait for element to be ready
    await this.page.waitForTimeout(500)
    await this.page.selectOption(selector, value)
  }

  async getText(selector: string): Promise<string> {
    const text = (await this.page.textContent(selector)) || ''
    return text.trim().replace(/\s+/g, ' ')
  }

  async isVisible(selector: string): Promise<boolean> {
    return await this.page.isVisible(selector)
  }

  async isEnabled(selector: string): Promise<boolean> {
    return await this.page.isEnabled(selector)
  }

  async getInputValue(selector: string): Promise<string> {
    return await this.page.inputValue(selector)
  }

  async waitForNavigation() {
    await this.page.waitForLoadState('networkidle')
  }
}
