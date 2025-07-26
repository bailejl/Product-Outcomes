import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisCacheService } from '../redis/cache-service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface WarmupStrategy {
  name: string;
  enabled: boolean;
  schedule: string;
  priority: 'low' | 'medium' | 'high';
  concurrent: boolean;
  timeout: number;
}

export interface WarmupTask {
  id: string;
  type: 'api' | 'graphql' | 'computation' | 'database';
  target: string;
  params?: Record<string, any>;
  dependencies?: string[];
  estimatedDuration: number;
  lastRun?: number;
  successCount: number;
  errorCount: number;
}

export interface WarmupMetrics {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  averageDuration: number;
  cacheHitImprovement: number;
}

@Injectable()
export class CacheWarmingService implements OnModuleInit {
  private readonly logger = new Logger(CacheWarmingService.name);
  private warmupTasks: Map<string, WarmupTask> = new Map();
  private isWarming = false;
  private metrics: WarmupMetrics = {
    totalTasks: 0,
    successfulTasks: 0,
    failedTasks: 0,
    averageDuration: 0,
    cacheHitImprovement: 0
  };

  constructor(
    private cacheService: RedisCacheService,
    private httpService: HttpService
  ) {}

  async onModuleInit() {
    await this.loadWarmupTasks();
    this.logger.log('Cache warming service initialized');
  }

  // Scheduled warmup - runs every hour
  @Cron(CronExpression.EVERY_HOUR)
  async scheduledWarmup() {
    if (this.isWarming) {
      this.logger.warn('Cache warming already in progress, skipping scheduled run');
      return;
    }

    this.logger.log('Starting scheduled cache warmup');
    await this.executeWarmupStrategy('scheduled');
  }

  // High-priority warmup - runs every 15 minutes
  @Cron('0 */15 * * * *')
  async highPriorityWarmup() {
    await this.executeWarmupStrategy('high-priority');
  }

  // Daily comprehensive warmup
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async dailyWarmup() {
    this.logger.log('Starting daily comprehensive cache warmup');
    await this.executeWarmupStrategy('comprehensive');
  }

  async executeWarmupStrategy(strategy: string): Promise<WarmupMetrics> {
    if (this.isWarming && strategy !== 'manual') {
      return this.metrics;
    }

    this.isWarming = true;
    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    try {
      this.logger.log(`Executing warmup strategy: ${strategy}`);

      const tasks = this.getTasksForStrategy(strategy);
      const taskGroups = this.groupTasksByPriority(tasks);

      // Execute high priority tasks first
      if (taskGroups.high.length > 0) {
        const highResults = await this.executeTasks(taskGroups.high, true);
        successCount += highResults.success;
        failCount += highResults.failed;
      }

      // Execute medium priority tasks
      if (taskGroups.medium.length > 0) {
        const mediumResults = await this.executeTasks(taskGroups.medium, true);
        successCount += mediumResults.success;
        failCount += mediumResults.failed;
      }

      // Execute low priority tasks
      if (taskGroups.low.length > 0) {
        const lowResults = await this.executeTasks(taskGroups.low, false);
        successCount += lowResults.success;
        failCount += lowResults.failed;
      }

      const duration = Date.now() - startTime;
      this.updateMetrics(successCount, failCount, duration);

      this.logger.log(
        `Warmup strategy ${strategy} completed: ${successCount} success, ${failCount} failed in ${duration}ms`
      );

      return this.metrics;
    } catch (error) {
      this.logger.error(`Error executing warmup strategy ${strategy}:`, error);
      throw error;
    } finally {
      this.isWarming = false;
    }
  }

  async addWarmupTask(task: Omit<WarmupTask, 'successCount' | 'errorCount'>): Promise<void> {
    const newTask: WarmupTask = {
      ...task,
      successCount: 0,
      errorCount: 0
    };

    this.warmupTasks.set(task.id, newTask);
    
    // Persist to cache for recovery
    await this.cacheService.set(`warmup:task:${task.id}`, newTask, {
      ttl: 86400 * 7, // 7 days
      prefix: 'system'
    });

    this.logger.debug(`Added warmup task: ${task.id}`);
  }

  async removeWarmupTask(taskId: string): Promise<boolean> {
    const removed = this.warmupTasks.delete(taskId);
    
    if (removed) {
      await this.cacheService.del(`warmup:task:${taskId}`, 'system');
      this.logger.debug(`Removed warmup task: ${taskId}`);
    }

    return removed;
  }

  async warmupSpecificCache(
    cacheKey: string,
    warmupFunction: () => Promise<any>,
    ttl?: number
  ): Promise<boolean> {
    try {
      this.logger.debug(`Warming up specific cache: ${cacheKey}`);
      
      const data = await warmupFunction();
      
      if (data !== null && data !== undefined) {
        await this.cacheService.set(cacheKey, data, {
          ttl: ttl || 3600,
          tags: ['warmed']
        });
        
        this.logger.debug(`Successfully warmed cache: ${cacheKey}`);
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Error warming cache ${cacheKey}:`, error);
      return false;
    }
  }

  async warmupApiEndpoints(endpoints: string[]): Promise<number> {
    let successCount = 0;
    
    const tasks = endpoints.map(async (endpoint) => {
      try {
        const response = await firstValueFrom(
          this.httpService.get(endpoint, {
            timeout: 10000,
            headers: {
              'X-Cache-Warmup': 'true'
            }
          })
        );
        
        if (response.status >= 200 && response.status < 300) {
          successCount++;
          this.logger.debug(`Warmed API endpoint: ${endpoint}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to warm API endpoint ${endpoint}:`, error.message);
      }
    });

    await Promise.allSettled(tasks);
    return successCount;
  }

  async warmupGraphQLQueries(queries: Array<{
    query: string;
    variables?: Record<string, any>;
    operationName?: string;
  }>): Promise<number> {
    let successCount = 0;

    const tasks = queries.map(async ({ query, variables, operationName }) => {
      try {
        const response = await firstValueFrom(
          this.httpService.post('/graphql', {
            query,
            variables,
            operationName
          }, {
            timeout: 15000,
            headers: {
              'X-Cache-Warmup': 'true',
              'Content-Type': 'application/json'
            }
          })
        );

        if (response.status === 200 && !response.data.errors) {
          successCount++;
          this.logger.debug(`Warmed GraphQL query: ${operationName || 'anonymous'}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to warm GraphQL query ${operationName}:`, error.message);
      }
    });

    await Promise.allSettled(tasks);
    return successCount;
  }

  async warmupUserSpecificData(userIds: string[]): Promise<number> {
    let successCount = 0;

    const tasks = userIds.map(async (userId) => {
      try {
        // Warm user profile
        await this.warmupSpecificCache(
          `user:profile:${userId}`,
          async () => {
            // Call user service to get profile
            const response = await firstValueFrom(
              this.httpService.get(`/api/users/${userId}/profile`, {
                timeout: 5000
              })
            );
            return response.data;
          },
          1800 // 30 minutes
        );

        // Warm user preferences
        await this.warmupSpecificCache(
          `user:preferences:${userId}`,
          async () => {
            const response = await firstValueFrom(
              this.httpService.get(`/api/users/${userId}/preferences`, {
                timeout: 5000
              })
            );
            return response.data;
          },
          3600 // 1 hour
        );

        successCount++;
      } catch (error) {
        this.logger.warn(`Failed to warm user data for ${userId}:`, error.message);
      }
    });

    await Promise.allSettled(tasks);
    return successCount;
  }

  getWarmupStatus(): {
    isRunning: boolean;
    totalTasks: number;
    metrics: WarmupMetrics;
  } {
    return {
      isRunning: this.isWarming,
      totalTasks: this.warmupTasks.size,
      metrics: this.metrics
    };
  }

  private async loadWarmupTasks(): Promise<void> {
    try {
      // Load predefined warmup tasks
      const defaultTasks: WarmupTask[] = [
        {
          id: 'popular-products',
          type: 'api',
          target: '/api/products?popular=true',
          estimatedDuration: 2000,
          successCount: 0,
          errorCount: 0
        },
        {
          id: 'user-dashboard-data',
          type: 'graphql',
          target: 'getDashboardData',
          estimatedDuration: 3000,
          successCount: 0,
          errorCount: 0
        },
        {
          id: 'category-tree',
          type: 'api',
          target: '/api/categories/tree',
          estimatedDuration: 1500,
          successCount: 0,
          errorCount: 0
        },
        {
          id: 'site-configuration',
          type: 'api',
          target: '/api/config/site',
          estimatedDuration: 500,
          successCount: 0,
          errorCount: 0
        }
      ];

      for (const task of defaultTasks) {
        this.warmupTasks.set(task.id, task);
      }

      this.logger.log(`Loaded ${defaultTasks.length} default warmup tasks`);
    } catch (error) {
      this.logger.error('Error loading warmup tasks:', error);
    }
  }

  private getTasksForStrategy(strategy: string): WarmupTask[] {
    const allTasks = Array.from(this.warmupTasks.values());

    switch (strategy) {
      case 'high-priority':
        return allTasks.filter(task => 
          task.estimatedDuration < 5000 && 
          task.errorCount < 3
        );
      
      case 'comprehensive':
        return allTasks;
      
      case 'scheduled':
      default:
        return allTasks.filter(task => 
          task.estimatedDuration < 10000 && 
          task.errorCount < 5
        );
    }
  }

  private groupTasksByPriority(tasks: WarmupTask[]): {
    high: WarmupTask[];
    medium: WarmupTask[];
    low: WarmupTask[];
  } {
    return {
      high: tasks.filter(task => task.estimatedDuration < 2000),
      medium: tasks.filter(task => 
        task.estimatedDuration >= 2000 && task.estimatedDuration < 5000
      ),
      low: tasks.filter(task => task.estimatedDuration >= 5000)
    };
  }

  private async executeTasks(
    tasks: WarmupTask[], 
    concurrent: boolean
  ): Promise<{ success: number; failed: number }> {
    let successCount = 0;
    let failedCount = 0;

    if (concurrent) {
      const results = await Promise.allSettled(
        tasks.map(task => this.executeTask(task))
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          successCount++;
          tasks[index].successCount++;
        } else {
          failedCount++;
          tasks[index].errorCount++;
        }
      });
    } else {
      for (const task of tasks) {
        try {
          const success = await this.executeTask(task);
          if (success) {
            successCount++;
            task.successCount++;
          } else {
            failedCount++;
            task.errorCount++;
          }
        } catch (error) {
          failedCount++;
          task.errorCount++;
        }
      }
    }

    return { success: successCount, failed: failedCount };
  }

  private async executeTask(task: WarmupTask): Promise<boolean> {
    const startTime = Date.now();

    try {
      let success = false;

      switch (task.type) {
        case 'api':
          success = await this.executeApiTask(task);
          break;
        case 'graphql':
          success = await this.executeGraphQLTask(task);
          break;
        case 'computation':
          success = await this.executeComputationTask(task);
          break;
        case 'database':
          success = await this.executeDatabaseTask(task);
          break;
      }

      task.lastRun = Date.now();
      const duration = task.lastRun - startTime;
      
      this.logger.debug(
        `Task ${task.id} ${success ? 'succeeded' : 'failed'} in ${duration}ms`
      );

      return success;
    } catch (error) {
      this.logger.error(`Error executing task ${task.id}:`, error);
      return false;
    }
  }

  private async executeApiTask(task: WarmupTask): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(task.target, {
          timeout: task.estimatedDuration + 5000,
          params: task.params,
          headers: {
            'X-Cache-Warmup': 'true'
          }
        })
      );
      
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      return false;
    }
  }

  private async executeGraphQLTask(task: WarmupTask): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.post('/graphql', {
          query: task.target,
          variables: task.params
        }, {
          timeout: task.estimatedDuration + 5000,
          headers: {
            'X-Cache-Warmup': 'true',
            'Content-Type': 'application/json'
          }
        })
      );
      
      return response.status === 200 && !response.data.errors;
    } catch (error) {
      return false;
    }
  }

  private async executeComputationTask(task: WarmupTask): Promise<boolean> {
    // Implement computation-based warming
    // This could involve pre-calculating expensive operations
    return true;
  }

  private async executeDatabaseTask(task: WarmupTask): Promise<boolean> {
    // Implement database query warming
    // This could involve running expensive queries and caching results
    return true;
  }

  private updateMetrics(successCount: number, failedCount: number, duration: number): void {
    this.metrics.totalTasks += successCount + failedCount;
    this.metrics.successfulTasks += successCount;
    this.metrics.failedTasks += failedCount;
    
    if (this.metrics.totalTasks > 0) {
      this.metrics.averageDuration = 
        (this.metrics.averageDuration * (this.metrics.totalTasks - successCount - failedCount) + duration) / 
        this.metrics.totalTasks;
    }

    // Calculate cache hit improvement (simplified)
    const cacheStats = this.cacheService.getStats();
    this.metrics.cacheHitImprovement = cacheStats.hitRate;
  }
}