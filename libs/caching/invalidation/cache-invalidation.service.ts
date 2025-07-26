import { Injectable, Logger } from '@nestjs/common';
import { RedisCacheService } from '../redis/cache-service';
import { RedisConnectionManager } from '../redis/connection';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';

export interface InvalidationRule {
  id: string;
  name: string;
  enabled: boolean;
  triggers: InvalidationTrigger[];
  targets: InvalidationTarget[];
  conditions?: InvalidationCondition[];
  delay?: number; // Delay in milliseconds
  batch?: boolean; // Batch multiple invalidations
}

export interface InvalidationTrigger {
  type: 'event' | 'webhook' | 'schedule' | 'database' | 'api';
  source: string;
  pattern?: string;
  debounce?: number;
}

export interface InvalidationTarget {
  type: 'key' | 'pattern' | 'tag' | 'prefix';
  value: string;
  cascade?: boolean; // Invalidate dependent caches
}

export interface InvalidationCondition {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'regex';
  value: any;
}

export interface InvalidationEvent {
  id: string;
  ruleId: string;
  trigger: string;
  targets: string[];
  timestamp: number;
  success: boolean;
  error?: string;
  affectedKeys: number;
}

@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);
  private readonly subscriber: Redis;
  private readonly publisher: Redis;
  private rules: Map<string, InvalidationRule> = new Map();
  private pendingInvalidations: Map<string, NodeJS.Timeout> = new Map();
  private batchedInvalidations: Map<string, Set<string>> = new Map();
  private eventHistory: InvalidationEvent[] = [];

  constructor(
    private cacheService: RedisCacheService,
    private connectionManager: RedisConnectionManager,
    private eventEmitter: EventEmitter2
  ) {
    this.subscriber = connectionManager.getSubscriber();
    this.publisher = connectionManager.getPublisher();
    this.initializeInvalidationListeners();
  }

  async addInvalidationRule(rule: InvalidationRule): Promise<void> {
    this.rules.set(rule.id, rule);
    
    // Persist rule to cache
    await this.cacheService.set(`invalidation:rule:${rule.id}`, rule, {
      ttl: 86400 * 30, // 30 days
      prefix: 'system'
    });

    // Set up event listeners for this rule
    this.setupRuleListeners(rule);

    this.logger.log(`Added invalidation rule: ${rule.name} (${rule.id})`);
  }

  async removeInvalidationRule(ruleId: string): Promise<boolean> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    this.rules.delete(ruleId);
    
    // Remove from cache
    await this.cacheService.del(`invalidation:rule:${ruleId}`, 'system');

    // Clean up any pending invalidations for this rule
    this.cleanupRulePendingInvalidations(ruleId);

    this.logger.log(`Removed invalidation rule: ${rule.name} (${ruleId})`);
    return true;
  }

  async triggerInvalidation(
    source: string,
    data: any,
    immediate = false
  ): Promise<InvalidationEvent[]> {
    const matchingRules = this.findMatchingRules(source, data);
    const events: InvalidationEvent[] = [];

    for (const rule of matchingRules) {
      if (!rule.enabled) {
        continue;
      }

      // Check conditions
      if (rule.conditions && !this.evaluateConditions(rule.conditions, data)) {
        continue;
      }

      const event = await this.executeInvalidation(rule, source, data, immediate);
      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  async invalidateByEvent(eventName: string, payload: any): Promise<void> {
    this.logger.debug(`Processing invalidation event: ${eventName}`);
    
    const events = await this.triggerInvalidation(`event:${eventName}`, payload);
    
    // Emit results for monitoring
    events.forEach(event => {
      this.eventEmitter.emit('cache.invalidation.completed', event);
    });
  }

  async invalidateByWebhook(
    webhookId: string, 
    payload: any
  ): Promise<InvalidationEvent[]> {
    this.logger.debug(`Processing webhook invalidation: ${webhookId}`);
    
    return await this.triggerInvalidation(`webhook:${webhookId}`, payload);
  }

  async invalidateByDatabaseChange(
    table: string,
    operation: 'insert' | 'update' | 'delete',
    recordId: string,
    changes?: Record<string, any>
  ): Promise<InvalidationEvent[]> {
    const source = `database:${table}:${operation}`;
    const data = {
      table,
      operation,
      recordId,
      changes,
      timestamp: Date.now()
    };

    return await this.triggerInvalidation(source, data);
  }

  async invalidateUserCache(userId: string): Promise<number> {
    try {
      const targets = [
        `user:${userId}:*`,
        `session:user_sessions:${userId}`,
        `profile:${userId}`,
        `preferences:${userId}`,
      ];

      let totalInvalidated = 0;

      for (const pattern of targets) {
        const count = await this.cacheService.invalidateByPattern(pattern);
        totalInvalidated += count;
      }

      // Also invalidate by tag
      const tagCount = await this.cacheService.invalidateByTag(`user:${userId}`);
      totalInvalidated += tagCount;

      this.logger.log(`Invalidated ${totalInvalidated} cache entries for user ${userId}`);
      
      // Publish invalidation event
      await this.publisher.publish('cache:user_invalidation', JSON.stringify({
        userId,
        count: totalInvalidated,
        timestamp: Date.now()
      }));

      return totalInvalidated;
    } catch (error) {
      this.logger.error(`Error invalidating user cache for ${userId}:`, error);
      return 0;
    }
  }

  async invalidateResourceCache(
    resourceType: string,
    resourceId: string
  ): Promise<number> {
    try {
      const patterns = [
        `${resourceType}:${resourceId}`,
        `${resourceType}:${resourceId}:*`,
        `api:*${resourceType}*${resourceId}*`,
      ];

      let totalInvalidated = 0;

      for (const pattern of patterns) {
        const count = await this.cacheService.invalidateByPattern(pattern);
        totalInvalidated += count;
      }

      // Invalidate by tags
      const tags = [
        `${resourceType}:${resourceId}`,
        resourceType,
        `type:${resourceType}`
      ];

      for (const tag of tags) {
        const count = await this.cacheService.invalidateByTag(tag);
        totalInvalidated += count;
      }

      this.logger.log(
        `Invalidated ${totalInvalidated} cache entries for ${resourceType}:${resourceId}`
      );

      return totalInvalidated;
    } catch (error) {
      this.logger.error(
        `Error invalidating resource cache for ${resourceType}:${resourceId}:`, 
        error
      );
      return 0;
    }
  }

  async batchInvalidate(
    invalidations: Array<{
      type: 'key' | 'pattern' | 'tag';
      value: string;
    }>
  ): Promise<number> {
    try {
      let totalInvalidated = 0;

      const pipeline = this.connectionManager.getRedis().pipeline();

      // Group invalidations by type for efficiency
      const keyInvalidations = invalidations.filter(inv => inv.type === 'key');
      const patternInvalidations = invalidations.filter(inv => inv.type === 'pattern');
      const tagInvalidations = invalidations.filter(inv => inv.type === 'tag');

      // Handle key invalidations
      if (keyInvalidations.length > 0) {
        const keys = keyInvalidations.map(inv => `cache:${inv.value}`);
        pipeline.del(...keys);
        totalInvalidated += keys.length;
      }

      // Execute pipeline
      await pipeline.exec();

      // Handle pattern invalidations (these can't be pipelined easily)
      for (const inv of patternInvalidations) {
        const count = await this.cacheService.invalidateByPattern(inv.value);
        totalInvalidated += count;
      }

      // Handle tag invalidations
      for (const inv of tagInvalidations) {
        const count = await this.cacheService.invalidateByTag(inv.value);
        totalInvalidated += count;
      }

      this.logger.log(`Batch invalidated ${totalInvalidated} cache entries`);
      return totalInvalidated;
    } catch (error) {
      this.logger.error('Error in batch invalidation:', error);
      return 0;
    }
  }

  async scheduleInvalidation(
    ruleId: string,
    delay: number,
    targets: InvalidationTarget[]
  ): Promise<void> {
    const scheduledId = `${ruleId}-${Date.now()}`;
    
    const timeout = setTimeout(async () => {
      try {
        await this.executeTargetInvalidations(targets);
        this.pendingInvalidations.delete(scheduledId);
        
        this.logger.debug(`Executed scheduled invalidation: ${scheduledId}`);
      } catch (error) {
        this.logger.error(`Error in scheduled invalidation ${scheduledId}:`, error);
      }
    }, delay);

    this.pendingInvalidations.set(scheduledId, timeout);
    
    this.logger.debug(`Scheduled invalidation ${scheduledId} in ${delay}ms`);
  }

  getInvalidationStats(): {
    totalRules: number;
    activeRules: number;
    pendingInvalidations: number;
    recentEvents: InvalidationEvent[];
  } {
    const activeRules = Array.from(this.rules.values()).filter(rule => rule.enabled).length;
    
    return {
      totalRules: this.rules.size,
      activeRules,
      pendingInvalidations: this.pendingInvalidations.size,
      recentEvents: this.eventHistory.slice(-10)
    };
  }

  private async initializeInvalidationListeners(): Promise<void> {
    try {
      // Subscribe to invalidation events
      await this.subscriber.subscribe([
        'cache:invalidation',
        'cache:user_invalidation',
        'database:changes',
        'api:mutations'
      ]);

      this.subscriber.on('message', async (channel, message) => {
        try {
          const data = JSON.parse(message);
          await this.handleInvalidationMessage(channel, data);
        } catch (error) {
          this.logger.error(`Error processing invalidation message from ${channel}:`, error);
        }
      });

      this.logger.log('Cache invalidation listeners initialized');
    } catch (error) {
      this.logger.error('Error initializing invalidation listeners:', error);
    }
  }

  private async handleInvalidationMessage(channel: string, data: any): Promise<void> {
    switch (channel) {
      case 'database:changes':
        await this.invalidateByDatabaseChange(
          data.table,
          data.operation,
          data.recordId,
          data.changes
        );
        break;
      
      case 'api:mutations':
        await this.triggerInvalidation(`api:mutation`, data);
        break;
      
      default:
        this.logger.debug(`Received invalidation message on ${channel}:`, data);
    }
  }

  private findMatchingRules(source: string, data: any): InvalidationRule[] {
    return Array.from(this.rules.values()).filter(rule => {
      return rule.triggers.some(trigger => {
        if (trigger.type === 'event' && source.startsWith('event:')) {
          const eventName = source.substring(6);
          return trigger.source === eventName || 
                 (trigger.pattern && new RegExp(trigger.pattern).test(eventName));
        }
        
        if (trigger.type === 'webhook' && source.startsWith('webhook:')) {
          const webhookId = source.substring(8);
          return trigger.source === webhookId;
        }
        
        if (trigger.type === 'database' && source.startsWith('database:')) {
          return source.includes(trigger.source);
        }
        
        if (trigger.type === 'api' && source.startsWith('api:')) {
          return source.includes(trigger.source);
        }
        
        return false;
      });
    });
  }

  private evaluateConditions(conditions: InvalidationCondition[], data: any): boolean {
    return conditions.every(condition => {
      const fieldValue = this.getNestedValue(data, condition.field);
      
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'contains':
          return String(fieldValue).includes(String(condition.value));
        case 'startsWith':
          return String(fieldValue).startsWith(String(condition.value));
        case 'regex':
          return new RegExp(condition.value).test(String(fieldValue));
        default:
          return false;
      }
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async executeInvalidation(
    rule: InvalidationRule,
    source: string,
    data: any,
    immediate: boolean
  ): Promise<InvalidationEvent | null> {
    const eventId = `${rule.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      if (rule.delay && rule.delay > 0 && !immediate) {
        // Schedule delayed invalidation
        await this.scheduleInvalidation(rule.id, rule.delay, rule.targets);
        
        const event: InvalidationEvent = {
          id: eventId,
          ruleId: rule.id,
          trigger: source,
          targets: rule.targets.map(t => t.value),
          timestamp: Date.now(),
          success: true,
          affectedKeys: 0 // Will be updated when executed
        };
        
        this.addEventToHistory(event);
        return event;
      }

      // Execute immediate invalidation
      const affectedKeys = await this.executeTargetInvalidations(rule.targets);
      
      const event: InvalidationEvent = {
        id: eventId,
        ruleId: rule.id,
        trigger: source,
        targets: rule.targets.map(t => t.value),
        timestamp: Date.now(),
        success: true,
        affectedKeys
      };

      this.addEventToHistory(event);
      
      this.logger.debug(
        `Executed invalidation rule ${rule.name}: ${affectedKeys} keys affected`
      );

      return event;
    } catch (error) {
      const event: InvalidationEvent = {
        id: eventId,
        ruleId: rule.id,
        trigger: source,
        targets: rule.targets.map(t => t.value),
        timestamp: Date.now(),
        success: false,
        error: error.message,
        affectedKeys: 0
      };

      this.addEventToHistory(event);
      this.logger.error(`Error executing invalidation rule ${rule.name}:`, error);
      
      return event;
    }
  }

  private async executeTargetInvalidations(targets: InvalidationTarget[]): Promise<number> {
    let totalAffected = 0;

    for (const target of targets) {
      let count = 0;

      switch (target.type) {
        case 'key':
          const success = await this.cacheService.del(target.value);
          count = success ? 1 : 0;
          break;
          
        case 'pattern':
          count = await this.cacheService.invalidateByPattern(target.value);
          break;
          
        case 'tag':
          count = await this.cacheService.invalidateByTag(target.value);
          break;
          
        case 'prefix':
          count = await this.cacheService.invalidateByPattern(`${target.value}*`);
          break;
      }

      totalAffected += count;

      // Handle cascade invalidation
      if (target.cascade && count > 0) {
        // Implement cascade logic based on your cache dependency graph
        const cascadeCount = await this.handleCascadeInvalidation(target.value);
        totalAffected += cascadeCount;
      }
    }

    return totalAffected;
  }

  private async handleCascadeInvalidation(targetValue: string): Promise<number> {
    // Implement cascade invalidation logic
    // This could involve invalidating related caches based on dependencies
    return 0;
  }

  private setupRuleListeners(rule: InvalidationRule): void {
    rule.triggers.forEach(trigger => {
      if (trigger.type === 'event') {
        this.eventEmitter.on(trigger.source, async (data) => {
          if (trigger.debounce && trigger.debounce > 0) {
            this.debounceInvalidation(rule.id, trigger.debounce, () => {
              this.invalidateByEvent(trigger.source, data);
            });
          } else {
            await this.invalidateByEvent(trigger.source, data);
          }
        });
      }
    });
  }

  private debounceInvalidation(
    ruleId: string, 
    delay: number, 
    callback: () => void
  ): void {
    const key = `debounce:${ruleId}`;
    
    if (this.pendingInvalidations.has(key)) {
      clearTimeout(this.pendingInvalidations.get(key)!);
    }

    const timeout = setTimeout(() => {
      callback();
      this.pendingInvalidations.delete(key);
    }, delay);

    this.pendingInvalidations.set(key, timeout);
  }

  private cleanupRulePendingInvalidations(ruleId: string): void {
    const toRemove: string[] = [];
    
    this.pendingInvalidations.forEach((timeout, key) => {
      if (key.includes(ruleId)) {
        clearTimeout(timeout);
        toRemove.push(key);
      }
    });

    toRemove.forEach(key => this.pendingInvalidations.delete(key));
  }

  private addEventToHistory(event: InvalidationEvent): void {
    this.eventHistory.push(event);
    
    // Keep only last 100 events
    if (this.eventHistory.length > 100) {
      this.eventHistory = this.eventHistory.slice(-100);
    }
  }
}