import { Injectable, Logger } from '@nestjs/common';
import { RedisCacheService } from '../redis/cache-service';
import { RedisConnectionManager } from '../redis/connection';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface CacheMetrics {
  timestamp: number;
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: number;
  avgResponseTime: number;
  errors: number;
  evictions: number;
  connections: number;
}

export interface CacheAlert {
  id: string;
  type: 'performance' | 'memory' | 'connection' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, any>;
  timestamp: number;
  resolved: boolean;
}

export interface MonitoringThresholds {
  hitRateWarning: number;
  hitRateCritical: number;
  memoryWarning: number;
  memoryCritical: number;
  responseTimeWarning: number;
  responseTimeCritical: number;
  errorRateWarning: number;
  errorRateCritical: number;
  connectionWarning: number;
  connectionCritical: number;
}

export interface CacheTrend {
  metric: string;
  period: 'hour' | 'day' | 'week' | 'month';
  dataPoints: Array<{ timestamp: number; value: number }>;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercentage: number;
}

@Injectable()
export class CacheMonitoringService {
  private readonly logger = new Logger(CacheMonitoringService.name);
  private metrics: CacheMetrics[] = [];
  private alerts: CacheAlert[] = [];
  private thresholds: MonitoringThresholds = {
    hitRateWarning: 80,
    hitRateCritical: 70,
    memoryWarning: 80,
    memoryCritical: 90,
    responseTimeWarning: 100,
    responseTimeCritical: 500,
    errorRateWarning: 5,
    errorRateCritical: 10,
    connectionWarning: 80,
    connectionCritical: 95
  };

  constructor(
    private cacheService: RedisCacheService,
    private connectionManager: RedisConnectionManager,
    private eventEmitter: EventEmitter2
  ) {}

  // Collect metrics every minute
  @Cron(CronExpression.EVERY_MINUTE)
  async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.gatherCurrentMetrics();
      this.metrics.push(metrics);
      
      // Keep only last 24 hours of metrics
      const cutoff = Date.now() - (24 * 60 * 60 * 1000);
      this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
      
      // Check for alerts
      await this.checkAlerts(metrics);
      
      // Emit metrics event
      this.eventEmitter.emit('cache.metrics.collected', metrics);
      
      this.logger.debug(`Collected cache metrics: ${metrics.hitRate.toFixed(2)}% hit rate`);
    } catch (error) {
      this.logger.error('Error collecting cache metrics:', error);
    }
  }

  // Generate performance report every hour
  @Cron(CronExpression.EVERY_HOUR)
  async generatePerformanceReport(): Promise<void> {
    try {
      const report = await this.createPerformanceReport();
      this.eventEmitter.emit('cache.report.generated', report);
      
      this.logger.log('Generated hourly cache performance report');
    } catch (error) {
      this.logger.error('Error generating performance report:', error);
    }
  }

  async getCurrentMetrics(): Promise<CacheMetrics> {
    return await this.gatherCurrentMetrics();
  }

  async getMetricsHistory(hours: number = 24): Promise<CacheMetrics[]> {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  async getActiveAlerts(): Promise<CacheAlert[]> {
    return this.alerts.filter(alert => !alert.resolved);
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      this.logger.log(`Resolved cache alert: ${alertId}`);
      return true;
    }
    return false;
  }

  async getTrends(period: 'hour' | 'day' | 'week' | 'month'): Promise<CacheTrend[]> {
    const trends: CacheTrend[] = [];
    const metrics = await this.getMetricsForPeriod(period);
    
    if (metrics.length < 2) {
      return trends;
    }

    // Calculate trends for key metrics
    const metricsToAnalyze = [
      'hitRate',
      'memoryUsage',
      'avgResponseTime',
      'totalKeys',
      'errors'
    ];

    for (const metric of metricsToAnalyze) {
      const trend = this.calculateTrend(metrics, metric);
      trends.push(trend);
    }

    return trends;
  }

  async getDashboardData(): Promise<{
    currentMetrics: CacheMetrics;
    recentMetrics: CacheMetrics[];
    activeAlerts: CacheAlert[];
    trends: CacheTrend[];
    topKeys: Array<{ key: string; hitCount: number; size: number }>;
    slowestQueries: Array<{ query: string; avgTime: number; count: number }>;
  }> {
    const [
      currentMetrics,
      recentMetrics,
      activeAlerts,
      trends,
      topKeys,
      slowestQueries
    ] = await Promise.all([
      this.getCurrentMetrics(),
      this.getMetricsHistory(6), // Last 6 hours
      this.getActiveAlerts(),
      this.getTrends('hour'),
      this.getTopCacheKeys(),
      this.getSlowestQueries()
    ]);

    return {
      currentMetrics,
      recentMetrics,
      activeAlerts,
      trends,
      topKeys,
      slowestQueries
    };
  }

  async updateThresholds(newThresholds: Partial<MonitoringThresholds>): Promise<void> {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    this.logger.log('Updated monitoring thresholds');
  }

  getThresholds(): MonitoringThresholds {
    return { ...this.thresholds };
  }

  async exportMetrics(
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const metrics = this.metrics.filter(m => 
      m.timestamp >= startDate.getTime() && 
      m.timestamp <= endDate.getTime()
    );

    if (format === 'csv') {
      return this.convertMetricsToCSV(metrics);
    }

    return JSON.stringify(metrics, null, 2);
  }

  private async gatherCurrentMetrics(): Promise<CacheMetrics> {
    const redis = this.connectionManager.getRedis();
    const cacheStats = this.cacheService.getStats();
    
    try {
      // Get Redis INFO
      const info = await redis.info();
      const infoObj = this.parseRedisInfo(info);
      
      // Get connection info
      const connectionInfo = this.connectionManager.getConnectionInfo();
      
      return {
        timestamp: Date.now(),
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: cacheStats.hitRate,
        totalKeys: await redis.dbsize(),
        memoryUsage: parseInt(infoObj.used_memory_rss || '0'),
        avgResponseTime: cacheStats.averageResponseTime,
        errors: parseInt(infoObj.rejected_connections || '0'),
        evictions: parseInt(infoObj.evicted_keys || '0'),
        connections: parseInt(infoObj.connected_clients || '0')
      };
    } catch (error) {
      this.logger.error('Error gathering cache metrics:', error);
      
      // Return basic metrics from cache service
      return {
        timestamp: Date.now(),
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: cacheStats.hitRate,
        totalKeys: 0,
        memoryUsage: 0,
        avgResponseTime: cacheStats.averageResponseTime,
        errors: 0,
        evictions: 0,
        connections: 0
      };
    }
  }

  private parseRedisInfo(info: string): Record<string, string> {
    const infoObj: Record<string, string> = {};
    
    info.split('\r\n').forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        infoObj[key] = value;
      }
    });
    
    return infoObj;
  }

  private async checkAlerts(metrics: CacheMetrics): Promise<void> {
    const alerts: CacheAlert[] = [];
    
    // Check hit rate
    if (metrics.hitRate < this.thresholds.hitRateCritical) {
      alerts.push(this.createAlert(
        'performance',
        'critical',
        `Cache hit rate critically low: ${metrics.hitRate.toFixed(2)}%`,
        { hitRate: metrics.hitRate, threshold: this.thresholds.hitRateCritical }
      ));
    } else if (metrics.hitRate < this.thresholds.hitRateWarning) {
      alerts.push(this.createAlert(
        'performance',
        'medium',
        `Cache hit rate below warning threshold: ${metrics.hitRate.toFixed(2)}%`,
        { hitRate: metrics.hitRate, threshold: this.thresholds.hitRateWarning }
      ));
    }
    
    // Check memory usage
    const memoryUsagePercent = this.calculateMemoryUsagePercent(metrics.memoryUsage);
    if (memoryUsagePercent > this.thresholds.memoryCritical) {
      alerts.push(this.createAlert(
        'memory',
        'critical',
        `Memory usage critically high: ${memoryUsagePercent.toFixed(2)}%`,
        { memoryUsage: memoryUsagePercent, threshold: this.thresholds.memoryCritical }
      ));
    } else if (memoryUsagePercent > this.thresholds.memoryWarning) {
      alerts.push(this.createAlert(
        'memory',
        'medium',
        `Memory usage above warning threshold: ${memoryUsagePercent.toFixed(2)}%`,
        { memoryUsage: memoryUsagePercent, threshold: this.thresholds.memoryWarning }
      ));
    }
    
    // Check response time
    if (metrics.avgResponseTime > this.thresholds.responseTimeCritical) {
      alerts.push(this.createAlert(
        'performance',
        'critical',
        `Average response time critically high: ${metrics.avgResponseTime.toFixed(2)}ms`,
        { responseTime: metrics.avgResponseTime, threshold: this.thresholds.responseTimeCritical }
      ));
    } else if (metrics.avgResponseTime > this.thresholds.responseTimeWarning) {
      alerts.push(this.createAlert(
        'performance',
        'medium',
        `Average response time above warning threshold: ${metrics.avgResponseTime.toFixed(2)}ms`,
        { responseTime: metrics.avgResponseTime, threshold: this.thresholds.responseTimeWarning }
      ));
    }
    
    // Add new alerts
    alerts.forEach(alert => {
      if (!this.isDuplicateAlert(alert)) {
        this.alerts.push(alert);
        this.eventEmitter.emit('cache.alert.created', alert);
        this.logger.warn(`Cache alert: ${alert.message}`);
      }
    });
    
    // Clean up old resolved alerts
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    this.alerts = this.alerts.filter(alert => 
      !alert.resolved || alert.timestamp > cutoff
    );
  }

  private createAlert(
    type: CacheAlert['type'],
    severity: CacheAlert['severity'],
    message: string,
    details: Record<string, any>
  ): CacheAlert {
    return {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      details,
      timestamp: Date.now(),
      resolved: false
    };
  }

  private isDuplicateAlert(newAlert: CacheAlert): boolean {
    const recentAlerts = this.alerts.filter(alert => 
      alert.type === newAlert.type && 
      alert.timestamp > Date.now() - (5 * 60 * 1000) && // Last 5 minutes
      !alert.resolved
    );
    
    return recentAlerts.length > 0;
  }

  private calculateMemoryUsagePercent(memoryUsage: number): number {
    // Assuming max memory of 1GB for calculation
    const maxMemory = 1024 * 1024 * 1024; // 1GB in bytes
    return (memoryUsage / maxMemory) * 100;
  }

  private getMetricsForPeriod(period: 'hour' | 'day' | 'week' | 'month'): CacheMetrics[] {
    const now = Date.now();
    let cutoff: number;
    
    switch (period) {
      case 'hour':
        cutoff = now - (60 * 60 * 1000);
        break;
      case 'day':
        cutoff = now - (24 * 60 * 60 * 1000);
        break;
      case 'week':
        cutoff = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        cutoff = now - (30 * 24 * 60 * 60 * 1000);
        break;
    }
    
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  private calculateTrend(metrics: CacheMetrics[], metricName: string): CacheTrend {
    const dataPoints = metrics.map(m => ({
      timestamp: m.timestamp,
      value: (m as any)[metricName] || 0
    }));
    
    if (dataPoints.length < 2) {
      return {
        metric: metricName,
        period: 'hour',
        dataPoints,
        trend: 'stable',
        changePercentage: 0
      };
    }
    
    const firstValue = dataPoints[0].value;
    const lastValue = dataPoints[dataPoints.length - 1].value;
    const changePercentage = firstValue > 0 ? 
      ((lastValue - firstValue) / firstValue) * 100 : 0;
    
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(changePercentage) > 5) {
      trend = changePercentage > 0 ? 'increasing' : 'decreasing';
    }
    
    return {
      metric: metricName,
      period: 'hour',
      dataPoints,
      trend,
      changePercentage
    };
  }

  private async createPerformanceReport(): Promise<any> {
    const currentMetrics = await this.getCurrentMetrics();
    const hourlyMetrics = await this.getMetricsHistory(1);
    const trends = await this.getTrends('hour');
    const activeAlerts = await this.getActiveAlerts();
    
    return {
      timestamp: Date.now(),
      summary: {
        hitRate: currentMetrics.hitRate,
        totalKeys: currentMetrics.totalKeys,
        memoryUsage: currentMetrics.memoryUsage,
        avgResponseTime: currentMetrics.avgResponseTime,
        activeAlerts: activeAlerts.length
      },
      trends,
      recommendations: this.generateRecommendations(currentMetrics, trends)
    };
  }

  private generateRecommendations(
    metrics: CacheMetrics, 
    trends: CacheTrend[]
  ): string[] {
    const recommendations: string[] = [];
    
    if (metrics.hitRate < 80) {
      recommendations.push('Consider reviewing cache key strategies and TTL values');
    }
    
    if (metrics.avgResponseTime > 50) {
      recommendations.push('Investigate slow cache operations and optimize Redis configuration');
    }
    
    const memoryTrend = trends.find(t => t.metric === 'memoryUsage');
    if (memoryTrend?.trend === 'increasing' && memoryTrend.changePercentage > 20) {
      recommendations.push('Memory usage increasing rapidly - consider implementing cache eviction policies');
    }
    
    const errorTrend = trends.find(t => t.metric === 'errors');
    if (errorTrend?.trend === 'increasing') {
      recommendations.push('Error rate increasing - check Redis connection stability');
    }
    
    return recommendations;
  }

  private async getTopCacheKeys(): Promise<Array<{ key: string; hitCount: number; size: number }>> {
    // This would require additional Redis commands to track key statistics
    // Implementation would depend on your specific Redis setup
    return [];
  }

  private async getSlowestQueries(): Promise<Array<{ query: string; avgTime: number; count: number }>> {
    // This would require query logging and analysis
    // Implementation would depend on your specific setup
    return [];
  }

  private convertMetricsToCSV(metrics: CacheMetrics[]): string {
    const headers = [
      'timestamp',
      'hits',
      'misses', 
      'hitRate',
      'totalKeys',
      'memoryUsage',
      'avgResponseTime',
      'errors',
      'evictions',
      'connections'
    ];
    
    const rows = metrics.map(m => [
      new Date(m.timestamp).toISOString(),
      m.hits,
      m.misses,
      m.hitRate,
      m.totalKeys,
      m.memoryUsage,
      m.avgResponseTime,
      m.errors,
      m.evictions,
      m.connections
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }
}