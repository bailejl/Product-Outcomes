import { test as base, createBdd } from 'playwright-bdd'

import { DataManager } from '../data/data-manager'

// Extend the playwright-bdd test with DataManager fixture
export const test = base.extend<{}, { dataManager: DataManager }>({
  // eslint-disable-next-line no-empty-pattern
  dataManager: [
    async ({}, use) => {
      // Create a new DataManager instance for each test
      const dataManager = new DataManager()

      // Provide the DataManager instance to the test
      await use(dataManager)

      // Optional: Clear cache after test as well
      dataManager.clearCache()
    },
    { scope: 'worker' },
  ],
})

// Export the BDD functions using our extended test
export const { Given, When, Then } = createBdd(test)
