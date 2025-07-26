import { Given, When, Then } from '../fixtures/test'
import HomePage from '../page-objects/home.playwright.page'
import AuthenticationPage from '../page-objects/authentication.playwright.page'

let homePage: HomePage
let authPage: AuthenticationPage

Given('the user is on the home page', async ({ page }) => {
  homePage = new HomePage(page)
  authPage = new AuthenticationPage(page)
  await homePage.open()
})

Given(
  '{string} has an account',
  async ({ page, dataManager }, userAlias: string) => {
    // In a real app, this would create the user in the database
    // For now, we'll just acknowledge this step as the API should handle it
    const userData = dataManager.getData(userAlias, true)
    // User data is available for the test
  }
)

Given(
  '{string} is logged in',
  async ({ page, dataManager }, userAlias: string) => {
    homePage = new HomePage(page)
    authPage = new AuthenticationPage(page)
    const userData = dataManager.getData(userAlias, true)

    await homePage.open()
    await homePage.clickSignIn()
    await authPage.fillLoginForm(userData.email, userData.password)
    await authPage.submitLogin()

    // Wait for login to complete
    await page.waitForSelector('[data-testid="user-menu-button"]')
  }
)

When('the user clicks on {string}', async ({ page }, buttonText: string) => {
  if (buttonText === 'Sign In') {
    await homePage.clickSignIn()
  } else if (buttonText === 'Sign Up') {
    await homePage.clickSignUp()
  } else if (
    buttonText === 'Sign In' &&
    (await authPage.loginSubmitButton.isVisible())
  ) {
    await authPage.submitLogin()
  } else if (buttonText === 'Create Account') {
    await authPage.submitRegister()
  } else if (buttonText === 'Sign up here') {
    await authPage.toggleToRegister()
  } else if (buttonText === 'Sign in here') {
    await authPage.toggleToLogin()
  } else if (buttonText === 'Sign Out') {
    await authPage.signOutButton.click()
  } else {
    await page.getByText(buttonText).click()
  }
})

When('the user clicks on close button', async ({ page }) => {
  await authPage.closeModal()
})

When('the user clicks on the user menu', async ({ page }) => {
  await authPage.openUserMenu()
})

When(
  'the user enters {string} in email field',
  async ({ page }, email: string) => {
    if (await authPage.loginEmailInput.isVisible()) {
      await authPage.loginEmailInput.fill(email)
    } else if (await authPage.registerEmailInput.isVisible()) {
      await authPage.registerEmailInput.fill(email)
    }
  }
)

When(
  'the user enters {string} in first name field',
  async ({ page }, firstName: string) => {
    await authPage.firstNameInput.fill(firstName)
  }
)

When(
  'the user enters {string} in last name field',
  async ({ page }, lastName: string) => {
    await authPage.lastNameInput.fill(lastName)
  }
)

When(
  'the user enters {string} in password field',
  async ({ page }, password: string) => {
    if (await authPage.loginPasswordInput.isVisible()) {
      await authPage.loginPasswordInput.fill(password)
    } else if (await authPage.registerPasswordInput.isVisible()) {
      await authPage.registerPasswordInput.fill(password)
    }
  }
)

When(
  'the user enters {string} in confirm password field',
  async ({ page }, password: string) => {
    await authPage.confirmPasswordInput.fill(password)
  }
)

Then('the user sees the login form', async ({ page }) => {
  const isVisible = await authPage.isLoginFormVisible()
  if (!isVisible) {
    throw new Error('Login form is not visible')
  }
})

Then('the user sees the registration form', async ({ page }) => {
  const isVisible = await authPage.isRegisterFormVisible()
  if (!isVisible) {
    throw new Error('Registration form is not visible')
  }
})

Then(
  'the user sees {string} heading',
  async ({ page }, headingText: string) => {
    const heading = await page
      .getByRole('heading', { name: headingText })
      .isVisible()
    if (!heading) {
      throw new Error(`Heading "${headingText}" is not visible`)
    }
  }
)

Then('the user sees email input field', async ({ page }) => {
  const emailInput =
    (await authPage.loginEmailInput.isVisible()) ||
    (await authPage.registerEmailInput.isVisible())
  if (!emailInput) {
    throw new Error('Email input field is not visible')
  }
})

Then('the user sees password input field', async ({ page }) => {
  const passwordInput =
    (await authPage.loginPasswordInput.isVisible()) ||
    (await authPage.registerPasswordInput.isVisible())
  if (!passwordInput) {
    throw new Error('Password input field is not visible')
  }
})

Then('the user sees first name input field', async ({ page }) => {
  const isVisible = await authPage.firstNameInput.isVisible()
  if (!isVisible) {
    throw new Error('First name input field is not visible')
  }
})

Then('the user sees last name input field', async ({ page }) => {
  const isVisible = await authPage.lastNameInput.isVisible()
  if (!isVisible) {
    throw new Error('Last name input field is not visible')
  }
})

Then('the user sees confirm password input field', async ({ page }) => {
  const isVisible = await authPage.confirmPasswordInput.isVisible()
  if (!isVisible) {
    throw new Error('Confirm password input field is not visible')
  }
})

Then(
  'the user sees {string} checkbox',
  async ({ page }, checkboxLabel: string) => {
    const checkbox = await authPage.rememberMeCheckbox.isVisible()
    if (!checkbox) {
      throw new Error(`${checkboxLabel} checkbox is not visible`)
    }
  }
)

Then('the user sees {string} button', async ({ page }, buttonText: string) => {
  const button = await page
    .getByRole('button', { name: buttonText })
    .isVisible()
  if (!button) {
    throw new Error(`Button "${buttonText}" is not visible`)
  }
})

Then('the user sees {string} error', async ({ page }, errorMessage: string) => {
  const hasError = await authPage.hasErrorMessage(errorMessage)
  if (!hasError) {
    throw new Error(`Error message "${errorMessage}" is not visible`)
  }
})

Then('the user sees {string} message', async ({ page }, message: string) => {
  const isVisible = await page.getByText(message).isVisible()
  if (!isVisible) {
    throw new Error(`Message "${message}" is not visible`)
  }
})

Then(
  'the user sees the user menu with {string}',
  async ({ page }, userName: string) => {
    const menuText = await authPage.getUserMenuText()
    if (!menuText || !menuText.includes(userName)) {
      throw new Error(`User menu does not contain "${userName}"`)
    }
  }
)

Then('the user does not see the authentication modal', async ({ page }) => {
  const isVisible = await authPage.isModalVisible()
  if (isVisible) {
    throw new Error('Authentication modal is still visible')
  }
})

Then('the user does not see the user menu', async ({ page }) => {
  const isVisible = await authPage.isUserMenuVisible()
  if (isVisible) {
    throw new Error('User menu is still visible')
  }
})

Then('the user sees protected HelloWorld component', async ({ page }) => {
  // Check that HelloWorld is inside a protected route wrapper
  const protectedContent = await page
    .locator('[data-testid="hello-world-container"]')
    .isVisible()
  const authMessage = await page
    .getByText('You are successfully authenticated')
    .isVisible()

  if (!protectedContent || !authMessage) {
    throw new Error('Protected HelloWorld component is not visible')
  }
})

Then('the user sees HelloWorld component', async ({ page }) => {
  const isVisible = await homePage.isHelloWorldVisible()
  if (!isVisible) {
    throw new Error('HelloWorld component is not visible')
  }
})
