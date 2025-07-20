import { Page } from '@playwright/test'

import PlaywrightPage from './playwright-page'

/**
 * Page object for the user homepage
 */
export default class UserPage extends PlaywrightPage {
  constructor(page: Page) {
    super(page)
  }

  /**
   * Selectors for user page elements
   */
  private readonly selectors = {
    welcomeText: 'text="Welcome to user-landing!"',
    applyButton: 'text="Apply"',
  }

  /**
   * Check if user page is viewable by verifying key elements are visible
   */
  async isViewable(): Promise<boolean> {
    const isWelcomeVisible = await this.isVisible(this.selectors.welcomeText)

    // Wait for page to load if elements aren't visible yet
    if (!isWelcomeVisible) {
      await this.page.waitForTimeout(2000)

      const isWelcomeVisibleAfterWait = await this.isVisible(
        this.selectors.welcomeText
      )
      return isWelcomeVisibleAfterWait
    }

    return isWelcomeVisible
  }

  /**
   * Navigate to user page
   */
  async open() {
    await super.open('user')
  }
}
