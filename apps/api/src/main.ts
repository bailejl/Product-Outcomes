import 'reflect-metadata'
import express from 'express'
import cors from 'cors'
import { initializeDatabase } from '@product-outcomes/database'
import messagesRouter from './routes/messages'
import authRouter from './routes/auth'

const app = express()
const port = process.env.API_PORT || 3333

// Middleware
app.use(cors())
app.use(express.json())

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Basic health check
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: 'unknown',
      },
    }

    // Check database connection
    try {
      const { AppDataSource } = await import('@product-outcomes/database')
      if (AppDataSource.isInitialized) {
        await AppDataSource.query('SELECT 1')
        healthStatus.services.database = 'connected'
      } else {
        healthStatus.services.database = 'not_initialized'
      }
    } catch (error) {
      healthStatus.services.database = 'error'
    }

    res.json(healthStatus)
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    })
  }
})

// Routes
app.use('/api/auth', authRouter)
app.use('/api/messages', messagesRouter)

// Default route
app.get('/api', (req, res) => {
  res.json({
    message: 'Product Outcomes API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  })
})

// Start server
async function startServer() {
  try {
    // Initialize database first
    console.log('🔄 Initializing database...')
    await initializeDatabase()

    // Start HTTP server
    app.listen(port, () => {
      console.log(`🚀 API server running on http://localhost:${port}`)
      console.log(`📊 Health check: http://localhost:${port}/api/health`)
      console.log(`🔐 Authentication API: http://localhost:${port}/api/auth`)
      console.log(`💬 Messages API: http://localhost:${port}/api/messages`)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔄 Shutting down gracefully...')
  const { closeDatabaseConnection } = await import('@product-outcomes/database')
  await closeDatabaseConnection()
  process.exit(0)
})

startServer()
