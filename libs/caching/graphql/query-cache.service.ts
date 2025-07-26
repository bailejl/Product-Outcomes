import { Injectable, Logger } from '@nestjs/common';
import { RedisCacheService } from '../redis/cache-service';
import { createHash } from 'crypto';
import { DocumentNode, print } from 'graphql';

export interface GraphQLCacheConfig {
  defaultTtl: number;
  maxQueryDepth: number;
  enableIntrospection: boolean;
  fieldLevelCaching: boolean;
  persistedQueries: boolean;
}

export interface QueryCacheKey {
  query: string;
  variables: Record<string, any>;
  operationName?: string;
  context?: Record<string, any>;
}

export interface CachedQueryResult {
  data: any;
  errors?: any[];
  extensions?: Record<string, any>;
  timestamp: number;
  ttl: number;
  tags: string[];
}

@Injectable()
export class GraphQLCacheService {
  private readonly logger = new Logger(GraphQLCacheService.name);
  private readonly persistedQueryMap = new Map<string, string>();

  constructor(
    private cacheService: RedisCacheService,
    private config: GraphQLCacheConfig
  ) {}

  async getCachedQuery(cacheKey: QueryCacheKey): Promise<CachedQueryResult | null> {
    const key = this.generateCacheKey(cacheKey);
    
    try {
      const cached = await this.cacheService.get<CachedQueryResult>(key, {
        prefix: 'graphql'
      });

      if (cached) {
        // Check if cache is still valid
        const age = (Date.now() - cached.timestamp) / 1000;
        if (age < cached.ttl) {
          this.logger.debug(`GraphQL cache hit for query: ${this.getQueryName(cacheKey.query)}`);
          return cached;
        } else {
          // Cache expired, remove it
          await this.cacheService.del(key, 'graphql');
        }
      }

      this.logger.debug(`GraphQL cache miss for query: ${this.getQueryName(cacheKey.query)}`);
      return null;
    } catch (error) {
      this.logger.error('Error retrieving cached GraphQL query:', error);
      return null;
    }
  }

  async setCachedQuery(
    cacheKey: QueryCacheKey,
    result: any,
    options?: {
      ttl?: number;
      tags?: string[];
    }
  ): Promise<boolean> {
    // Don't cache errors or empty results
    if (result.errors && result.errors.length > 0) {
      return false;
    }

    if (!result.data) {
      return false;
    }

    const key = this.generateCacheKey(cacheKey);
    const ttl = options?.ttl || this.calculateTtl(cacheKey);
    const tags = options?.tags || this.extractTags(cacheKey, result);

    const cachedResult: CachedQueryResult = {
      data: result.data,
      errors: result.errors,
      extensions: result.extensions,
      timestamp: Date.now(),
      ttl,
      tags
    };

    try {
      const success = await this.cacheService.set(key, cachedResult, {
        ttl,
        prefix: 'graphql',
        tags
      });

      if (success) {
        this.logger.debug(
          `Cached GraphQL query: ${this.getQueryName(cacheKey.query)} with TTL: ${ttl}s`
        );
      }

      return success;
    } catch (error) {
      this.logger.error('Error caching GraphQL query result:', error);
      return false;
    }
  }

  async invalidateByField(fieldName: string): Promise<number> {
    try {
      const tag = `field:${fieldName}`;
      const count = await this.cacheService.invalidateByTag(tag);
      
      this.logger.log(`Invalidated ${count} GraphQL queries for field: ${fieldName}`);
      return count;
    } catch (error) {
      this.logger.error(`Error invalidating GraphQL cache for field ${fieldName}:`, error);
      return 0;
    }
  }

  async invalidateByType(typeName: string): Promise<number> {
    try {
      const tag = `type:${typeName}`;
      const count = await this.cacheService.invalidateByTag(tag);
      
      this.logger.log(`Invalidated ${count} GraphQL queries for type: ${typeName}`);
      return count;
    } catch (error) {
      this.logger.error(`Error invalidating GraphQL cache for type ${typeName}:`, error);
      return 0;
    }
  }

  async invalidateByOperation(operationName: string): Promise<number> {
    try {
      const tag = `operation:${operationName}`;
      const count = await this.cacheService.invalidateByTag(tag);
      
      this.logger.log(`Invalidated ${count} GraphQL queries for operation: ${operationName}`);
      return count;
    } catch (error) {
      this.logger.error(`Error invalidating GraphQL cache for operation ${operationName}:`, error);
      return 0;
    }
  }

  async getPersistedQuery(hash: string): Promise<string | null> {
    if (this.config.persistedQueries) {
      return this.persistedQueryMap.get(hash) || null;
    }
    return null;
  }

  async setPersistedQuery(hash: string, query: string): Promise<void> {
    if (this.config.persistedQueries) {
      this.persistedQueryMap.set(hash, query);
      
      // Also cache in Redis for persistence across restarts
      await this.cacheService.set(`persisted:${hash}`, query, {
        ttl: 86400 * 30, // 30 days
        prefix: 'graphql'
      });
    }
  }

  async loadPersistedQueries(): Promise<void> {
    if (!this.config.persistedQueries) {
      return;
    }

    try {
      // Load persisted queries from Redis
      const pattern = 'cache:graphql:persisted:*';
      // Note: In production, use SCAN instead of KEYS for better performance
      // This is simplified for demonstration
      
      this.logger.log('Loaded persisted GraphQL queries from cache');
    } catch (error) {
      this.logger.error('Error loading persisted GraphQL queries:', error);
    }
  }

  private generateCacheKey(cacheKey: QueryCacheKey): string {
    const normalizedQuery = this.normalizeQuery(cacheKey.query);
    const variablesStr = JSON.stringify(cacheKey.variables || {});
    const contextStr = JSON.stringify(cacheKey.context || {});
    
    const keyString = `${normalizedQuery}|${variablesStr}|${contextStr}|${cacheKey.operationName || ''}`;
    
    // Hash the key to ensure consistent length and avoid special characters
    return createHash('sha256').update(keyString).digest('hex');
  }

  private normalizeQuery(query: string): string {
    // Remove extra whitespace and normalize formatting
    return query
      .replace(/\s+/g, ' ')
      .replace(/\s*{\s*/g, '{')
      .replace(/\s*}\s*/g, '}')
      .replace(/\s*\(\s*/g, '(')
      .replace(/\s*\)\s*/g, ')')
      .replace(/\s*,\s*/g, ',')
      .trim();
  }

  private getQueryName(query: string): string {
    const match = query.match(/(?:query|mutation|subscription)\s+(\w+)/);
    return match ? match[1] : 'anonymous';
  }

  private calculateTtl(cacheKey: QueryCacheKey): number {
    // Calculate TTL based on query characteristics
    const queryName = this.getQueryName(cacheKey.query);
    
    // Different TTLs for different query types
    const ttlMap: Record<string, number> = {
      // User-specific data - shorter TTL
      getUserProfile: 300,     // 5 minutes
      getUserSettings: 600,    // 10 minutes
      
      // Product catalog - medium TTL
      getProducts: 1800,       // 30 minutes
      getProduct: 3600,        // 1 hour
      
      // Static content - longer TTL
      getCategories: 7200,     // 2 hours
      getStaticContent: 86400, // 24 hours
    };

    if (ttlMap[queryName]) {
      return ttlMap[queryName];
    }

    // Default TTL based on query complexity
    const queryDepth = this.calculateQueryDepth(cacheKey.query);
    if (queryDepth > this.config.maxQueryDepth) {
      return 60; // Short TTL for complex queries
    }

    return this.config.defaultTtl;
  }

  private calculateQueryDepth(query: string): number {
    // Simple depth calculation based on nested braces
    let depth = 0;
    let maxDepth = 0;
    
    for (const char of query) {
      if (char === '{') {
        depth++;
        maxDepth = Math.max(maxDepth, depth);
      } else if (char === '}') {
        depth--;
      }
    }
    
    return maxDepth;
  }

  private extractTags(cacheKey: QueryCacheKey, result: any): string[] {
    const tags: string[] = [];
    
    // Add operation type tag
    if (cacheKey.query.includes('mutation')) {
      tags.push('mutation');
    } else if (cacheKey.query.includes('subscription')) {
      tags.push('subscription');
    } else {
      tags.push('query');
    }
    
    // Add operation name tag
    const operationName = cacheKey.operationName || this.getQueryName(cacheKey.query);
    if (operationName && operationName !== 'anonymous') {
      tags.push(`operation:${operationName}`);
    }
    
    // Extract field names from query
    const fieldMatches = cacheKey.query.match(/\b([a-zA-Z][a-zA-Z0-9_]*)\s*(?:\([^)]*\))?\s*{/g);
    if (fieldMatches) {
      fieldMatches.forEach(match => {
        const fieldName = match.replace(/\s*(?:\([^)]*\))?\s*{.*/, '');
        if (fieldName && !['query', 'mutation', 'subscription'].includes(fieldName)) {
          tags.push(`field:${fieldName}`);
        }
      });
    }
    
    // Extract type information from result
    if (result.data && typeof result.data === 'object') {
      this.extractTypeTags(result.data, tags);
    }
    
    // Add variable-based tags
    if (cacheKey.variables) {
      Object.entries(cacheKey.variables).forEach(([key, value]) => {
        if (key === 'id' && value) {
          tags.push(`id:${value}`);
        } else if (key === 'userId' && value) {
          tags.push(`user:${value}`);
        } else if (key === 'categoryId' && value) {
          tags.push(`category:${value}`);
        }
      });
    }
    
    return tags;
  }

  private extractTypeTags(data: any, tags: string[], prefix = ''): void {
    if (Array.isArray(data)) {
      data.forEach(item => this.extractTypeTags(item, tags, prefix));
    } else if (data && typeof data === 'object') {
      // Check for typename field
      if (data.__typename) {
        tags.push(`type:${data.__typename}`);
      }
      
      // Check for ID field
      if (data.id) {
        const typeName = data.__typename || 'unknown';
        tags.push(`${typeName.toLowerCase()}:${data.id}`);
      }
      
      // Recursively check nested objects
      Object.values(data).forEach(value => {
        if (value && typeof value === 'object') {
          this.extractTypeTags(value, tags, prefix);
        }
      });
    }
  }
}

// Cache directive for GraphQL schema
export const cacheDirective = {
  name: 'cache',
  definition: `
    directive @cache(
      ttl: Int = 300
      tags: [String!]
      scope: CacheScope = PUBLIC
    ) on FIELD_DEFINITION | OBJECT

    enum CacheScope {
      PUBLIC
      PRIVATE
    }
  `
};