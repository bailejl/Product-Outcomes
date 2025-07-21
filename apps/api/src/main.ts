/**
 * Hello World API Server
 * Functional programming patterns with Express.js
 */

import express from 'express'
import * as path from 'path'
import createMessagesRouter from './routes/messages'
import { checkDatabaseHealth } from './db/connection'

// Factory function for creating Express app
const createApp = (): express.Application => {
  const app = express()

  // Middleware
  app.use(express.json())
  app.use('/assets', express.static(path.join(__dirname, 'assets')))

  // CORS middleware for development
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept'
    )
    next()
  })

  // Routes
  app.use('/api/messages', createMessagesRouter())

  // Health check endpoint
  app.get('/api/health', async (req, res) => {
    const dbHealthy = await checkDatabaseHealth()
    res.json({
      status: 'ok',
      database: dbHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    })
  })

  // Default route
  app.get('/api', (req, res) => {
    res.send({ message: 'Hello World API Server' })
  })

  return app
}

// Factory function for starting server
const startServer = (app: express.Application, port: number) => {
  const server = app.listen(port, () => {
    console.log(`🚀 Hello World API listening at http://localhost:${port}/api`)
    console.log(`📊 Health check: http://localhost:${port}/api/health`)
    console.log(
      `👋 Hello World: http://localhost:${port}/api/messages/hello-world`
    )
  })

  server.on('error', console.error)
  return server
}

// Main execution
const app = createApp()
const port = parseInt(process.env.PORT || '3333', 10)
startServer(app, port)
