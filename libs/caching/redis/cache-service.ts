import { Injectable, Logger } from '@nestjs/common';
import { RedisConnectionManager } from './connection';
import Redis from 'ioredis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  compress?: boolean;
  serialize?: boolean;
  tags?: string[]; // For tag-based invalidation
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalOperations: number;
  averageResponseTime: number;
}

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly redis: Redis;
  private readonly publisher: Redis;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalOperations: 0,
    averageResponseTime: 0
  };
  private responseTimes: number[] = [];

  constructor(private connectionManager: RedisConnectionManager) {
    this.redis = connectionManager.getRedis();
    this.publisher = connectionManager.getPublisher();
  }

  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const startTime = Date.now();
    const fullKey = this.buildKey(key, options?.prefix);

    try {
      const cached = await this.redis.get(fullKey);
      const responseTime = Date.now() - startTime;
      this.updateStats(!!cached, responseTime);

      if (!cached) {
        this.logger.debug(`Cache miss for key: ${fullKey}`);
        return null;
      }

      this.logger.debug(`Cache hit for key: ${fullKey}`);
      
      if (options?.serialize !== false) {
        return JSON.parse(cached);
      }
      
      return cached as T;
    } catch (error) {
      this.logger.error(`Cache get error for key ${fullKey}:`, error);
      return null;
    }
  }

  async set<T>(
    key: string, 
    value: T, 
    options?: CacheOptions
  ): Promise<boolean> {
    const fullKey = this.buildKey(key, options?.prefix);
    const ttl = options?.ttl || 3600; // Default 1 hour

    try {
      let serializedValue: string;
      
      if (options?.serialize !== false) {
        serializedValue = JSON.stringify(value);
      } else {
        serializedValue = value as string;
      }

      // Compress if enabled and value is large
      if (options?.compress && serializedValue.length > 1024) {
        // Add compression logic here if needed
      }

      const result = await this.redis.setex(fullKey, ttl, serializedValue);
      
      // Store tags for invalidation
      if (options?.tags?.length) {
        await this.setTags(fullKey, options.tags, ttl);
      }

      this.logger.debug(`Cache set for key: ${fullKey} with TTL: ${ttl}s`);
      return result === 'OK';
    } catch (error) {
      this.logger.error(`Cache set error for key ${fullKey}:`, error);
      return false;
    }
  }

  async del(key: string, prefix?: string): Promise<boolean> {
    const fullKey = this.buildKey(key, prefix);
    
    try {
      const result = await this.redis.del(fullKey);
      
      // Clean up tags
      await this.cleanupTags(fullKey);
      
      this.logger.debug(`Cache deleted for key: ${fullKey}`);
      return result > 0;
    } catch (error) {
      this.logger.error(`Cache delete error for key ${fullKey}:`, error);
      return false;
    }
  }

  async mget<T>(keys: string[], prefix?: string): Promise<(T | null)[]> {
    const fullKeys = keys.map(key => this.buildKey(key, prefix));
    
    try {
      const results = await this.redis.mget(...fullKeys);
      
      return results.map((result, index) => {
        this.updateStats(!!result, 0);
        
        if (!result) {
          this.logger.debug(`Cache miss for key: ${fullKeys[index]}`);
          return null;
        }
        
        this.logger.debug(`Cache hit for key: ${fullKeys[index]}`);
        return JSON.parse(result);
      });
    } catch (error) {
      this.logger.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  async mset<T>(
    entries: Array<{ key: string; value: T; ttl?: number }>,
    prefix?: string
  ): Promise<boolean> {
    try {
      const pipeline = this.redis.pipeline();
      
      entries.forEach(({ key, value, ttl = 3600 }) => {
        const fullKey = this.buildKey(key, prefix);
        const serializedValue = JSON.stringify(value);
        pipeline.setex(fullKey, ttl, serializedValue);
      });
      
      const results = await pipeline.exec();
      const success = results?.every(([error]) => !error) ?? false;
      
      this.logger.debug(`Cache mset completed for ${entries.length} keys`);
      return success;
    } catch (error) {
      this.logger.error('Cache mset error:', error);
      return false;
    }
  }

  async invalidateByTag(tag: string): Promise<number> {
    try {
      const tagKey = `tag:${tag}`;
      const keys = await this.redis.smembers(tagKey);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const pipeline = this.redis.pipeline();
      keys.forEach(key => pipeline.del(key));
      pipeline.del(tagKey);
      
      const results = await pipeline.exec();
      const deletedCount = results?.reduce((count, [error]) => 
        error ? count : count + 1, 0) ?? 0;
      
      this.logger.log(`Invalidated ${deletedCount} keys with tag: ${tag}`);
      
      // Publish invalidation event
      await this.publisher.publish('cache:invalidation', JSON.stringify({
        type: 'tag',
        tag,
        deletedCount,
        timestamp: Date.now()
      }));
      
      return deletedCount;
    } catch (error) {
      this.logger.error(`Tag invalidation error for tag ${tag}:`, error);
      return 0;
    }
  }

  async invalidateByPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const deletedCount = await this.redis.del(...keys);
      
      this.logger.log(`Invalidated ${deletedCount} keys with pattern: ${pattern}`);
      
      // Publish invalidation event
      await this.publisher.publish('cache:invalidation', JSON.stringify({
        type: 'pattern',
        pattern,
        deletedCount,
        timestamp: Date.now()
      }));
      
      return deletedCount;
    } catch (error) {
      this.logger.error(`Pattern invalidation error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  async exists(key: string, prefix?: string): Promise<boolean> {
    const fullKey = this.buildKey(key, prefix);
    
    try {
      const exists = await this.redis.exists(fullKey);
      return exists === 1;
    } catch (error) {
      this.logger.error(`Cache exists check error for key ${fullKey}:`, error);
      return false;
    }
  }

  async ttl(key: string, prefix?: string): Promise<number> {
    const fullKey = this.buildKey(key, prefix);
    
    try {
      return await this.redis.ttl(fullKey);
    } catch (error) {
      this.logger.error(`TTL check error for key ${fullKey}:`, error);
      return -1;
    }
  }

  async extend(key: string, additionalTtl: number, prefix?: string): Promise<boolean> {
    const fullKey = this.buildKey(key, prefix);
    
    try {
      const currentTtl = await this.redis.ttl(fullKey);
      if (currentTtl > 0) {
        const newTtl = currentTtl + additionalTtl;
        const result = await this.redis.expire(fullKey, newTtl);
        return result === 1;
      }
      return false;
    } catch (error) {
      this.logger.error(`TTL extension error for key ${fullKey}:`, error);
      return false;
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalOperations: 0,
      averageResponseTime: 0
    };
    this.responseTimes = [];
  }

  private buildKey(key: string, prefix?: string): string {
    const parts = ['cache'];
    if (prefix) parts.push(prefix);
    parts.push(key);
    return parts.join(':');
  }

  private async setTags(key: string, tags: string[], ttl: number): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      
      tags.forEach(tag => {
        const tagKey = `tag:${tag}`;
        pipeline.sadd(tagKey, key);
        pipeline.expire(tagKey, ttl + 300); // Tag expires 5 minutes after cache
      });
      
      await pipeline.exec();
    } catch (error) {
      this.logger.error('Error setting cache tags:', error);
    }
  }

  private async cleanupTags(key: string): Promise<void> {
    try {
      // This is a simplified cleanup - in production, you might want
      // to maintain a reverse index of key -> tags
      const tagPattern = 'tag:*';
      const tagKeys = await this.redis.keys(tagPattern);
      
      if (tagKeys.length > 0) {
        const pipeline = this.redis.pipeline();
        tagKeys.forEach(tagKey => pipeline.srem(tagKey, key));
        await pipeline.exec();
      }
    } catch (error) {
      this.logger.error('Error cleaning up cache tags:', error);
    }
  }

  private updateStats(hit: boolean, responseTime: number): void {
    this.stats.totalOperations++;
    
    if (hit) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    
    this.stats.hitRate = (this.stats.hits / this.stats.totalOperations) * 100;
    
    if (responseTime > 0) {
      this.responseTimes.push(responseTime);
      if (this.responseTimes.length > 1000) {
        this.responseTimes = this.responseTimes.slice(-1000);
      }
      
      this.stats.averageResponseTime = 
        this.responseTimes.reduce((sum, time) => sum + time, 0) / 
        this.responseTimes.length;
    }
  }
}