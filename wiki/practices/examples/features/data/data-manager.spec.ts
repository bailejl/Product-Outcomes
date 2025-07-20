import { DataTable } from '@cucumber/cucumber'
import { DataManager } from './data-manager'

// Use actual test data instead of mocking to ensure we test with real data structure

describe('DataManager', () => {
  let dataManager: DataManager

  beforeEach(() => {
    dataManager = new DataManager()
    dataManager.clearCache() // Ensure clean state for each test
  })

  describe('getNonCachedData', () => {
    it('should retrieve data by exact name', () => {
      const result = dataManager.getNonCachedData('Tom Smith')

      expect(result.name).toBe('Tom Smith')
      expect(result.firstName).toBe('Tom')
      expect(result.lastName).toBe('Smith')
      expect(result.monthlyIncome).toBe(5000)
      expect(result.monthlyHousingPayment).toBe(1800)
      expect(result.aliases).toContain(
        'Tom Smith w/ minimum acceptable back-end ratio'
      )
    })

    it('should retrieve data by alias', () => {
      const result = dataManager.getNonCachedData(
        'Tom Smith w/ minimum acceptable back-end ratio'
      )

      expect(result.name).toBe('Tom Smith')
      expect(result.firstName).toBe('Tom')
      expect(result.lastName).toBe('Smith')
      expect(result.monthlyIncome).toBe(5000)
      expect(result.monthlyHousingPayment).toBe(1800)
    })

    it('should retrieve data for persona without aliases', () => {
      const result = dataManager.getNonCachedData('failing back-end ratio')

      expect(result.name).toBe('failing back-end ratio')
      expect(result.monthlyHousingPayment).toBe(18001)
      expect(result.monthlyIncome).toBe(50000)
    })

    it('should throw error for non-existent name/alias', () => {
      expect(() => {
        dataManager.getNonCachedData('Non Existent User')
      }).toThrow('No data found for name alias: Non Existent User')
    })

    it('should be case sensitive', () => {
      expect(() => {
        dataManager.getNonCachedData('tom smith')
      }).toThrow('No data found for name alias: tom smith')
    })
  })

  describe('getData', () => {
    it('should cache data on first call', () => {
      const result1 = dataManager.getData('Tom Smith')
      const result2 = dataManager.getData('Lisa Mach')

      expect(result1).toEqual(result2) // Should return cached Tom Smith data
      expect(result2.name).toBe('Tom Smith') // Not Lisa Mach
    })

    it('should return cached data by default', () => {
      dataManager.getData('Tom Smith')
      const result = dataManager.getData('Lisa Mach') // Different name

      expect(result.name).toBe('Tom Smith') // Should still be cached Tom Smith
    })

    it('should reset cache when resetCache is true', () => {
      dataManager.getData('Tom Smith')
      const result = dataManager.getData('Lisa Mach', true)

      expect(result.name).toBe('Lisa Mach') // Should now be Lisa Mach
    })

    it('should handle undefined cachedData on first call', () => {
      expect(dataManager.cachedData).toBeUndefined()

      const result = dataManager.getData('Tom Smith')

      expect(result.name).toBe('Tom Smith')
      expect(dataManager.cachedData).toBeDefined()
    })
  })

  describe('clearCache', () => {
    it('should reset cachedData to undefined', () => {
      dataManager.getData('Tom Smith')
      expect(dataManager.cachedData).toBeDefined()

      dataManager.clearCache()

      expect(dataManager.cachedData).toBeUndefined()
    })

    it('should allow fresh data retrieval after clearing cache', () => {
      dataManager.getData('Tom Smith')
      dataManager.clearCache()
      const result = dataManager.getData('Lisa Mach')

      expect(result.name).toBe('Lisa Mach')
    })
  })

  describe('getDataWithMods', () => {
    it('should merge base data with single modification', () => {
      const result = dataManager.getDataWithMods('Tom Smith', [
        'failing back-end ratio',
      ])

      expect(result.name).toBe('Tom Smith')
      expect(result.firstName).toBe('Tom')
      expect(result.lastName).toBe('Smith')
      expect(result.monthlyIncome).toBe(50000) // Modified from mod
      expect(result.monthlyHousingPayment).toBe(18001) // Modified from mod
      expect(result.aliases).toContain(
        'Tom Smith w/ minimum acceptable back-end ratio'
      )
    })

    it('should handle empty modifications array', () => {
      // This test should run early before data gets mutated
      const testManager = new DataManager()
      const result = testManager.getDataWithMods('Lisa Mach', [])

      expect(result.name).toBe('Lisa Mach')
      expect(result.firstName).toBe('Lisa')
      expect(result.lastName).toBe('Mach')
      expect(typeof result.monthlyIncome).toBe('number')
    })

    it('should cache the modified data', () => {
      const testManager = new DataManager()
      testManager.getDataWithMods('Mike Fog', ['short personal values'])

      expect(testManager.cachedData).toBeDefined()
      expect(testManager.cachedData?.firstName).toBe('Li') // From short personal values
    })

    it('should remove name property from modification data chunks and apply modifications', () => {
      // Test the core functionality: that modifications are applied and original name preserved
      const testManager = new DataManager()
      const result = testManager.getDataWithMods('Kelly Baddy', [
        'long middle initial', // Use a different data chunk than the cache test
      ])

      expect(result.name).toBe('Kelly Baddy') // Original name preserved
      expect(result.middleInitial).toBe('LI') // Modified by long middle initial
    })
  })

  describe('getDataTableColumnValues', () => {
    it('should extract values from specified column', () => {
      const mockDataTable = {
        rows: jest.fn().mockReturnValue([
          ['mod1', 'value1'],
          ['mod2', 'value2'],
          ['mod3', 'value3'],
        ]),
      } as unknown as DataTable

      const result = dataManager.getDataTableColumnValues(mockDataTable, 0)

      expect(result).toEqual(['mod1', 'mod2', 'mod3'])
    })

    it('should extract values from second column', () => {
      const mockDataTable = {
        rows: jest.fn().mockReturnValue([
          ['mod1', 'value1'],
          ['mod2', 'value2'],
          ['mod3', 'value3'],
        ]),
      } as unknown as DataTable

      const result = dataManager.getDataTableColumnValues(mockDataTable, 1)

      expect(result).toEqual(['value1', 'value2', 'value3'])
    })

    it('should handle empty table', () => {
      const mockDataTable = {
        rows: jest.fn().mockReturnValue([]),
      } as unknown as DataTable

      const result = dataManager.getDataTableColumnValues(mockDataTable, 0)

      expect(result).toEqual([])
    })

    it('should handle single row table', () => {
      const mockDataTable = {
        rows: jest.fn().mockReturnValue([['single-value']]),
      } as unknown as DataTable

      const result = dataManager.getDataTableColumnValues(mockDataTable, 0)

      expect(result).toEqual(['single-value'])
    })
  })

  describe('error handling', () => {
    it('should throw error in getDataWithMods when base data not found', () => {
      expect(() => {
        dataManager.getDataWithMods('Non Existent User', [
          'failing back-end ratio',
        ])
      }).toThrow('No data found for name alias: Non Existent User')
    })

    it('should throw error in getDataWithMods when mod data not found', () => {
      expect(() => {
        dataManager.getDataWithMods('Tom Smith', ['Non Existent Mod'])
      }).toThrow('No data found for name alias: Non Existent Mod')
    })
  })

  describe('data immutability', () => {
    it('should not mutate original data when using getDataWithMods', () => {
      const manager1 = new DataManager()
      const manager2 = new DataManager()

      // Get original data before any modifications
      const originalTom1 = manager1.getNonCachedData('Tom Smith')
      const originalIncome1 = originalTom1.monthlyIncome

      // Apply modifications with first manager
      manager1.getDataWithMods('Tom Smith', ['failing back-end ratio'])

      // Get data with second manager - should be unchanged
      const originalTom2 = manager2.getNonCachedData('Tom Smith')
      const originalIncome2 = originalTom2.monthlyIncome

      // Original data should be unchanged
      expect(originalIncome2).toBe(originalIncome1)
      expect(originalIncome2).toBe(5000) // Original value
    })

    it('should not mutate data chunks when used in modifications', () => {
      const manager1 = new DataManager()
      const manager2 = new DataManager()

      // Get original failing back-end ratio data
      const originalMod1 = manager1.getNonCachedData('failing back-end ratio')
      expect(originalMod1.name).toBe('failing back-end ratio')

      // Use the modification in getDataWithMods (this used to delete the name)
      manager1.getDataWithMods('Tom Smith', ['failing back-end ratio'])

      // Check that the modification data chunk still has its name
      const originalMod2 = manager2.getNonCachedData('failing back-end ratio')
      expect(originalMod2.name).toBe('failing back-end ratio') // Should still have name
    })
  })

  describe('integration scenarios', () => {
    it('should work with typical BDD scenario workflow', () => {
      const manager = new DataManager()

      // Get base user data
      const userData = manager.getData('Kelly Baddy')
      expect(userData.name).toBe('Kelly Baddy')

      // Clear cache and get modified data with a data chunk that still exists
      manager.clearCache()
      const modifiedData = manager.getDataWithMods('Kelly Baddy', [
        'invalid dob format', // Use a different data chunk
      ])
      expect(modifiedData.name).toBe('Kelly Baddy')
      expect(modifiedData.dateOfBirth).toBe('1')

      // Get cached modified data
      const cachedData = manager.getData('Mike Fog') // Different name but should return cached
      expect(cachedData.name).toBe('Kelly Baddy') // Should be cached Kelly Baddy data
    })
  })
})
