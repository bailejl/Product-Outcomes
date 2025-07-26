// Redis Core
export { RedisConnectionManager } from './redis/connection';
export { RedisCacheService } from './redis/cache-service';

// Middleware
export { ApiCacheMiddleware, createApiCacheMiddleware } from './middleware/api-cache.middleware';

// GraphQL Caching
export { GraphQLCacheService, cacheDirective } from './graphql/query-cache.service';

// Session Management
export { SessionCacheService } from './session/session-cache.service';

// Cache Warming
export { CacheWarmingService } from './warming/cache-warming.service';

// Cache Invalidation
export { CacheInvalidationService } from './invalidation/cache-invalidation.service';

// Apollo Client Configuration
export { 
  createApolloCache, 
  optimisticResponseConfig, 
  cacheUpdateStrategies,
  cacheWarmupQueries,
  cacheEvictionRules
} from './apollo/apollo-cache.config';

// Service Worker
export { ServiceWorkerManager, useServiceWorker } from './service-worker/sw-manager';

// CDN Optimization
export { CDNOptimizationService } from './cdn/cdn-optimization.service';

// Monitoring
export { CacheMonitoringService } from './monitoring/cache-monitoring.service';

// Testing
export { CacheTestingService } from './testing/cache-testing.service';

// Types and Interfaces
export type {
  CacheConnectionConfig,
  CacheOptions,
  CacheStats
} from './redis/cache-service';

export type {
  ApiCacheConfig
} from './middleware/api-cache.middleware';

export type {
  GraphQLCacheConfig,
  QueryCacheKey,
  CachedQueryResult
} from './graphql/query-cache.service';

export type {
  SessionData,
  SessionConfig
} from './session/session-cache.service';

export type {
  WarmupStrategy,
  WarmupTask,
  WarmupMetrics
} from './warming/cache-warming.service';

export type {
  InvalidationRule,
  InvalidationTrigger,
  InvalidationTarget,
  InvalidationEvent
} from './invalidation/cache-invalidation.service';

export type {
  ServiceWorkerConfig,
  ServiceWorkerStatus,
  CacheMetrics as SWCacheMetrics
} from './service-worker/sw-manager';

export type {
  CDNConfig,
  AssetConfig,
  OptimizationResult
} from './cdn/cdn-optimization.service';

export type {
  CacheMetrics,
  CacheAlert,
  MonitoringThresholds,
  CacheTrend
} from './monitoring/cache-monitoring.service';

export type {
  CacheTestConfig,
  CacheTestResult,
  ValidationResult,
  ValidationIssue
} from './testing/cache-testing.service';

// Module Configuration
export interface CachingModuleConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  };
  api: {
    enabled: boolean;
    defaultTtl: number;
    excludeRoutes: string[];
  };
  graphql: {
    enabled: boolean;
    defaultTtl: number;
    enableIntrospection: boolean;
  };
  session: {
    enabled: boolean;
    defaultTtl: number;
    maxIdleTime: number;
  };
  warming: {
    enabled: boolean;
    scheduleEnabled: boolean;
  };
  invalidation: {
    enabled: boolean;
    enableWebhooks: boolean;
  };
  monitoring: {
    enabled: boolean;
    alertsEnabled: boolean;
  };
  serviceWorker: {
    enabled: boolean;
    scope: string;
  };
  cdn: {
    enabled: boolean;
    baseUrl: string;
    regions: string[];
  };
}