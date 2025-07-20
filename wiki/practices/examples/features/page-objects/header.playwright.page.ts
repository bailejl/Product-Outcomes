import { Page } from '@playwright/test'

import PlaywrightPage from './playwright-page'

/**
 * Page object for the header component
 */
export default class HeaderPage extends PlaywrightPage {
  constructor(page: Page) {
    super(page)
  }

  /**
   * Selectors for header elements
   */
  private readonly selectors = {
    headerLogoLink: '#header-logo-link',
    headerTitle: '#header-title',
    signinButton: '#signin-button',
    signoutButton: '#signout-button',
  }

  /**
   * Check if header is visible
   */
  async isHeaderVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.headerTitle)
  }

  /**
   * Get header title text
   */
  async getHeaderTitleText(): Promise<string> {
    return await this.getText(this.selectors.headerTitle)
  }

  /**
   * Check if sign in button is visible
   */
  async isSignInButtonVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.signinButton)
  }

  /**
   * Check if sign out button is visible
   */
  async isSignOutButtonVisible(): Promise<boolean> {
    return await this.isVisible(this.selectors.signoutButton)
  }

  /**
   * Click sign in button
   */
  async clickSignIn() {
    await this.click(this.selectors.signinButton)
  }

  /**
   * Click sign out button
   */
  async clickSignOut() {
    await this.click(this.selectors.signoutButton)
  }

  /**
   * Click header logo
   */
  async clickLogo() {
    await this.click(this.selectors.headerLogoLink)
  }
}
