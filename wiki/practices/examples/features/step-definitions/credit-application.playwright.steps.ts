import { expect } from '@playwright/test'

import { Given, Then, When } from '../fixtures/test'
import CreditFormWizard, {
  FormSections,
} from '../page-objects/credit-form.playwright.page'

const sectionNameMap = {
  'personal information': FormSections.Personal,
  'citizenship information': FormSections.Citizenship,
  'employment information': FormSections.Employment,
  'financial information': FormSections.Financial,
}

Given(
  '{string} fills out the form with their information',
  async ({ page, dataManager }, userNameAlias: string) => {
    const userData = dataManager.getData(userNameAlias)
    const creditFormPage = new CreditFormWizard(page)

    await creditFormPage.open()
    await creditFormPage.fillOutForm(userData)
  }
)

Given(
  'they navigate the {string} section of the form',
  async ({ page }, formSectionName: string) => {
    const creditFormPage = new CreditFormWizard(page)
    const section =
      sectionNameMap[formSectionName as keyof typeof sectionNameMap]
    await creditFormPage.goToSection(section)
  }
)

Given('they see no error messages in the form section', async ({ page }) => {
  const creditFormPage = new CreditFormWizard(page)
  const hasErrors = await creditFormPage.hasErrors()
  expect(hasErrors).toBe(false)
})

Given(
  '{string} fills out the personal information section of the form',
  async ({ page, dataManager }, userNameAlias: string) => {
    const userData = dataManager.getData(userNameAlias)
    const creditFormPage = new CreditFormWizard(page)

    await creditFormPage.open()
    await creditFormPage.fillOutPersonalSection(userData)
  }
)

When('they submit their form', async ({ page }) => {
  const creditFormPage = new CreditFormWizard(page)
  await creditFormPage.submitForm()
})

When('they attempt to continue to next section', async ({ page }) => {
  await page.click('button[type="submit"]')
})

Then(
  'they see {string} name error messages',
  async ({ page, dataManager }, errorName: string) => {
    const msgMap = dataManager.getNonCachedData(errorName)

    // Check first name error
    const firstNameError = page.locator('#first-name-helper-text')
    await expect(firstNameError).toHaveText(msgMap.firstName)

    // Check middle initial error
    const middleInitialError = page.locator('#middle-initial-helper-text')
    await expect(middleInitialError).toHaveText(msgMap.middleInitial)

    // Check last name error
    const lastNameError = page.locator('#last-name-helper-text')
    await expect(lastNameError).toHaveText(msgMap.lastName)
  }
)

Then(
  'they see a submittal response {string}',
  async ({ page }, msg: string) => {
    const creditFormPage = new CreditFormWizard(page)
    const responseMsg = await creditFormPage.getResponseMessage()
    expect(responseMsg).toBe(msg)
  }
)

Then(
  'they see a {string} submittal response',
  async ({ page, dataManager }, msgType: string) => {
    const msgMap = dataManager.getNonCachedData(
      'Form Submittal Response Messages'
    ).msgMap
    const creditFormPage = new CreditFormWizard(page)
    const responseMsg = await creditFormPage.getResponseMessage()
    expect(responseMsg).toBe(msgMap[msgType])
  }
)
