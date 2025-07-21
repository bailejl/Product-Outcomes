// Database connection factory function (functional programming)
import { Pool, PoolConfig } from 'pg'

// Factory function for creating database pool
export const createDatabasePool = (config?: PoolConfig): Pool => {
  const defaultConfig: PoolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'product_outcomes',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }

  return new Pool({ ...defaultConfig, ...config })
}

// Export singleton pool instance
export const pool = createDatabasePool()

// Health check function
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    return true
  } catch (error) {
    console.warn(
      'Database health check failed (using mock data):',
      error.message
    )
    return false
  }
}
