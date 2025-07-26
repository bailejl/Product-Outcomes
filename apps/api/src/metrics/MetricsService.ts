import client from 'prom-client';
import { Request, Response } from 'express';
import os from 'os';
import process from 'process';

// Initialize default metrics collection
client.collectDefaultMetrics({
  prefix: 'product_outcomes_',
  timeout: 5000,
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
});

export class MetricsService {
  private static instance: MetricsService;
  
  // HTTP Request Metrics
  public httpRequestsTotal = new client.Counter({
    name: 'product_outcomes_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code', 'user_id', 'organization_id']
  });

  public httpRequestDuration = new client.Histogram({
    name: 'product_outcomes_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10]
  });

  // GraphQL Metrics
  public graphqlOperationsTotal = new client.Counter({
    name: 'product_outcomes_graphql_operations_total',
    help: 'Total number of GraphQL operations',
    labelNames: ['operation_name', 'operation_type', 'status', 'user_id']
  });

  public graphqlOperationDuration = new client.Histogram({
    name: 'product_outcomes_graphql_operation_duration_seconds',
    help: 'GraphQL operation duration in seconds',
    labelNames: ['operation_name', 'operation_type'],
    buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10]
  });

  public graphqlResolverDuration = new client.Histogram({
    name: 'product_outcomes_graphql_resolver_duration_seconds',
    help: 'GraphQL resolver duration in seconds',
    labelNames: ['resolver_name', 'parent_type'],
    buckets: [0.001, 0.01, 0.1, 0.5, 1, 2]
  });

  // Business Metrics - OKRs
  public okrCreations = new client.Counter({
    name: 'product_outcomes_okr_creations_total',
    help: 'Total number of OKRs created',
    labelNames: ['organization_id', 'quarter', 'type']
  });

  public okrCompletions = new client.Counter({
    name: 'product_outcomes_okr_completions_total',
    help: 'Total number of OKRs completed',
    labelNames: ['organization_id', 'quarter', 'completion_level']
  });

  public okrProgress = new client.Gauge({
    name: 'product_outcomes_okr_progress_percent',
    help: 'Current progress percentage of active OKRs',
    labelNames: ['okr_id', 'organization_id', 'owner_id']
  });

  // Business Metrics - Users
  public userRegistrations = new client.Counter({
    name: 'product_outcomes_user_registrations_total',
    help: 'Total number of user registrations',
    labelNames: ['organization_id', 'registration_type']
  });

  public activeUsers = new client.Gauge({
    name: 'product_outcomes_active_users',
    help: 'Number of active users in different time periods',
    labelNames: ['time_period', 'organization_id']
  });

  public userSessions = new client.Gauge({
    name: 'product_outcomes_user_sessions_active',
    help: 'Number of active user sessions',
    labelNames: ['organization_id']
  });

  // Business Metrics - Organizations
  public organizationCreations = new client.Counter({
    name: 'product_outcomes_organization_creations_total',
    help: 'Total number of organizations created',
    labelNames: ['plan_type']
  });

  public organizationActiveUsers = new client.Gauge({
    name: 'product_outcomes_organization_active_users',
    help: 'Number of active users per organization',
    labelNames: ['organization_id']
  });

  // Database Metrics
  public databaseConnections = new client.Gauge({
    name: 'product_outcomes_database_connections',
    help: 'Number of active database connections',
    labelNames: ['database_name', 'status']
  });

  public databaseQueryDuration = new client.Histogram({
    name: 'product_outcomes_database_query_duration_seconds',
    help: 'Database query duration in seconds',
    labelNames: ['query_type', 'table'],
    buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5]
  });

  public databaseErrors = new client.Counter({
    name: 'product_outcomes_database_errors_total',
    help: 'Total number of database errors',
    labelNames: ['error_type', 'table']
  });

  // Redis Metrics
  public redisConnections = new client.Gauge({
    name: 'product_outcomes_redis_connections',
    help: 'Number of Redis connections',
    labelNames: ['instance', 'status']
  });

  public redisOperations = new client.Counter({
    name: 'product_outcomes_redis_operations_total',
    help: 'Total number of Redis operations',
    labelNames: ['operation', 'status']
  });

  public redisOperationDuration = new client.Histogram({
    name: 'product_outcomes_redis_operation_duration_seconds',
    help: 'Redis operation duration in seconds',
    labelNames: ['operation'],
    buckets: [0.001, 0.01, 0.1, 0.5, 1]
  });

  // WebSocket Metrics
  public websocketConnections = new client.Gauge({
    name: 'product_outcomes_websocket_connections',
    help: 'Number of active WebSocket connections',
    labelNames: ['namespace', 'organization_id']
  });

  public websocketMessages = new client.Counter({
    name: 'product_outcomes_websocket_messages_total',
    help: 'Total number of WebSocket messages',
    labelNames: ['namespace', 'event_type', 'direction']
  });

  // System Metrics (Custom)
  public systemInfo = new client.Gauge({
    name: 'product_outcomes_system_info',
    help: 'System information',
    labelNames: ['version', 'node_version', 'environment']
  });

  public memoryUsage = new client.Gauge({
    name: 'product_outcomes_memory_usage_bytes',
    help: 'Memory usage in bytes',
    labelNames: ['type']
  });

  public cpuUsage = new client.Gauge({
    name: 'product_outcomes_cpu_usage_percent',
    help: 'CPU usage percentage',
    labelNames: ['type']
  });

  // Error Metrics
  public errors = new client.Counter({
    name: 'product_outcomes_errors_total',
    help: 'Total number of errors',
    labelNames: ['type', 'service', 'severity']
  });

  public unhandledErrors = new client.Counter({
    name: 'product_outcomes_unhandled_errors_total',
    help: 'Total number of unhandled errors',
    labelNames: ['type']
  });

  constructor() {
    this.initializeSystemMetrics();
    this.setupPeriodicMetrics();
  }

  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  private initializeSystemMetrics() {
    // Set system info
    this.systemInfo.set(
      {
        version: process.env.npm_package_version || '1.0.0',
        node_version: process.version,
        environment: process.env.NODE_ENV || 'development'
      },
      1
    );
  }

  private setupPeriodicMetrics() {
    // Update system metrics every 30 seconds
    setInterval(() => {
      this.updateSystemMetrics();
    }, 30000);
  }

  private updateSystemMetrics() {
    // Memory usage
    const memUsage = process.memoryUsage();
    this.memoryUsage.set({ type: 'rss' }, memUsage.rss);
    this.memoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
    this.memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
    this.memoryUsage.set({ type: 'external' }, memUsage.external);

    // CPU usage (approximation)
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    this.cpuUsage.set({ type: 'total' }, usage);
  }

  // Helper methods for business metrics
  public recordOKRCreation(organizationId: string, quarter: string, type: string) {
    this.okrCreations.inc({ organization_id: organizationId, quarter, type });
  }

  public recordOKRCompletion(organizationId: string, quarter: string, completionLevel: string) {
    this.okrCompletions.inc({ organization_id: organizationId, quarter, completion_level: completionLevel });
  }

  public updateOKRProgress(okrId: string, organizationId: string, ownerId: string, progress: number) {
    this.okrProgress.set({ okr_id: okrId, organization_id: organizationId, owner_id: ownerId }, progress);
  }

  public recordUserRegistration(organizationId: string, registrationType: string) {
    this.userRegistrations.inc({ organization_id: organizationId, registration_type: registrationType });
  }

  public updateActiveUsers(timePeriod: string, organizationId: string, count: number) {
    this.activeUsers.set({ time_period: timePeriod, organization_id: organizationId }, count);
  }

  public recordOrganizationCreation(planType: string) {
    this.organizationCreations.inc({ plan_type: planType });
  }

  public recordDatabaseQuery(queryType: string, table: string, duration: number) {
    this.databaseQueryDuration.observe({ query_type: queryType, table }, duration);
  }

  public recordDatabaseError(errorType: string, table: string) {
    this.databaseErrors.inc({ error_type: errorType, table });
  }

  public recordRedisOperation(operation: string, status: string, duration: number) {
    this.redisOperations.inc({ operation, status });
    this.redisOperationDuration.observe({ operation }, duration);
  }

  public recordWebSocketConnection(namespace: string, organizationId: string, delta: number) {
    this.websocketConnections.inc({ namespace, organization_id: organizationId }, delta);
  }

  public recordWebSocketMessage(namespace: string, eventType: string, direction: 'in' | 'out') {
    this.websocketMessages.inc({ namespace, event_type: eventType, direction });
  }

  public recordError(type: string, service: string, severity: 'low' | 'medium' | 'high' | 'critical') {
    this.errors.inc({ type, service, severity });
  }

  public recordUnhandledError(type: string) {
    this.unhandledErrors.inc({ type });
  }

  // Get metrics for Prometheus scraping
  public async getMetrics(): Promise<string> {
    return await client.register.metrics();
  }

  public getContentType(): string {
    return client.register.contentType;
  }

  // Clear all metrics (useful for testing)
  public clearMetrics(): void {
    client.register.clear();
  }
}

export default MetricsService.getInstance();