import { Page } from '@playwright/test'

import PlaywrightPage from './playwright-page'

/**
 * Page object for the home page
 */
export default class HomePage extends PlaywrightPage {
  constructor(page: Page) {
    super(page)
  }

  /**
   * Selectors for home page elements
   */
  private readonly selectors = {
    title: '#title',
    applicationTitle: '#application-title',
    runGherkinTestTitle: '#run-Gherkin-tests-title',
    usingAppTitle: '#using-app-title',
    userHomepageLink: 'text="Go to User Homepage"',
    applyLink: 'text="Apply"',
  }

  /**
   * Get page title text
   */
  async getTitleText(): Promise<string> {
    return await this.getText(this.selectors.title)
  }

  /**
   * Get application title text
   */
  async getApplicationTitleText(): Promise<string> {
    return await this.getText(this.selectors.applicationTitle)
  }

  /**
   * Get run Gherkin test title text
   */
  async getRunGherkinTestTitleText(): Promise<string> {
    return await this.getText(this.selectors.runGherkinTestTitle)
  }

  /**
   * Get using app title text
   */
  async getUsingAppTitleText(): Promise<string> {
    return await this.getText(this.selectors.usingAppTitle)
  }

  /**
   * Check if demo instructions are visible
   */
  async areDemoInstructionsVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.applicationTitle)
  }

  /**
   * Navigate to user homepage by clicking the "Go to User Homepage" link
   */
  async navigateToUserHomepage() {
    await this.click(this.selectors.userHomepageLink)
  }

  /**
   * Navigate to credit application by clicking the "Apply" link
   */
  async navigateToCreditApplication() {
    await this.click(this.selectors.applyLink)
  }

  /**
   * Check if home page is viewable by verifying key elements are visible
   */
  async isViewable(): Promise<boolean> {
    const isTitleVisible = await this.isVisible(this.selectors.title)
    const isApplicationTitleVisible = await this.isVisible(
      this.selectors.applicationTitle
    )

    // Wait for page to load if elements aren't visible yet
    if (!isTitleVisible || !isApplicationTitleVisible) {
      await this.page.waitForTimeout(2000)

      const isTitleVisibleAfterWait = await this.isVisible(this.selectors.title)
      const isApplicationTitleVisibleAfterWait = await this.isVisible(
        this.selectors.applicationTitle
      )

      return isTitleVisibleAfterWait && isApplicationTitleVisibleAfterWait
    }

    return isTitleVisible && isApplicationTitleVisible
  }

  /**
   * Navigate to home page
   */
  async open() {
    await super.open('')
  }
}
