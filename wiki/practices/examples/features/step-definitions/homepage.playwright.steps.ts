import { expect } from '@playwright/test'

import { Then, When } from '../fixtures/test'
import HeaderPage from '../page-objects/header.playwright.page'
import HomePage from '../page-objects/home.playwright.page'

When('They go to the home page', async ({ page }) => {
  const homePage = new HomePage(page)
  await homePage.open()
})

Then('They see the demo instructions', async ({ page }) => {
  const homePage = new HomePage(page)

  // Attach log for debugging (playwright-bdd equivalent)
  await page.evaluate(() => console.log('Logging something important.'))

  const titleText = await homePage.getTitleText()
  expect(titleText).toBe('Welcome to the Declarative Gherkin Demo!')

  const appTitleText = await homePage.getApplicationTitleText()
  expect(appTitleText).toBe('New Credit Card Submissions application')

  const usingAppTitleText = await homePage.getUsingAppTitleText()
  expect(usingAppTitleText).toBe('Using the App')
})

Then('They see the header', async ({ page }) => {
  const headerPage = new HeaderPage(page)

  // Check if header is visible
  const isHeaderVisible = await headerPage.isHeaderVisible()
  expect(isHeaderVisible).toBe(true)

  // Check header title
  const headerTitleText = await headerPage.getHeaderTitleText()
  expect(headerTitleText).toBe('First Bank of Change')

  // Check header logo link (verify it exists and has correct href)
  await expect(page.locator('#header-logo-link')).toHaveAttribute('href', '/')
})

Then('They see they can login', async ({ page }) => {
  const headerPage = new HeaderPage(page)

  // Check sign in button is visible
  const isSignInVisible = await headerPage.isSignInButtonVisible()
  expect(isSignInVisible).toBe(true)

  // Check sign out button is not visible
  const isSignOutVisible = await headerPage.isSignOutButtonVisible()
  expect(isSignOutVisible).toBe(false)
})
