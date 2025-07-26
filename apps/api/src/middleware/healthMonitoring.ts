import { Request, Response, NextFunction } from 'express'
import { performance } from 'perf_hooks'
import { createClient } from 'redis'

// Interface for monitoring metrics
interface RequestMetrics {
  method: string
  path: string
  statusCode: number
  responseTime: number
  timestamp: number
  userAgent?: string
  ip?: string
  error?: string
}

interface SystemAlerts {
  type: 'error' | 'warning' | 'info'
  service: string
  message: string
  timestamp: number
  metadata?: any
}

class HealthMonitoring {
  private redisClient: any
  private alerts: SystemAlerts[] = []
  private metricsBuffer: RequestMetrics[] = []
  private readonly bufferSize = 1000
  private readonly alertRetentionTime = 24 * 60 * 60 * 1000 // 24 hours

  constructor() {
    this.initializeRedis()
    this.startMetricsFlusher()
    this.startAlertsCleanup()
  }

  private async initializeRedis() {
    try {
      this.redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 5000,
          lazyConnect: true
        }
      })
      
      this.redisClient.on('error', (err: any) => {
        console.error('Health monitoring Redis error:', err)
        this.addAlert('error', 'redis', 'Redis connection error', { error: err.message })
      })
      
      if (!this.redisClient.isOpen) {
        await this.redisClient.connect()
      }
    } catch (error: any) {
      console.error('Failed to initialize health monitoring Redis:', error)
    }
  }

  // Express middleware for request monitoring
  public requestMonitoring = (req: Request, res: Response, next: NextFunction) => {
    const startTime = performance.now()
    
    // Capture original end method
    const originalEnd = res.end
    
    // Override end method to capture metrics
    res.end = function(this: Response, ...args: any[]) {
      const responseTime = performance.now() - startTime
      
      // Create metrics object
      const metrics: RequestMetrics = {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTime,
        timestamp: Date.now(),
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress
      }
      
      // Add error info for error responses
      if (res.statusCode >= 400) {
        metrics.error = res.statusMessage || 'Unknown error'
      }
      
      // Store metrics
      healthMonitoring.recordMetrics(metrics)
      
      // Check for alerts
      healthMonitoring.checkResponseTimeAlert(responseTime, req.path)
      healthMonitoring.checkErrorRateAlert(res.statusCode)
      
      // Call original end method
      return originalEnd.apply(this, args)
    }
    
    next()
  }

  // Record request metrics
  public recordMetrics(metrics: RequestMetrics) {
    this.metricsBuffer.push(metrics)
    
    // Flush buffer if it's full
    if (this.metricsBuffer.length >= this.bufferSize) {
      this.flushMetrics()
    }
  }

  // Flush metrics to Redis
  private async flushMetrics() {
    if (this.metricsBuffer.length === 0 || !this.redisClient?.isOpen) {
      return
    }
    
    try {
      const metricsToFlush = [...this.metricsBuffer]
      this.metricsBuffer = []
      
      // Store metrics in Redis with TTL
      const key = `metrics:${Date.now()}`
      await this.redisClient.setEx(key, 3600, JSON.stringify(metricsToFlush)) // 1 hour TTL
      
      // Update aggregated metrics
      await this.updateAggregatedMetrics(metricsToFlush)
      
    } catch (error: any) {
      console.error('Failed to flush metrics:', error)
      this.addAlert('error', 'monitoring', 'Failed to flush metrics', { error: error.message })
    }
  }

  // Update aggregated metrics for dashboards
  private async updateAggregatedMetrics(metrics: RequestMetrics[]) {
    if (!this.redisClient?.isOpen) return
    
    try {
      const now = Date.now()
      const minuteKey = `metrics:aggregated:${Math.floor(now / 60000)}` // Per minute
      const hourKey = `metrics:aggregated:${Math.floor(now / 3600000)}` // Per hour
      
      // Calculate aggregations
      const totalRequests = metrics.length
      const errorCount = metrics.filter(m => m.statusCode >= 400).length
      const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests
      const maxResponseTime = Math.max(...metrics.map(m => m.responseTime))
      
      const aggregation = {
        totalRequests,
        errorCount,
        errorRate: (errorCount / totalRequests) * 100,
        avgResponseTime,
        maxResponseTime,
        timestamp: now
      }
      
      // Store with TTL
      await Promise.all([
        this.redisClient.setEx(minuteKey, 3600, JSON.stringify(aggregation)), // 1 hour TTL
        this.redisClient.setEx(hourKey, 86400, JSON.stringify(aggregation))   // 24 hours TTL
      ])
      
    } catch (error: any) {
      console.error('Failed to update aggregated metrics:', error)
    }
  }

  // Add system alert
  public addAlert(type: SystemAlerts['type'], service: string, message: string, metadata?: any) {
    const alert: SystemAlerts = {
      type,
      service,
      message,
      timestamp: Date.now(),
      metadata
    }
    
    this.alerts.push(alert)
    console.log(`🚨 [${type.toUpperCase()}] ${service}: ${message}`)
    
    // Store alert in Redis for persistence
    this.storeAlert(alert)
    
    // Trigger webhook if critical
    if (type === 'error') {
      this.triggerAlertWebhook(alert)
    }
  }

  // Store alert in Redis
  private async storeAlert(alert: SystemAlerts) {
    if (!this.redisClient?.isOpen) return
    
    try {
      const key = `alerts:${alert.timestamp}`
      await this.redisClient.setEx(key, 86400, JSON.stringify(alert)) // 24 hours TTL
      
      // Add to alerts list (for easy retrieval)
      await this.redisClient.lPush('alerts:list', key)
      await this.redisClient.lTrim('alerts:list', 0, 999) // Keep last 1000 alerts
      
    } catch (error: any) {
      console.error('Failed to store alert:', error)
    }
  }

  // Check for response time alerts
  private checkResponseTimeAlert(responseTime: number, path: string) {
    const slowThreshold = 1000 // 1 second
    const criticalThreshold = 5000 // 5 seconds
    
    if (responseTime > criticalThreshold) {
      this.addAlert('error', 'performance', 
        `Critical response time on ${path}: ${responseTime.toFixed(2)}ms`, 
        { path, responseTime })
    } else if (responseTime > slowThreshold) {
      this.addAlert('warning', 'performance', 
        `Slow response time on ${path}: ${responseTime.toFixed(2)}ms`, 
        { path, responseTime })
    }
  }

  // Check for error rate alerts
  private checkErrorRateAlert(statusCode: number) {
    if (statusCode >= 500) {
      this.addAlert('error', 'api', 
        `Server error: HTTP ${statusCode}`, 
        { statusCode })
    } else if (statusCode >= 400) {
      this.addAlert('warning', 'api', 
        `Client error: HTTP ${statusCode}`, 
        { statusCode })
    }
  }

  // Get recent alerts
  public async getRecentAlerts(limit: number = 50): Promise<SystemAlerts[]> {
    if (!this.redisClient?.isOpen) {
      return this.alerts.slice(-limit)
    }
    
    try {
      const alertKeys = await this.redisClient.lRange('alerts:list', 0, limit - 1)
      const alerts = await Promise.all(
        alertKeys.map(async (key: string) => {
          const alertData = await this.redisClient.get(key)
          return alertData ? JSON.parse(alertData) : null
        })
      )
      
      return alerts.filter(alert => alert !== null)
    } catch (error: any) {
      console.error('Failed to get recent alerts:', error)
      return this.alerts.slice(-limit)
    }
  }

  // Get metrics summary
  public async getMetricsSummary(timeRange: number = 3600000): Promise<any> {
    if (!this.redisClient?.isOpen) {
      return { error: 'Redis not available' }
    }
    
    try {
      const now = Date.now()
      const startTime = now - timeRange
      
      // Get aggregated metrics from the last hour
      const keys = await this.redisClient.keys('metrics:aggregated:*')
      const recentKeys = keys.filter((key: string) => {
        const timestamp = parseInt(key.split(':')[2]) * 60000 // Convert back to milliseconds
        return timestamp >= startTime
      })
      
      if (recentKeys.length === 0) {
        return { totalRequests: 0, errorRate: 0, avgResponseTime: 0 }
      }
      
      const metricsData = await Promise.all(
        recentKeys.map(async (key: string) => {
          const data = await this.redisClient.get(key)
          return data ? JSON.parse(data) : null
        })
      )
      
      const validMetrics = metricsData.filter(m => m !== null)
      
      if (validMetrics.length === 0) {
        return { totalRequests: 0, errorRate: 0, avgResponseTime: 0 }
      }
      
      // Calculate summary
      const totalRequests = validMetrics.reduce((sum, m) => sum + m.totalRequests, 0)
      const totalErrors = validMetrics.reduce((sum, m) => sum + m.errorCount, 0)
      const avgResponseTime = validMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / validMetrics.length
      const maxResponseTime = Math.max(...validMetrics.map(m => m.maxResponseTime))
      
      return {
        totalRequests,
        errorCount: totalErrors,
        errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
        avgResponseTime,
        maxResponseTime,
        timeRange: timeRange / 1000 / 60, // Convert to minutes
        dataPoints: validMetrics.length
      }
      
    } catch (error: any) {
      console.error('Failed to get metrics summary:', error)
      return { error: error.message }
    }
  }

  // Trigger alert webhook
  private async triggerAlertWebhook(alert: SystemAlerts) {
    const webhookUrl = process.env.ALERT_WEBHOOK_URL
    if (!webhookUrl) return
    
    try {
      const payload = {
        text: `🚨 Alert: ${alert.service} - ${alert.message}`,
        alert,
        timestamp: new Date(alert.timestamp).toISOString(),
        environment: process.env.NODE_ENV || 'development'
      }
      
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000)
      })
      
    } catch (error: any) {
      console.error('Failed to send alert webhook:', error)
    }
  }

  // Start periodic metrics flusher
  private startMetricsFlusher() {
    setInterval(() => {
      this.flushMetrics()
    }, 30000) // Flush every 30 seconds
  }

  // Start alerts cleanup
  private startAlertsCleanup() {
    setInterval(() => {
      const cutoff = Date.now() - this.alertRetentionTime
      this.alerts = this.alerts.filter(alert => alert.timestamp > cutoff)
    }, 3600000) // Cleanup every hour
  }

  // Graceful shutdown
  public async shutdown() {
    try {
      // Flush any remaining metrics
      await this.flushMetrics()
      
      // Close Redis connection
      if (this.redisClient?.isOpen) {
        await this.redisClient.quit()
      }
    } catch (error: any) {
      console.error('Error during health monitoring shutdown:', error)
    }
  }
}

// Export singleton instance
export const healthMonitoring = new HealthMonitoring()

// Export middleware
export const requestMonitoring = healthMonitoring.requestMonitoring