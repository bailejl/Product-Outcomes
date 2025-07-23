import { test, expect } from '@playwright/test'

test('has title', async ({ page }) => {
  await page.goto('/')

  // Expect the first h1 (page title) to contain a substring.
  expect(await page.locator('h1').first().innerText()).toContain('Product Outcomes - Hello World Demo')
})
