import { DataTable } from '@cucumber/cucumber'

import * as testData from './data.json'

interface Persona {
  name: string
  aliases?: string[]
  [key: string]: any
}

interface DataChunk {
  name: string
  [key: string]: any
}

export class DataManager {
  cachedData: Persona | DataChunk | undefined

  // Retrieves data directly from the JSON test data file.  No data  retrieved
  // is cached for later use.
  getNonCachedData(nameAlias: string): Persona | DataChunk {
    const foundData: Persona | DataChunk | undefined = testData.find(data => {
      if (data.name === nameAlias) {
        return true
      }
      if (data.aliases != null) {
        const d = data.aliases.find(alias => alias === nameAlias) !== undefined
        return d
      }
      return false
    })
    if (foundData === undefined) {
      throw new Error(`No data found for name alias: ${nameAlias}`)
    }
    // Return a deep copy to prevent mutation of original data
    return JSON.parse(JSON.stringify(foundData))
  }

  // Gets cached data, if available, by default.  Otherwise, it will
  // get the data from the JSON test data file.  The default behavior can
  // be overridden to get data from the file.  Last data retireived is now
  // a reflection of cache.
  getData(nameAlias: string, resetCache = false) {
    if (this.cachedData === undefined || resetCache) {
      const foundData = this.getNonCachedData(nameAlias)
      // Cache a deep copy to prevent external mutation
      this.cachedData = JSON.parse(JSON.stringify(foundData))
    }
    // Return a deep copy to prevent external mutation of cached data
    return JSON.parse(JSON.stringify(this.cachedData))
  }

  // Resets back to default state
  clearCache() {
    this.cachedData = undefined
  }

  // Retrieves all data for the nameAlias and modDataNames.  The object
  // tied to nameAlias is the base object.  With the data fragments tied to
  // modDataNames is applied one after another.  The resulting object is
  // returned and cached for later use.
  getDataWithMods(nameAlias: string, modDataNames: string[]) {
    let finalData = this.getNonCachedData(nameAlias)
    modDataNames.forEach(innerNameAlias => {
      const data: any = this.getNonCachedData(innerNameAlias)
      // Create a copy of the modification data before removing name property
      const modData = { ...data }
      delete modData.name
      finalData = Object.assign(finalData, modData)
    })
    // Cache a deep copy to prevent external mutation
    this.cachedData = JSON.parse(JSON.stringify(finalData))
    // Return a deep copy to prevent external mutation of cached data
    return JSON.parse(JSON.stringify(this.cachedData))
  }

  // This is a convenience function to convert a Gherkin rawTable into
  // an array of strings to be used as modDataNames in getDataWithMods().
  getDataTableColumnValues(table: DataTable, columnIndex: number) {
    const columnValues: string[] = []
    table.rows().forEach((row: string[]) => {
      columnValues.push(row[columnIndex])
    })
    return columnValues
  }
}

// export default new DataManager();
