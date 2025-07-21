// Mock database module for testing
export const query = async (sql: string, params?: any[]) => {
  // This is a mock implementation
  return { rows: [], rowCount: 0 }
}
