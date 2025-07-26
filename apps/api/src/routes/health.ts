import express from 'express'
import { promisify } from 'util'
import { performance } from 'perf_hooks'
import os from 'os'
import fs from 'fs/promises'
import { AppDataSource } from '@product-outcomes/database'
import { createClient } from 'redis'

const router = express.Router()

// Health check types
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  environment: string
  uptime: number
  services: ServiceHealthStatus
  metrics: SystemMetrics
  dependencies: DependencyHealthStatus
}

interface ServiceHealthStatus {
  database: ServiceCheck
  redis: ServiceCheck
  email: ServiceCheck
  storage: ServiceCheck
  graphql: ServiceCheck
  websocket: ServiceCheck
}

interface ServiceCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime: number
  lastCheck: string
  error?: string
  metadata?: any
}

interface SystemMetrics {
  cpu: {
    usage: number
    loadAverage: number[]
  }
  memory: {
    used: number
    free: number
    total: number
    percentage: number
  }
  disk: {
    used: number
    free: number
    total: number
    percentage: number
  }
  network: {
    connections: number
  }
}

interface DependencyHealthStatus {
  external: {
    [key: string]: ServiceCheck
  }
}

// Redis client for health checks
let healthRedisClient: any

// Initialize health check Redis client
const initializeHealthRedis = async () => {
  if (!healthRedisClient) {
    healthRedisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 5000,
        lazyConnect: true
      }
    })
    
    healthRedisClient.on('error', (err: any) => {
      console.error('Health Redis client error:', err)
    })
  }
  return healthRedisClient
}

// Database health check
const checkDatabaseHealth = async (): Promise<ServiceCheck> => {
  const start = performance.now()
  
  try {
    if (!AppDataSource.isInitialized) {
      throw new Error('Database not initialized')
    }
    
    // Test basic connectivity
    await AppDataSource.query('SELECT 1')
    
    // Test query performance
    const perfStart = performance.now()
    await AppDataSource.query('SELECT COUNT(*) FROM information_schema.tables')
    const queryTime = performance.now() - perfStart
    
    // Check connection pool status
    const poolStatus = {
      totalConnections: AppDataSource.driver.pool?.totalCount || 0,
      idleConnections: AppDataSource.driver.pool?.idleCount || 0,
      waitingConnections: AppDataSource.driver.pool?.waitingCount || 0
    }
    
    const responseTime = performance.now() - start
    
    return {
      status: responseTime < 100 ? 'healthy' : responseTime < 500 ? 'degraded' : 'unhealthy',
      responseTime,
      lastCheck: new Date().toISOString(),
      metadata: {
        queryPerformance: queryTime,
        connectionPool: poolStatus
      }
    }
  } catch (error: any) {
    return {
      status: 'unhealthy',
      responseTime: performance.now() - start,
      lastCheck: new Date().toISOString(),
      error: error.message
    }
  }
}

// Redis health check
const checkRedisHealth = async (): Promise<ServiceCheck> => {
  const start = performance.now()
  
  try {
    const client = await initializeHealthRedis()
    
    if (!client.isOpen) {
      await client.connect()
    }
    
    // Test basic connectivity
    await client.ping()
    
    // Test write/read performance
    const testKey = `health_check_${Date.now()}`
    const testValue = 'health_test'
    
    const writeStart = performance.now()
    await client.set(testKey, testValue, { EX: 10 }) // Expire in 10 seconds
    const writeTime = performance.now() - writeStart
    
    const readStart = performance.now()
    const result = await client.get(testKey)
    const readTime = performance.now() - readStart
    
    await client.del(testKey)
    
    // Get Redis info
    const info = await client.info('memory')
    const memoryUsed = info.match(/used_memory:(\d+)/)?.[1] || '0'
    const memoryTotal = info.match(/maxmemory:(\d+)/)?.[1] || '0'
    
    const responseTime = performance.now() - start
    
    return {
      status: responseTime < 50 ? 'healthy' : responseTime < 200 ? 'degraded' : 'unhealthy',
      responseTime,
      lastCheck: new Date().toISOString(),
      metadata: {
        writeTime,
        readTime,
        memoryUsed: parseInt(memoryUsed),
        memoryTotal: parseInt(memoryTotal) || null,
        dataIntegrity: result === testValue
      }
    }
  } catch (error: any) {
    return {
      status: 'unhealthy',
      responseTime: performance.now() - start,
      lastCheck: new Date().toISOString(),
      error: error.message
    }
  }
}

// Email service health check
const checkEmailHealth = async (): Promise<ServiceCheck> => {
  const start = performance.now()
  
  try {
    const mailhogUrl = process.env.MAILHOG_URL || 'http://localhost:8025'
    const response = await fetch(`${mailhogUrl}/api/v1/messages?limit=1`, {
      signal: AbortSignal.timeout(5000)
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    const responseTime = performance.now() - start
    
    return {
      status: responseTime < 100 ? 'healthy' : responseTime < 500 ? 'degraded' : 'unhealthy',
      responseTime,
      lastCheck: new Date().toISOString(),
      metadata: {
        messageCount: data.count || 0,
        endpoint: mailhogUrl
      }
    }
  } catch (error: any) {
    return {
      status: 'unhealthy',
      responseTime: performance.now() - start,
      lastCheck: new Date().toISOString(),
      error: error.message
    }
  }
}

// Storage service health check (MinIO)
const checkStorageHealth = async (): Promise<ServiceCheck> => {
  const start = performance.now()
  
  try {
    const minioUrl = process.env.MINIO_URL || 'http://localhost:9000'
    const response = await fetch(`${minioUrl}/minio/health/live`, {
      signal: AbortSignal.timeout(5000)
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const responseTime = performance.now() - start
    
    return {
      status: responseTime < 100 ? 'healthy' : responseTime < 500 ? 'degraded' : 'unhealthy',
      responseTime,
      lastCheck: new Date().toISOString(),
      metadata: {
        endpoint: minioUrl
      }
    }
  } catch (error: any) {
    return {
      status: 'unhealthy',
      responseTime: performance.now() - start,
      lastCheck: new Date().toISOString(),
      error: error.message
    }
  }
}

// GraphQL health check
const checkGraphQLHealth = async (): Promise<ServiceCheck> => {
  const start = performance.now()
  
  try {
    const graphqlUrl = process.env.GRAPHQL_URL || 'http://localhost:3333/graphql'
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '{ __schema { queryType { name } } }'
      }),
      signal: AbortSignal.timeout(5000)
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    const responseTime = performance.now() - start
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`)
    }
    
    return {
      status: responseTime < 100 ? 'healthy' : responseTime < 500 ? 'degraded' : 'unhealthy',
      responseTime,
      lastCheck: new Date().toISOString(),
      metadata: {
        schemaIntrospection: !!data.data?.__schema,
        endpoint: graphqlUrl
      }
    }
  } catch (error: any) {
    return {
      status: 'unhealthy',
      responseTime: performance.now() - start,
      lastCheck: new Date().toISOString(),
      error: error.message
    }
  }
}

// WebSocket health check
const checkWebSocketHealth = async (): Promise<ServiceCheck> => {
  const start = performance.now()
  
  try {
    // Check if Socket.io server is running by attempting a basic HTTP request
    const socketUrl = process.env.SOCKET_URL || 'http://localhost:3333'
    const response = await fetch(`${socketUrl}/socket.io/`, {
      signal: AbortSignal.timeout(5000)
    })
    
    const responseTime = performance.now() - start
    
    // Socket.io returns specific responses for health checks
    const isHealthy = response.status === 200 || response.status === 404 // 404 is expected for GET on socket.io
    
    if (!isHealthy) {
      throw new Error(`Unexpected response: ${response.status}`)
    }
    
    return {
      status: responseTime < 100 ? 'healthy' : responseTime < 500 ? 'degraded' : 'unhealthy',
      responseTime,
      lastCheck: new Date().toISOString(),
      metadata: {
        endpoint: socketUrl,
        httpStatus: response.status
      }
    }
  } catch (error: any) {
    return {
      status: 'unhealthy',
      responseTime: performance.now() - start,
      lastCheck: new Date().toISOString(),
      error: error.message
    }
  }
}

// System metrics collection
const collectSystemMetrics = async (): Promise<SystemMetrics> => {
  const cpus = os.cpus()
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem
  
  // Calculate CPU usage (simplified)
  const cpuUsage = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((sum, time) => sum + time, 0)
    const idle = cpu.times.idle
    return acc + ((total - idle) / total) * 100
  }, 0) / cpus.length
  
  // Get disk usage for the current directory
  let diskStats = { used: 0, free: 0, total: 0, percentage: 0 }
  try {
    const stats = await fs.stat('.')
    // This is a simplified disk check - in production you'd use statvfs or similar
    diskStats = {
      used: 0,
      free: 1000000000, // 1GB placeholder
      total: 1000000000,
      percentage: 0
    }
  } catch (error) {
    // Disk stats unavailable
  }
  
  return {
    cpu: {
      usage: cpuUsage,
      loadAverage: os.loadavg()
    },
    memory: {
      used: usedMem,
      free: freeMem,
      total: totalMem,
      percentage: (usedMem / totalMem) * 100
    },
    disk: diskStats,
    network: {
      connections: 0 // Placeholder - would need system-specific implementation
    }
  }
}

// External dependencies health check
const checkExternalDependencies = async (): Promise<DependencyHealthStatus> => {
  const external: { [key: string]: ServiceCheck } = {}
  
  // Example external service checks
  const externalServices = [
    {
      name: 'example-api',
      url: 'https://httpbin.org/status/200',
      timeout: 5000
    }
  ]
  
  for (const service of externalServices) {
    const start = performance.now()
    try {
      const response = await fetch(service.url, {
        signal: AbortSignal.timeout(service.timeout)
      })
      
      const responseTime = performance.now() - start
      
      external[service.name] = {
        status: response.ok ? 'healthy' : 'unhealthy',
        responseTime,
        lastCheck: new Date().toISOString(),
        metadata: {
          url: service.url,
          httpStatus: response.status
        }
      }
    } catch (error: any) {
      external[service.name] = {
        status: 'unhealthy',
        responseTime: performance.now() - start,
        lastCheck: new Date().toISOString(),
        error: error.message
      }
    }
  }
  
  return { external }
}

// Comprehensive health check endpoint
router.get('/', async (req, res) => {
  try {
    const startTime = performance.now()
    
    // Run all health checks in parallel
    const [
      databaseHealth,
      redisHealth,
      emailHealth,
      storageHealth,
      graphqlHealth,
      websocketHealth,
      systemMetrics,
      dependencies
    ] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
      checkEmailHealth(),
      checkStorageHealth(),
      checkGraphQLHealth(),
      checkWebSocketHealth(),
      collectSystemMetrics(),
      checkExternalDependencies()
    ])
    
    const services = {
      database: databaseHealth,
      redis: redisHealth,
      email: emailHealth,
      storage: storageHealth,
      graphql: graphqlHealth,
      websocket: websocketHealth
    }
    
    // Determine overall status
    const serviceStatuses = Object.values(services)
    const hasUnhealthy = serviceStatuses.some(s => s.status === 'unhealthy')
    const hasDegraded = serviceStatuses.some(s => s.status === 'degraded')
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy'
    if (hasUnhealthy) {
      overallStatus = 'unhealthy'
    } else if (hasDegraded) {
      overallStatus = 'degraded'
    } else {
      overallStatus = 'healthy'
    }
    
    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      services,
      metrics: systemMetrics,
      dependencies
    }
    
    const totalTime = performance.now() - startTime
    
    // Set appropriate HTTP status code
    const httpStatus = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503
    
    res.status(httpStatus).json({
      ...healthStatus,
      checkDuration: totalTime
    })
    
  } catch (error: any) {
    console.error('Health check failed:', error)
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      uptime: process.uptime()
    })
  }
})

// Individual service health checks
router.get('/database', async (req, res) => {
  const result = await checkDatabaseHealth()
  const status = result.status === 'healthy' ? 200 : 503
  res.status(status).json(result)
})

router.get('/redis', async (req, res) => {
  const result = await checkRedisHealth()
  const status = result.status === 'healthy' ? 200 : 503
  res.status(status).json(result)
})

router.get('/email', async (req, res) => {
  const result = await checkEmailHealth()
  const status = result.status === 'healthy' ? 200 : 503
  res.status(status).json(result)
})

router.get('/storage', async (req, res) => {
  const result = await checkStorageHealth()
  const status = result.status === 'healthy' ? 200 : 503
  res.status(status).json(result)
})

router.get('/graphql', async (req, res) => {
  const result = await checkGraphQLHealth()
  const status = result.status === 'healthy' ? 200 : 503
  res.status(status).json(result)
})

router.get('/websocket', async (req, res) => {
  const result = await checkWebSocketHealth()
  const status = result.status === 'healthy' ? 200 : 503
  res.status(status).json(result)
})

// System metrics endpoint
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await collectSystemMetrics()
    res.json(metrics)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Liveness probe (simple check)
router.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// Readiness probe (check if ready to serve traffic)
router.get('/ready', async (req, res) => {
  try {
    // Check critical services only
    const [databaseHealth, redisHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth()
    ])
    
    const isReady = databaseHealth.status !== 'unhealthy' && 
                    redisHealth.status !== 'unhealthy'
    
    if (isReady) {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        services: {
          database: databaseHealth.status,
          redis: redisHealth.status
        }
      })
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        services: {
          database: databaseHealth.status,
          redis: redisHealth.status
        }
      })
    }
  } catch (error: any) {
    res.status(503).json({
      status: 'not_ready',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

export default router