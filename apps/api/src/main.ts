import 'reflect-metadata'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { initializeDatabase } from '@product-outcomes/database'
import { SessionManager, createDefaultSessionConfig, SessionMonitor, createSessionMonitor } from '@product-outcomes/api-core'
import messagesRouter from './routes/messages'
import authRouter from './routes/auth'
import healthRouter from './routes/health'
import { requestMonitoring } from './middleware/healthMonitoring'
import { SocketServer } from './websocket/socketServer'
import { integrateGraphQL } from './graphql-integration'
import metricsService from './metrics/MetricsService'
import { 
  correlationIdMiddleware, 
  httpMetricsMiddleware, 
  requestTimingMiddleware,
  userContextMiddleware,
  errorMetricsMiddleware,
  healthMetricsMiddleware
} from './middleware/metricsMiddleware'
import {
  securityHeaders,
  compressionMiddleware,
  hppProtection,
  rateLimiters,
  slowDownConfigs,
  sanitizeInput,
  validationErrorHandler,
  securityMonitoring,
  corsConfig,
  securityRedis
} from './middleware/security'
import { databaseOptimizer, databaseHealthCheck } from './utils/databaseOptimization'
import logger from './config/logger'
import { sentryErrorHandler, errorLoggingMiddleware } from './config/sentry'

const app = express()
const httpServer = createServer(app)
const port = process.env.API_PORT || 3333

// Initialize Socket.io server
let socketServer: SocketServer

// Initialize session manager
const sessionConfig = createDefaultSessionConfig()
const sessionManager = new SessionManager(sessionConfig)

// Initialize session monitor
const sessionMonitor = createSessionMonitor(sessionManager, {
  maxTotalSessions: 5000,
  cleanupInterval: 300000, // 5 minutes
  metricsInterval: 60000,  // 1 minute
})

// Security middleware (must be first)
app.use(securityHeaders)
app.use(compressionMiddleware)
app.use(hppProtection)
app.use(securityMonitoring)

// Rate limiting middleware
app.use('/api/auth', rateLimiters.auth, slowDownConfigs.auth)
app.use('/api', rateLimiters.apiIP) // Global API rate limiting

// Metrics and observability middleware
app.use(correlationIdMiddleware)
app.use(requestTimingMiddleware)
app.use(userContextMiddleware)
app.use(httpMetricsMiddleware)
app.use(healthMetricsMiddleware)

// Core middleware with enhanced CORS
app.use(cors(corsConfig))
app.use(express.json({ limit: '10mb' })) // Increased limit for file uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Input sanitization
app.use(sanitizeInput())

// Health monitoring middleware
app.use(requestMonitoring)

// Legacy health check endpoint (redirect to new comprehensive health check)
app.get('/api/health', (req, res) => {
  res.redirect(301, '/api/health/')
})

// Metrics endpoints
app.get('/api/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metricsService.getContentType())
    const metrics = await metricsService.getMetrics()
    res.send(metrics)
  } catch (error) {
    console.error('Error getting metrics:', error)
    res.status(500).send('Error getting metrics')
  }
})

app.get('/api/business-metrics', async (req, res) => {
  try {
    res.set('Content-Type', metricsService.getContentType())
    const metrics = await metricsService.getMetrics()
    res.send(metrics)
  } catch (error) {
    console.error('Error getting business metrics:', error)
    res.status(500).send('Error getting business metrics')
  }
})

app.get('/api/health-metrics', async (req, res) => {
  try {
    const [dbHealth, dbMetrics] = await Promise.all([
      databaseHealthCheck.checkConnection(),
      databaseOptimizer.getDatabaseMetrics()
    ])
    
    const healthData = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: process.version,
      platform: process.platform,
      env: process.env.NODE_ENV || 'development',
      database: {
        connected: dbHealth,
        metrics: dbMetrics.error ? { error: dbMetrics.message } : dbMetrics
      },
      security: {
        rateLimitStore: 'redis',
        corsEnabled: true,
        helmetEnabled: true,
        compressionEnabled: true
      }
    }
    res.json(healthData)
  } catch (error) {
    logger.error('Error getting health metrics:', error)
    res.status(500).json({ error: 'Error getting health metrics' })
  }
})

// Database optimization endpoints (admin only)
app.get('/api/admin/db-analysis', rateLimiters.apiUser, async (req, res) => {
  try {
    // This would need proper admin authentication
    const analysis = await databaseOptimizer.analyzeIndexes()
    const slowQueries = await databaseOptimizer.getSlowQueryRecommendations()
    
    res.json({
      indexRecommendations: analysis,
      slowQueries: slowQueries.slice(0, 10),
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Error getting database analysis:', error)
    res.status(500).json({ error: 'Error getting database analysis' })
  }
})

app.post('/api/admin/db-optimize', rateLimiters.apiUser, async (req, res) => {
  try {
    // This would need proper admin authentication
    const optimizations = await databaseOptimizer.optimizeDatabase()
    
    res.json({
      optimizations,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Error optimizing database:', error)
    res.status(500).json({ error: 'Error optimizing database' })
  }
})

// Enhanced routes with specific rate limiting
app.use('/api/health', healthRouter)
app.use('/api/auth', 
  rateLimiters.login, 
  slowDownConfigs.auth,
  sanitizeInput(['email', 'password', 'name']),
  authRouter
)
app.use('/api/messages', 
  rateLimiters.apiUser,
  sanitizeInput(['content', 'title']),
  messagesRouter
)

// Default route
app.get('/api', (req, res) => {
  res.json({
    message: 'Product Outcomes API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId,
    metrics: {
      endpoint: '/api/metrics',
      business: '/api/business-metrics',
      health: '/api/health-metrics'
    }
  })
})

// Error handling middleware (must be last)
app.use(errorMetricsMiddleware)

// Error handling middleware (must be after routes)
app.use(errorLoggingMiddleware)
app.use(sentryErrorHandler()) // Must be last error handler

// Start server
async function startServer() {
  try {
    logger.info('Starting Product Outcomes API server...')
    
    // Initialize database first
    logger.info('Initializing database...')
    await initializeDatabase()

    // Initialize session manager
    logger.info('Initializing Redis session store...')
    await sessionManager.initialize()
    
    // Add session middleware after Redis is connected
    app.use(sessionManager.getSessionMiddleware())

    // Start session monitoring
    sessionMonitor.start()
    
    // Set up session monitor event listeners
    sessionMonitor.on('alert', (alert) => {
      logger.warn(`Session Alert [${alert.severity}]: ${alert.message}`, {
        alertType: 'session',
        severity: alert.severity,
        details: alert,
      })
    })
    
    sessionMonitor.on('cleanup:completed', ({ cleanedCount }) => {
      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} expired sessions`, {
          cleanedCount,
          eventType: 'session_cleanup',
        })
      }
    })

    // Initialize Socket.io server
    logger.info('Initializing Socket.io server...')
    socketServer = new SocketServer(httpServer)

    // Integrate GraphQL
    logger.info('Setting up GraphQL...')
    await integrateGraphQL(app, httpServer)

    // Start HTTP server with Socket.io
    httpServer.listen(port, () => {
      logger.info(`API server running on http://localhost:${port}`, {
        port,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        startupTime: new Date().toISOString(),
      })
      
      logger.info('API endpoints available:', {
        health: `http://localhost:${port}/api/health`,
        auth: `http://localhost:${port}/api/auth`,
        messages: `http://localhost:${port}/api/messages`,
        graphql: `http://localhost:${port}/graphql`,
        websocket: `http://localhost:${port}`,
      })
    })
  } catch (error) {
    logger.error('Failed to start server', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...')
  
  try {
    // Shutdown Socket.io server first
    if (socketServer) {
      logger.info('Shutting down Socket.io server...')
      await socketServer.shutdown()
    }
    
    // Stop session monitoring
    logger.info('Stopping session monitoring...')
    sessionMonitor.stop()
    
    // Close session manager
    logger.info('Closing session manager...')
    await sessionManager.close()
    
    // Close security Redis connection
    logger.info('Closing security Redis connection...')
    await securityRedis.disconnect()
    
    // Close database connection
    logger.info('Closing database connection...')
    const { closeDatabaseConnection } = await import('@product-outcomes/database')
    await closeDatabaseConnection()
    
    // Close HTTP server
    httpServer.close(() => {
      logger.info('HTTP server closed successfully')
      process.exit(0)
    })
  } catch (error) {
    logger.error('Error during graceful shutdown', error)
    process.exit(1)
  }
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error)
  process.exit(1)
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', { reason, promise })
  process.exit(1)
})

// Export session manager, monitor, and socket server for use in routes
export { sessionManager, sessionMonitor, socketServer }

startServer()
