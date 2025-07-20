import { expect } from '@playwright/test'

import { Given, Then, When } from '../fixtures/test'
import CreditFormWizard from '../page-objects/credit-form.playwright.page'
import HeaderPage from '../page-objects/header.playwright.page'
import HomePage from '../page-objects/home.playwright.page'
import LoginPage from '../page-objects/login.playwright.page'
import UserPage from '../page-objects/user.playwright.page'

Given('they are on the home page', async ({ page }) => {
  const homePage = new HomePage(page)
  await homePage.open()
})

When('they sign in as {string}', async ({ page, dataManager }, userNameAlias: string) => {
  const userData = dataManager.getData(userNameAlias, true)
  const loginPage = new LoginPage(page)
  await loginPage.login(userData.username, userData.password)
})

Then('they are redirected to the home page', async ({ page }) => {
  const homePage = new HomePage(page)
  const isViewable = await homePage.isViewable()
  expect(isViewable).toBe(true)
})

Then('they can navigate to the user homepage', async ({ page }) => {
  const homePage = new HomePage(page)
  await homePage.navigateToUserHomepage()
  const userPage = new UserPage(page)
  const isViewable = await userPage.isViewable()
  expect(isViewable).toBe(true)
})

Then('they can access the credit application form', async ({ page }) => {
  const homePage = new HomePage(page)
  await homePage.navigateToCreditApplication()
  const creditFormPage = new CreditFormWizard(page)
  const isViewable = await creditFormPage.isViewable()
  expect(isViewable).toBe(true)
})

When('they attempt to sign in with invalid credentials', async ({ page, dataManager }) => {
  const invalidData = dataManager.getNonCachedData('invalid credentials')
  const headerPage = new HeaderPage(page)
  const loginPage = new LoginPage(page)
  
  // Navigate to login page first
  await headerPage.clickSignIn()
  await loginPage.attemptLogin(invalidData.username, invalidData.password)
})

Then('they see login error messages', async ({ page, dataManager }) => {
  const errorMessages = dataManager.getNonCachedData('login error messages')
  const loginPage = new LoginPage(page)
  const hasErrors = await loginPage.hasErrorMessages()
  expect(hasErrors).toBe(true)
  
  const errorText = await loginPage.getErrorMessage()
  expect(errorText).toBe(errorMessages.general)
})

Then('they remain on the login page', async ({ page }) => {
  const loginPage = new LoginPage(page)
  const isViewable = await loginPage.isViewable()
  expect(isViewable).toBe(true)
})

Then('they are redirected to the login page', async ({ page }) => {
  const loginPage = new LoginPage(page)
  const isViewable = await loginPage.isViewable()
  expect(isViewable).toBe(true)
})

Given('{string} is logged in', async ({ page, dataManager }, userNameAlias: string) => {
  const userData = dataManager.getData(userNameAlias, true)
  const homePage = new HomePage(page)
  const loginPage = new LoginPage(page)

  await homePage.open()
  await loginPage.login(userData.username, userData.password)
})

Given('they are on the user homepage', async ({ page }) => {
  await page.goto('/user')
})

When('they log out', async ({ page }) => {
  const headerPage = new HeaderPage(page)
  await headerPage.clickSignOut()
  // Wait for redirect to complete
  await page.waitForTimeout(1000)
})

Then('they cannot access protected areas without authentication', async ({ page }) => {
  // Try to access protected user page
  await page.goto('/user')
  
  // Wait a moment for any redirects to occur
  await page.waitForTimeout(1000)
  
  // Check if we're still logged in by looking for sign-in vs sign-out button
  const headerPage = new HeaderPage(page)
  const isSignInVisible = await headerPage.isSignInButtonVisible()
  const isSignOutVisible = await headerPage.isSignOutButtonVisible()
  
  // After logout, sign-in should be visible and sign-out should not be visible
  expect(isSignInVisible).toBe(true)
  expect(isSignOutVisible).toBe(false)
})