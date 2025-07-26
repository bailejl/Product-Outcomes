import { Injectable, Logger } from '@nestjs/common';
import { RedisCacheService } from '../redis/cache-service';
import { GraphQLCacheService } from '../graphql/query-cache.service';
import { SessionCacheService } from '../session/session-cache.service';
import { CacheWarmingService } from '../warming/cache-warming.service';
import { performance } from 'perf_hooks';

export interface CacheTestConfig {
  testDuration: number; // milliseconds
  concurrentRequests: number;
  keyPrefix: string;
  dataSize: number; // bytes
  ttl: number;
  testTypes: CacheTestType[];
}

export type CacheTestType = 
  | 'basic_operations'
  | 'concurrency'
  | 'memory_pressure'
  | 'ttl_accuracy'
  | 'pattern_matching'
  | 'tag_invalidation'
  | 'graphql_cache'
  | 'session_cache'
  | 'warming_performance';

export interface CacheTestResult {
  testType: CacheTestType;
  duration: number;
  operations: number;
  success: number;
  failures: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  throughput: number; // operations per second
  memoryUsage: number;
  errors: TestError[];
  details: Record<string, any>;
}

export interface TestError {
  operation: string;
  error: string;
  timestamp: number;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  summary: {
    criticalIssues: number;
    warningIssues: number;
    infoIssues: number;
  };
}

export interface ValidationIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  details: Record<string, any>;
}

@Injectable()
export class CacheTestingService {
  private readonly logger = new Logger(CacheTestingService.name);
  
  constructor(
    private cacheService: RedisCacheService,
    private graphqlCacheService: GraphQLCacheService,
    private sessionCacheService: SessionCacheService,
    private warmingService: CacheWarmingService
  ) {}

  async runCompleteTestSuite(config?: Partial<CacheTestConfig>): Promise<{
    results: CacheTestResult[];
    summary: {
      totalTests: number;
      passed: number;
      failed: number;
      duration: number;
      overallThroughput: number;
    };
    validation: ValidationResult;
  }> {
    const testConfig: CacheTestConfig = {
      testDuration: 30000, // 30 seconds
      concurrentRequests: 50,
      keyPrefix: 'test',
      dataSize: 1024, // 1KB
      ttl: 300, // 5 minutes
      testTypes: [
        'basic_operations',
        'concurrency', 
        'memory_pressure',
        'ttl_accuracy',
        'pattern_matching',
        'tag_invalidation',
        'graphql_cache',
        'session_cache',
        'warming_performance'
      ],
      ...config
    };

    this.logger.log('Starting complete cache test suite');
    const startTime = performance.now();
    const results: CacheTestResult[] = [];

    // Run all tests
    for (const testType of testConfig.testTypes) {
      try {
        this.logger.log(`Running test: ${testType}`);
        const result = await this.runSingleTest(testType, testConfig);
        results.push(result);
      } catch (error) {
        this.logger.error(`Test ${testType} failed:`, error);
        results.push({
          testType,
          duration: 0,
          operations: 0,
          success: 0,
          failures: 1,
          averageResponseTime: 0,
          minResponseTime: 0,
          maxResponseTime: 0,
          throughput: 0,
          memoryUsage: 0,
          errors: [{ operation: 'test_setup', error: error.message, timestamp: Date.now() }],
          details: {}
        });
      }
    }

    const endTime = performance.now();
    const totalDuration = endTime - startTime;

    // Calculate summary
    const summary = {
      totalTests: results.length,
      passed: results.filter(r => r.failures === 0).length,
      failed: results.filter(r => r.failures > 0).length,
      duration: totalDuration,
      overallThroughput: results.reduce((sum, r) => sum + r.throughput, 0) / results.length
    };

    // Run validation
    const validation = await this.validateCacheConfiguration();

    this.logger.log(`Test suite completed: ${summary.passed}/${summary.totalTests} passed`);

    return { results, summary, validation };
  }

  async runSingleTest(testType: CacheTestType, config: CacheTestConfig): Promise<CacheTestResult> {
    const startTime = performance.now();
    let operations = 0;
    let success = 0;
    let failures = 0;
    const responseTimes: number[] = [];
    const errors: TestError[] = [];
    const startMemory = process.memoryUsage().heapUsed;

    try {
      switch (testType) {
        case 'basic_operations':
          ({ operations, success, failures, responseTimes } = await this.testBasicOperations(config, errors));
          break;
        case 'concurrency':
          ({ operations, success, failures, responseTimes } = await this.testConcurrency(config, errors));
          break;
        case 'memory_pressure':
          ({ operations, success, failures, responseTimes } = await this.testMemoryPressure(config, errors));
          break;
        case 'ttl_accuracy':
          ({ operations, success, failures, responseTimes } = await this.testTTLAccuracy(config, errors));
          break;
        case 'pattern_matching':
          ({ operations, success, failures, responseTimes } = await this.testPatternMatching(config, errors));
          break;
        case 'tag_invalidation':
          ({ operations, success, failures, responseTimes } = await this.testTagInvalidation(config, errors));
          break;
        case 'graphql_cache':
          ({ operations, success, failures, responseTimes } = await this.testGraphQLCache(config, errors));
          break;
        case 'session_cache':
          ({ operations, success, failures, responseTimes } = await this.testSessionCache(config, errors));
          break;
        case 'warming_performance':
          ({ operations, success, failures, responseTimes } = await this.testWarmingPerformance(config, errors));
          break;
      }
    } catch (error) {
      failures++;
      errors.push({
        operation: testType,
        error: error.message,
        timestamp: Date.now()
      });
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const endMemory = process.memoryUsage().heapUsed;

    return {
      testType,
      duration,
      operations,
      success,
      failures,
      averageResponseTime: responseTimes.length > 0 ? 
        responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0,
      minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
      maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
      throughput: duration > 0 ? (operations / duration) * 1000 : 0,
      memoryUsage: endMemory - startMemory,
      errors,
      details: {}
    };
  }

  private async testBasicOperations(
    config: CacheTestConfig, 
    errors: TestError[]
  ): Promise<{ operations: number; success: number; failures: number; responseTimes: number[] }> {
    let operations = 0;
    let success = 0;
    let failures = 0;
    const responseTimes: number[] = [];
    const testData = 'x'.repeat(config.dataSize);

    const endTime = Date.now() + config.testDuration;

    while (Date.now() < endTime) {
      const key = `${config.keyPrefix}:basic:${operations}`;
      
      try {
        // Test SET operation
        const setStart = performance.now();
        const setResult = await this.cacheService.set(key, testData, { ttl: config.ttl });
        const setEnd = performance.now();
        responseTimes.push(setEnd - setStart);
        operations++;
        
        if (setResult) {
          success++;
        } else {
          failures++;
        }

        // Test GET operation
        const getStart = performance.now();
        const getValue = await this.cacheService.get(key);
        const getEnd = performance.now();
        responseTimes.push(getEnd - getStart);
        operations++;
        
        if (getValue === testData) {
          success++;
        } else {
          failures++;
          errors.push({
            operation: 'get',
            error: 'Retrieved value does not match stored value',
            timestamp: Date.now()
          });
        }

        // Test DELETE operation
        const delStart = performance.now();
        const delResult = await this.cacheService.del(key);
        const delEnd = performance.now();
        responseTimes.push(delEnd - delStart);
        operations++;
        
        if (delResult) {
          success++;
        } else {
          failures++;
        }

      } catch (error) {
        failures++;
        errors.push({
          operation: 'basic_operations',
          error: error.message,
          timestamp: Date.now()
        });
      }
    }

    return { operations, success, failures, responseTimes };
  }

  private async testConcurrency(
    config: CacheTestConfig,
    errors: TestError[]
  ): Promise<{ operations: number; success: number; failures: number; responseTimes: number[] }> {
    const promises: Promise<any>[] = [];
    const responseTimes: number[] = [];
    let totalOperations = 0;
    let totalSuccess = 0;
    let totalFailures = 0;

    // Create concurrent operations
    for (let i = 0; i < config.concurrentRequests; i++) {
      const promise = this.runConcurrentWorker(i, config, errors).then(result => {
        responseTimes.push(...result.responseTimes);
        totalOperations += result.operations;
        totalSuccess += result.success;
        totalFailures += result.failures;
      });
      promises.push(promise);
    }

    await Promise.all(promises);

    return {
      operations: totalOperations,
      success: totalSuccess,
      failures: totalFailures,
      responseTimes
    };
  }

  private async runConcurrentWorker(
    workerId: number,
    config: CacheTestConfig,
    errors: TestError[]
  ): Promise<{ operations: number; success: number; failures: number; responseTimes: number[] }> {
    let operations = 0;
    let success = 0;
    let failures = 0;
    const responseTimes: number[] = [];
    const testData = `worker-${workerId}-data-${'x'.repeat(config.dataSize)}`;

    const endTime = Date.now() + config.testDuration;

    while (Date.now() < endTime) {
      const key = `${config.keyPrefix}:concurrent:${workerId}:${operations}`;
      
      try {
        const start = performance.now();
        await this.cacheService.set(key, testData, { ttl: config.ttl });
        const retrieved = await this.cacheService.get(key);
        const end = performance.now();
        
        responseTimes.push(end - start);
        operations++;
        
        if (retrieved === testData) {
          success++;
        } else {
          failures++;
        }
      } catch (error) {
        failures++;
        errors.push({
          operation: `concurrent_worker_${workerId}`,
          error: error.message,
          timestamp: Date.now()
        });
      }
    }

    return { operations, success, failures, responseTimes };
  }

  private async testMemoryPressure(
    config: CacheTestConfig,
    errors: TestError[]
  ): Promise<{ operations: number; success: number; failures: number; responseTimes: number[] }> {
    let operations = 0;
    let success = 0;
    let failures = 0;
    const responseTimes: number[] = [];
    
    // Create large data to pressure memory
    const largeData = 'x'.repeat(config.dataSize * 100); // 100x larger data
    const keys: string[] = [];

    try {
      // Fill cache with large objects
      for (let i = 0; i < 1000; i++) {
        const key = `${config.keyPrefix}:memory:${i}`;
        keys.push(key);
        
        const start = performance.now();
        const result = await this.cacheService.set(key, largeData, { ttl: config.ttl });
        const end = performance.now();
        
        responseTimes.push(end - start);
        operations++;
        
        if (result) {
          success++;
        } else {
          failures++;
        }
      }

      // Test access patterns under memory pressure
      for (const key of keys) {
        const start = performance.now();
        const value = await this.cacheService.get(key);
        const end = performance.now();
        
        responseTimes.push(end - start);
        operations++;
        
        if (value === largeData) {
          success++;
        } else {
          failures++;
        }
      }

    } catch (error) {
      failures++;
      errors.push({
        operation: 'memory_pressure',
        error: error.message,
        timestamp: Date.now()
      });
    } finally {
      // Cleanup
      for (const key of keys) {
        try {
          await this.cacheService.del(key);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }

    return { operations, success, failures, responseTimes };
  }

  private async testTTLAccuracy(
    config: CacheTestConfig,
    errors: TestError[]
  ): Promise<{ operations: number; success: number; failures: number; responseTimes: number[] }> {
    let operations = 0;
    let success = 0;
    let failures = 0;
    const responseTimes: number[] = [];
    const testData = 'ttl-test-data';

    try {
      // Test short TTL (2 seconds)
      const shortTtlKey = `${config.keyPrefix}:ttl:short`;
      const start = performance.now();
      
      await this.cacheService.set(shortTtlKey, testData, { ttl: 2 });
      operations++;
      
      // Should exist immediately
      const immediate = await this.cacheService.get(shortTtlKey);
      operations++;
      if (immediate === testData) {
        success++;
      } else {
        failures++;
        errors.push({
          operation: 'ttl_immediate',
          error: 'Key not found immediately after setting',
          timestamp: Date.now()
        });
      }
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Should not exist after TTL
      const expired = await this.cacheService.get(shortTtlKey);
      operations++;
      if (expired === null) {
        success++;
      } else {
        failures++;
        errors.push({
          operation: 'ttl_expiration',
          error: 'Key still exists after TTL expiration',
          timestamp: Date.now()
        });
      }

      const end = performance.now();
      responseTimes.push(end - start);

    } catch (error) {
      failures++;
      errors.push({
        operation: 'ttl_accuracy',
        error: error.message,
        timestamp: Date.now()
      });
    }

    return { operations, success, failures, responseTimes };
  }

  private async testPatternMatching(
    config: CacheTestConfig,
    errors: TestError[]
  ): Promise<{ operations: number; success: number; failures: number; responseTimes: number[] }> {
    let operations = 0;
    let success = 0;
    let failures = 0;
    const responseTimes: number[] = [];
    const testData = 'pattern-test-data';

    try {
      // Set up test keys with patterns
      const patterns = ['user:123', 'user:456', 'product:789', 'product:101'];
      
      for (const pattern of patterns) {
        const key = `${config.keyPrefix}:pattern:${pattern}`;
        await this.cacheService.set(key, testData, { ttl: config.ttl });
        operations++;
      }

      // Test pattern invalidation
      const start = performance.now();
      const invalidatedCount = await this.cacheService.invalidateByPattern(
        `cache:${config.keyPrefix}:pattern:user:*`
      );
      const end = performance.now();
      
      responseTimes.push(end - start);
      operations++;
      
      if (invalidatedCount === 2) { // Should invalidate 2 user keys
        success++;
      } else {
        failures++;
        errors.push({
          operation: 'pattern_invalidation',
          error: `Expected to invalidate 2 keys, but invalidated ${invalidatedCount}`,
          timestamp: Date.now()
        });
      }

      // Verify pattern invalidation worked
      const userKey1 = await this.cacheService.get(`${config.keyPrefix}:pattern:user:123`);
      const userKey2 = await this.cacheService.get(`${config.keyPrefix}:pattern:user:456`);
      const productKey1 = await this.cacheService.get(`${config.keyPrefix}:pattern:product:789`);
      
      operations += 3;
      
      if (userKey1 === null && userKey2 === null && productKey1 === testData) {
        success += 3;
      } else {
        failures++;
        errors.push({
          operation: 'pattern_verification',
          error: 'Pattern invalidation did not work as expected',
          timestamp: Date.now()
        });
      }

    } catch (error) {
      failures++;
      errors.push({
        operation: 'pattern_matching',
        error: error.message,
        timestamp: Date.now()
      });
    }

    return { operations, success, failures, responseTimes };
  }

  private async testTagInvalidation(
    config: CacheTestConfig,
    errors: TestError[]
  ): Promise<{ operations: number; success: number; failures: number; responseTimes: number[] }> {
    let operations = 0;
    let success = 0;
    let failures = 0;
    const responseTimes: number[] = [];
    const testData = 'tag-test-data';

    try {
      // Set up test keys with tags
      const keys = [
        { key: `${config.keyPrefix}:tag:1`, tags: ['user:123', 'posts'] },
        { key: `${config.keyPrefix}:tag:2`, tags: ['user:123', 'comments'] },
        { key: `${config.keyPrefix}:tag:3`, tags: ['user:456', 'posts'] }
      ];
      
      for (const { key, tags } of keys) {
        await this.cacheService.set(key, testData, { ttl: config.ttl, tags });
        operations++;
      }

      // Test tag invalidation
      const start = performance.now();
      const invalidatedCount = await this.cacheService.invalidateByTag('user:123');
      const end = performance.now();
      
      responseTimes.push(end - start);
      operations++;
      
      if (invalidatedCount === 2) { // Should invalidate 2 keys with user:123 tag
        success++;
      } else {
        failures++;
        errors.push({
          operation: 'tag_invalidation_count',
          error: `Expected to invalidate 2 keys, but invalidated ${invalidatedCount}`,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      failures++;
      errors.push({
        operation: 'tag_invalidation',
        error: error.message,
        timestamp: Date.now()
      });
    }

    return { operations, success, failures, responseTimes };
  }

  private async testGraphQLCache(
    config: CacheTestConfig,
    errors: TestError[]
  ): Promise<{ operations: number; success: number; failures: number; responseTimes: number[] }> {
    let operations = 0;
    let success = 0;
    let failures = 0;
    const responseTimes: number[] = [];

    try {
      const query = `
        query GetUser($id: ID!) {
          user(id: $id) {
            id
            name
            email
          }
        }
      `;
      
      const variables = { id: '123' };
      const result = { data: { user: { id: '123', name: 'Test User', email: 'test@example.com' } } };

      // Test cache set
      const start = performance.now();
      const cacheKey = { query, variables };
      const setSuccess = await this.graphqlCacheService.setCachedQuery(cacheKey, result);
      const setEnd = performance.now();
      
      responseTimes.push(setEnd - start);
      operations++;
      
      if (setSuccess) {
        success++;
      } else {
        failures++;
      }

      // Test cache get
      const getStart = performance.now();
      const cachedResult = await this.graphqlCacheService.getCachedQuery(cacheKey);
      const getEnd = performance.now();
      
      responseTimes.push(getEnd - getStart);
      operations++;
      
      if (cachedResult && JSON.stringify(cachedResult.data) === JSON.stringify(result.data)) {
        success++;
      } else {
        failures++;
        errors.push({
          operation: 'graphql_cache_get',
          error: 'Cached GraphQL result does not match expected',
          timestamp: Date.now()
        });
      }

    } catch (error) {
      failures++;
      errors.push({
        operation: 'graphql_cache',
        error: error.message,
        timestamp: Date.now()
      });
    }

    return { operations, success, failures, responseTimes };
  }

  private async testSessionCache(
    config: CacheTestConfig,
    errors: TestError[]
  ): Promise<{ operations: number; success: number; failures: number; responseTimes: number[] }> {
    let operations = 0;
    let success = 0;
    let failures = 0;
    const responseTimes: number[] = [];

    try {
      const sessionData = {
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['read'],
        metadata: { theme: 'dark' }
      };

      // Test session creation
      const start = performance.now();
      const sessionId = await this.sessionCacheService.createSession('test-user-123', sessionData);
      const createEnd = performance.now();
      
      responseTimes.push(createEnd - start);
      operations++;
      
      if (sessionId) {
        success++;
      } else {
        failures++;
      }

      // Test session retrieval
      const getStart = performance.now();
      const retrievedSession = await this.sessionCacheService.getSession(sessionId);
      const getEnd = performance.now();
      
      responseTimes.push(getEnd - getStart);
      operations++;
      
      if (retrievedSession && retrievedSession.userId === 'test-user-123') {
        success++;
      } else {
        failures++;
        errors.push({
          operation: 'session_retrieval',
          error: 'Retrieved session does not match expected',
          timestamp: Date.now()
        });
      }

      // Test session destruction
      const delStart = performance.now();
      const destroyed = await this.sessionCacheService.destroySession(sessionId);
      const delEnd = performance.now();
      
      responseTimes.push(delEnd - delStart);
      operations++;
      
      if (destroyed) {
        success++;
      } else {
        failures++;
      }

    } catch (error) {
      failures++;
      errors.push({
        operation: 'session_cache',
        error: error.message,
        timestamp: Date.now()
      });
    }

    return { operations, success, failures, responseTimes };
  }

  private async testWarmingPerformance(
    config: CacheTestConfig,
    errors: TestError[]
  ): Promise<{ operations: number; success: number; failures: number; responseTimes: number[] }> {
    let operations = 0;
    let success = 0;
    let failures = 0;
    const responseTimes: number[] = [];

    try {
      // Test cache warming execution
      const start = performance.now();
      const warmupMetrics = await this.warmingService.executeWarmupStrategy('manual');
      const end = performance.now();
      
      responseTimes.push(end - start);
      operations++;
      
      if (warmupMetrics.successfulTasks > 0) {
        success++;
      } else {
        failures++;
        errors.push({
          operation: 'warming_execution',
          error: 'No successful warmup tasks',
          timestamp: Date.now()
        });
      }

    } catch (error) {
      failures++;
      errors.push({
        operation: 'warming_performance',
        error: error.message,
        timestamp: Date.now()
      });
    }

    return { operations, success, failures, responseTimes };
  }

  async validateCacheConfiguration(): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    
    try {
      // Check Redis connection
      const isHealthy = await this.cacheService.exists('health-check');
      if (!isHealthy && isHealthy !== false) { // null means connection issue
        issues.push({
          severity: 'critical',
          category: 'connection',
          message: 'Redis connection is not healthy',
          details: {}
        });
      }

      // Check cache statistics
      const stats = this.cacheService.getStats();
      if (stats.hitRate < 50) {
        issues.push({
          severity: 'warning',
          category: 'performance',
          message: `Cache hit rate is low: ${stats.hitRate.toFixed(2)}%`,
          details: { hitRate: stats.hitRate }
        });
      }

      if (stats.averageResponseTime > 100) {
        issues.push({
          severity: 'warning',
          category: 'performance',
          message: `Average response time is high: ${stats.averageResponseTime.toFixed(2)}ms`,
          details: { responseTime: stats.averageResponseTime }
        });
      }

      // Check memory usage (would need actual implementation)
      // const memoryUsage = await this.getMemoryUsage();
      // if (memoryUsage > 80) {
      //   issues.push({
      //     severity: 'warning',
      //     category: 'memory',
      //     message: `Memory usage is high: ${memoryUsage}%`,
      //     details: { memoryUsage }
      //   });
      // }

    } catch (error) {
      issues.push({
        severity: 'critical',
        category: 'validation',
        message: 'Failed to validate cache configuration',
        details: { error: error.message }
      });
    }

    const summary = {
      criticalIssues: issues.filter(i => i.severity === 'critical').length,
      warningIssues: issues.filter(i => i.severity === 'warning').length,
      infoIssues: issues.filter(i => i.severity === 'info').length
    };

    return {
      valid: summary.criticalIssues === 0,
      issues,
      summary
    };
  }

  async generateLoadTestReport(results: CacheTestResult[]): Promise<string> {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: results.length,
        passedTests: results.filter(r => r.failures === 0).length,
        failedTests: results.filter(r => r.failures > 0).length,
        totalOperations: results.reduce((sum, r) => sum + r.operations, 0),
        totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
        averageThroughput: results.reduce((sum, r) => sum + r.throughput, 0) / results.length
      },
      testResults: results.map(result => ({
        testType: result.testType,
        status: result.failures === 0 ? 'PASSED' : 'FAILED',
        operations: result.operations,
        throughput: result.throughput,
        averageResponseTime: result.averageResponseTime,
        errorCount: result.errors.length
      })),
      recommendations: this.generatePerformanceRecommendations(results)
    };

    return JSON.stringify(report, null, 2);
  }

  private generatePerformanceRecommendations(results: CacheTestResult[]): string[] {
    const recommendations: string[] = [];
    
    const avgThroughput = results.reduce((sum, r) => sum + r.throughput, 0) / results.length;
    if (avgThroughput < 1000) {
      recommendations.push('Consider optimizing cache operations for better throughput');
    }

    const avgResponseTime = results.reduce((sum, r) => sum + r.averageResponseTime, 0) / results.length;
    if (avgResponseTime > 50) {
      recommendations.push('High response times detected - check Redis configuration and network latency');
    }

    const failedTests = results.filter(r => r.failures > 0);
    if (failedTests.length > 0) {
      recommendations.push(`${failedTests.length} tests failed - review error logs for issues`);
    }

    const memoryTests = results.filter(r => r.testType === 'memory_pressure');
    if (memoryTests.some(t => t.failures > 0)) {
      recommendations.push('Memory pressure test failed - consider implementing eviction policies');
    }

    return recommendations;
  }
}