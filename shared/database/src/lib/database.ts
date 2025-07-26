import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { Message } from './entities/message'
import { User } from './entities/user'

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'product_outcomes',
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  entities: [Message, User],
  migrations: ['src/migrations/*.ts'],
  subscribers: ['src/subscribers/*.ts'],
})

export async function initializeDatabase() {
  try {
    await AppDataSource.initialize()
    console.log('✅ Database connection established')
    return AppDataSource
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    throw error
  }
}

export async function closeDatabaseConnection() {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy()
    console.log('✅ Database connection closed')
  }
}
