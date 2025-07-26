import Redis, { RedisOptions } from 'ioredis';
import { Logger } from '@nestjs/common';

export interface CacheConnectionConfig extends RedisOptions {
  maxRetries?: number;
  retryDelayOnFailover?: number;
  enableOfflineQueue?: boolean;
  pool?: {
    min: number;
    max: number;
  };
}

export class RedisConnectionManager {
  private static instance: RedisConnectionManager;
  private redis: Redis;
  private subscriber: Redis;
  private publisher: Redis;
  private pool: Redis[] = [];
  private readonly logger = new Logger(RedisConnectionManager.name);

  private constructor(private config: CacheConnectionConfig) {
    this.initializeConnections();
  }

  static getInstance(config?: CacheConnectionConfig): RedisConnectionManager {
    if (!RedisConnectionManager.instance) {
      if (!config) {
        throw new Error('Redis configuration required for first initialization');
      }
      RedisConnectionManager.instance = new RedisConnectionManager(config);
    }
    return RedisConnectionManager.instance;
  }

  private initializeConnections(): void {
    const baseConfig: RedisOptions = {
      ...this.config,
      maxRetriesPerRequest: this.config.maxRetries || 3,
      retryDelayOnFailover: this.config.retryDelayOnFailover || 100,
      enableOfflineQueue: this.config.enableOfflineQueue ?? false,
      lazyConnect: true,
    };

    // Main Redis connection
    this.redis = new Redis(baseConfig);
    
    // Separate connections for pub/sub to avoid blocking
    this.subscriber = new Redis({ ...baseConfig, enableOfflineQueue: true });
    this.publisher = new Redis({ ...baseConfig, enableOfflineQueue: true });

    // Connection pool for high-throughput operations
    if (this.config.pool) {
      for (let i = 0; i < this.config.pool.max; i++) {
        this.pool.push(new Redis(baseConfig));
      }
    }

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    const connections = [this.redis, this.subscriber, this.publisher, ...this.pool];
    
    connections.forEach((connection, index) => {
      connection.on('connect', () => {
        this.logger.log(`Redis connection ${index} established`);
      });

      connection.on('error', (error) => {
        this.logger.error(`Redis connection ${index} error:`, error);
      });

      connection.on('reconnecting', () => {
        this.logger.warn(`Redis connection ${index} reconnecting...`);
      });

      connection.on('close', () => {
        this.logger.warn(`Redis connection ${index} closed`);
      });
    });
  }

  async connect(): Promise<void> {
    try {
      await Promise.all([
        this.redis.connect(),
        this.subscriber.connect(),
        this.publisher.connect(),
        ...this.pool.map(conn => conn.connect())
      ]);
      this.logger.log('All Redis connections established');
    } catch (error) {
      this.logger.error('Failed to establish Redis connections:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.redis.disconnect(),
        this.subscriber.disconnect(),
        this.publisher.disconnect(),
        ...this.pool.map(conn => conn.disconnect())
      ]);
      this.logger.log('All Redis connections closed');
    } catch (error) {
      this.logger.error('Error closing Redis connections:', error);
      throw error;
    }
  }

  getRedis(): Redis {
    return this.redis;
  }

  getSubscriber(): Redis {
    return this.subscriber;
  }

  getPublisher(): Redis {
    return this.publisher;
  }

  getPoolConnection(): Redis {
    if (this.pool.length === 0) {
      return this.redis;
    }
    
    // Simple round-robin selection
    const connection = this.pool.shift()!;
    this.pool.push(connection);
    return connection;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const ping = await this.redis.ping();
      return ping === 'PONG';
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return false;
    }
  }

  getConnectionInfo(): any {
    return {
      status: this.redis.status,
      poolSize: this.pool.length,
      config: {
        host: this.config.host,
        port: this.config.port,
        db: this.config.db,
      }
    };
  }
}