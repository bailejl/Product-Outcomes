import { Given } from '../fixtures/test'
import HomePage from '../page-objects/home.playwright.page'
import LoginPage from '../page-objects/login.playwright.page'

Given('{string} logs in', async ({ page, dataManager }, userNameAlias: string) => {
  const userData = dataManager.getData(userNameAlias, true)
  const homePage = new HomePage(page)
  const loginPage = new LoginPage(page)

  await homePage.open()
  await loginPage.login(userData.username, userData.password)
})

Given('{string} logs in with these mods', async ({ page, dataManager }, userNameAlias: string, table: any) => {
  const modDataNames = dataManager.getDataTableColumnValues(table, 0)
  const userData = dataManager.getDataWithMods(userNameAlias, modDataNames)
  const homePage = new HomePage(page)
  const loginPage = new LoginPage(page)

  await homePage.open()
  await loginPage.login(userData.username, userData.password)
})

Given('{string} logs in with this mod {string}', async ({ page, dataManager }, userNameAlias: string, modName: string) => {
  const userData = dataManager.getDataWithMods(userNameAlias, [modName])
  const homePage = new HomePage(page)
  const loginPage = new LoginPage(page)

  await homePage.open()
  await loginPage.login(userData.username, userData.password)
})
