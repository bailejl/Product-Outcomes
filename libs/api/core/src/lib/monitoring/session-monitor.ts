import { SessionManager } from '../config/session.config'
import { EventEmitter } from 'events'

export interface SessionMetrics {
  totalSessions: number
  activeSessions: number
  expiredSessions: number
  avgSessionDuration: number
  peakConcurrentSessions: number
  sessionsPerHour: number
  cleanupRuns: number
  lastCleanup: Date | null
}

export interface SessionAlert {
  type: 'HIGH_SESSION_COUNT' | 'CLEANUP_FAILED' | 'REDIS_ERROR' | 'MEMORY_WARNING'
  message: string
  timestamp: Date
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  metadata?: Record<string, any>
}

export class SessionMonitor extends EventEmitter {
  private sessionManager: SessionManager
  private metrics: SessionMetrics
  private alertThresholds: {
    maxTotalSessions: number
    maxSessionsPerUser: number
    cleanupInterval: number
    alertCooldown: number
  }
  private cleanupInterval: NodeJS.Timeout | null = null
  private metricsInterval: NodeJS.Timeout | null = null
  private lastAlerts: Map<string, Date> = new Map()
  private isRunning = false

  constructor(
    sessionManager: SessionManager,
    options: {
      maxTotalSessions?: number
      maxSessionsPerUser?: number
      cleanupInterval?: number
      metricsInterval?: number
      alertCooldown?: number
    } = {}
  ) {
    super()
    this.sessionManager = sessionManager
    this.alertThresholds = {
      maxTotalSessions: options.maxTotalSessions || 10000,
      maxSessionsPerUser: options.maxSessionsPerUser || 10,
      cleanupInterval: options.cleanupInterval || 60000, // 1 minute
      alertCooldown: options.alertCooldown || 300000, // 5 minutes
    }

    this.metrics = {
      totalSessions: 0,
      activeSessions: 0,
      expiredSessions: 0,
      avgSessionDuration: 0,
      peakConcurrentSessions: 0,
      sessionsPerHour: 0,
      cleanupRuns: 0,
      lastCleanup: null,
    }

    // Set up automatic session cleanup
    this.setupCleanupScheduler(this.alertThresholds.cleanupInterval)
    
    // Set up metrics collection
    this.setupMetricsCollection(options.metricsInterval || 30000) // 30 seconds
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.isRunning) {
      console.log('📊 Session monitor already running')
      return
    }

    this.isRunning = true
    console.log('🚀 Session monitor started')
    this.emit('monitor:started')
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
      this.metricsInterval = null
    }

    console.log('🛑 Session monitor stopped')
    this.emit('monitor:stopped')
  }

  /**
   * Get current metrics
   */
  getMetrics(): SessionMetrics {
    return { ...this.metrics }
  }

  /**
   * Manually trigger cleanup
   */
  async triggerCleanup(): Promise<number> {
    try {
      console.log('🧹 Manual session cleanup triggered')
      const cleanedCount = await this.sessionManager.cleanupExpiredSessions()
      
      this.metrics.cleanupRuns++
      this.metrics.lastCleanup = new Date()
      
      this.emit('cleanup:completed', { cleanedCount })
      return cleanedCount
    } catch (error) {
      console.error('❌ Manual cleanup failed:', error)
      this.emitAlert({
        type: 'CLEANUP_FAILED',
        message: `Manual cleanup failed: ${error.message}`,
        timestamp: new Date(),
        severity: 'HIGH',
        metadata: { error: error.message },
      })
      throw error
    }
  }

  /**
   * Get session statistics with additional monitoring data
   */
  async getDetailedStats(): Promise<{
    current: SessionMetrics
    redis: any
    alerts: SessionAlert[]
  }> {
    try {
      const sessionStats = await this.sessionManager.getSessionStats()
      
      // Update current metrics
      this.updateMetrics(sessionStats)

      return {
        current: this.getMetrics(),
        redis: sessionStats,
        alerts: [], // Could store recent alerts here
      }
    } catch (error) {
      console.error('❌ Failed to get detailed stats:', error)
      this.emitAlert({
        type: 'REDIS_ERROR',
        message: `Failed to retrieve session stats: ${error.message}`,
        timestamp: new Date(),
        severity: 'HIGH',
        metadata: { error: error.message },
      })
      throw error
    }
  }

  /**
   * Check for suspicious session activity
   */
  async checkSessionAnomalies(): Promise<SessionAlert[]> {
    const alerts: SessionAlert[] = []

    try {
      const stats = await this.sessionManager.getSessionStats()
      
      // Check for high session count
      if (stats.totalSessions > this.alertThresholds.maxTotalSessions) {
        alerts.push({
          type: 'HIGH_SESSION_COUNT',
          message: `High session count detected: ${stats.totalSessions} sessions`,
          timestamp: new Date(),
          severity: stats.totalSessions > this.alertThresholds.maxTotalSessions * 1.5 ? 'CRITICAL' : 'HIGH',
          metadata: { sessionCount: stats.totalSessions, threshold: this.alertThresholds.maxTotalSessions },
        })
      }

      // Check for high percentage of expired sessions
      const expiredPercentage = stats.totalSessions > 0 
        ? (stats.expiredSessions / stats.totalSessions) * 100 
        : 0
      
      if (expiredPercentage > 50) {
        alerts.push({
          type: 'MEMORY_WARNING',
          message: `High percentage of expired sessions: ${expiredPercentage.toFixed(1)}%`,
          timestamp: new Date(),
          severity: expiredPercentage > 80 ? 'HIGH' : 'MEDIUM',
          metadata: { expiredPercentage, expiredCount: stats.expiredSessions },
        })
      }

      // Emit alerts with cooldown
      for (const alert of alerts) {
        this.emitAlert(alert)
      }

      return alerts
    } catch (error) {
      console.error('❌ Failed to check session anomalies:', error)
      return []
    }
  }

  /**
   * Generate monitoring report
   */
  generateReport(): {
    summary: string
    metrics: SessionMetrics
    recommendations: string[]
  } {
    const metrics = this.getMetrics()
    const recommendations: string[] = []

    // Generate recommendations based on metrics
    if (metrics.expiredSessions > metrics.activeSessions) {
      recommendations.push('Consider reducing session timeout or increasing cleanup frequency')
    }

    if (metrics.peakConcurrentSessions > this.alertThresholds.maxTotalSessions * 0.8) {
      recommendations.push('Monitor for potential DDoS or consider scaling Redis')
    }

    if (metrics.avgSessionDuration < 300000) { // Less than 5 minutes
      recommendations.push('Short session duration detected - investigate user experience')
    }

    const summary = `
Session Monitor Report
=====================
Total Sessions: ${metrics.totalSessions}
Active Sessions: ${metrics.activeSessions}
Expired Sessions: ${metrics.expiredSessions}
Peak Concurrent: ${metrics.peakConcurrentSessions}
Average Duration: ${Math.round(metrics.avgSessionDuration / 60000)}m
Cleanup Runs: ${metrics.cleanupRuns}
Last Cleanup: ${metrics.lastCleanup?.toISOString() || 'Never'}
`.trim()

    return {
      summary,
      metrics,
      recommendations,
    }
  }

  /**
   * Set up automatic cleanup scheduler
   */
  private setupCleanupScheduler(interval: number): void {
    this.cleanupInterval = setInterval(async () => {
      if (!this.isRunning) return

      try {
        console.log('🔄 Automated session cleanup starting...')
        const cleanedCount = await this.sessionManager.cleanupExpiredSessions()
        
        this.metrics.cleanupRuns++
        this.metrics.lastCleanup = new Date()
        
        if (cleanedCount > 0) {
          console.log(`✅ Cleaned up ${cleanedCount} expired sessions`)
        }
        
        this.emit('cleanup:completed', { cleanedCount })
        
        // Check for anomalies after cleanup
        await this.checkSessionAnomalies()
      } catch (error) {
        console.error('❌ Automated cleanup failed:', error)
        this.emitAlert({
          type: 'CLEANUP_FAILED',
          message: `Automated cleanup failed: ${error.message}`,
          timestamp: new Date(),
          severity: 'HIGH',
          metadata: { error: error.message },
        })
      }
    }, interval)
  }

  /**
   * Set up metrics collection
   */
  private setupMetricsCollection(interval: number): void {
    this.metricsInterval = setInterval(async () => {
      if (!this.isRunning) return

      try {
        const stats = await this.sessionManager.getSessionStats()
        this.updateMetrics(stats)
        this.emit('metrics:updated', this.getMetrics())
      } catch (error) {
        console.error('❌ Failed to collect metrics:', error)
      }
    }, interval)
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(stats: { totalSessions: number; activeSessions: number; expiredSessions: number }): void {
    this.metrics.totalSessions = stats.totalSessions
    this.metrics.activeSessions = stats.activeSessions
    this.metrics.expiredSessions = stats.expiredSessions
    
    // Update peak concurrent sessions
    if (stats.activeSessions > this.metrics.peakConcurrentSessions) {
      this.metrics.peakConcurrentSessions = stats.activeSessions
    }
    
    // Calculate sessions per hour (simple estimation)
    this.metrics.sessionsPerHour = Math.round(stats.activeSessions * 2) // Rough estimate
  }

  /**
   * Emit alert with cooldown
   */
  private emitAlert(alert: SessionAlert): void {
    const alertKey = `${alert.type}-${alert.severity}`
    const lastAlert = this.lastAlerts.get(alertKey)
    const now = new Date()

    // Check cooldown
    if (lastAlert && (now.getTime() - lastAlert.getTime()) < this.alertThresholds.alertCooldown) {
      return
    }

    console.warn(`🚨 Session Alert [${alert.severity}]: ${alert.message}`)
    this.lastAlerts.set(alertKey, now)
    this.emit('alert', alert)
  }
}

/**
 * Create a session monitor with default configuration
 */
export function createSessionMonitor(
  sessionManager: SessionManager,
  options?: {
    maxTotalSessions?: number
    maxSessionsPerUser?: number
    cleanupInterval?: number
    metricsInterval?: number
    alertCooldown?: number
  }
): SessionMonitor {
  return new SessionMonitor(sessionManager, options)
}