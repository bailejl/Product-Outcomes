import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisCacheService } from '../redis/cache-service';
import { createHash } from 'crypto';

export interface ApiCacheConfig {
  defaultTtl: number;
  excludeRoutes: string[];
  includeHeaders: string[];
  varyBy: Array<'user' | 'query' | 'headers' | 'method'>;
  compressionThreshold: number;
  maxCacheSize: number;
}

@Injectable()
export class ApiCacheMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ApiCacheMiddleware.name);

  constructor(
    private cacheService: RedisCacheService,
    private config: ApiCacheConfig
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip caching for excluded routes
    if (this.shouldSkipCaching(req)) {
      return next();
    }

    // Only cache GET requests by default
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = this.generateCacheKey(req);
    const cachedResponse = await this.cacheService.get(cacheKey, {
      prefix: 'api'
    });

    if (cachedResponse) {
      this.logger.debug(`Serving cached response for: ${req.path}`);
      this.setCacheHeaders(res, 'HIT');
      return this.sendCachedResponse(res, cachedResponse);
    }

    // Capture the response
    const originalSend = res.send;
    const originalJson = res.json;
    let responseBody: any;
    let statusCode: number;

    res.send = function(body: any) {
      responseBody = body;
      statusCode = res.statusCode;
      return originalSend.call(this, body);
    };

    res.json = function(body: any) {
      responseBody = body;
      statusCode = res.statusCode;
      return originalJson.call(this, body);
    };

    // Add response handler
    res.on('finish', async () => {
      await this.handleResponseCaching(
        req,
        res,
        cacheKey,
        responseBody,
        statusCode
      );
    });

    this.setCacheHeaders(res, 'MISS');
    next();
  }

  private shouldSkipCaching(req: Request): boolean {
    // Skip if route is excluded
    if (this.config.excludeRoutes.some(route => req.path.startsWith(route))) {
      return true;
    }

    // Skip if cache-control header says no-cache
    if (req.headers['cache-control']?.includes('no-cache')) {
      return true;
    }

    // Skip if authorization header present (unless configured otherwise)
    if (req.headers.authorization && !this.config.varyBy.includes('user')) {
      return true;
    }

    return false;
  }

  private generateCacheKey(req: Request): string {
    const keyParts: string[] = [req.path];

    // Add query parameters
    if (this.config.varyBy.includes('query') && Object.keys(req.query).length > 0) {
      const sortedQuery = Object.keys(req.query)
        .sort()
        .map(key => `${key}=${req.query[key]}`)
        .join('&');
      keyParts.push(`query:${sortedQuery}`);
    }

    // Add user identifier
    if (this.config.varyBy.includes('user')) {
      const userId = this.extractUserId(req);
      if (userId) {
        keyParts.push(`user:${userId}`);
      }
    }

    // Add specific headers
    if (this.config.varyBy.includes('headers') && this.config.includeHeaders.length > 0) {
      const headerParts = this.config.includeHeaders
        .map(header => {
          const value = req.headers[header.toLowerCase()];
          return value ? `${header}:${value}` : null;
        })
        .filter(Boolean)
        .join('|');
      
      if (headerParts) {
        keyParts.push(`headers:${headerParts}`);
      }
    }

    // Add method if varying by method
    if (this.config.varyBy.includes('method')) {
      keyParts.push(`method:${req.method}`);
    }

    const fullKey = keyParts.join('|');
    
    // Hash long keys to avoid Redis key length limits
    if (fullKey.length > 200) {
      return createHash('sha256').update(fullKey).digest('hex');
    }

    return fullKey.replace(/[^a-zA-Z0-9:_-]/g, '_');
  }

  private extractUserId(req: Request): string | null {
    // Extract user ID from JWT token, session, or custom header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        // Simple JWT decode (in production, use proper JWT library)
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64').toString()
        );
        return payload.sub || payload.userId || payload.id;
      } catch {
        // Invalid token, ignore
      }
    }

    // Check session
    if ((req as any).session?.userId) {
      return (req as any).session.userId;
    }

    // Check custom header
    return req.headers['x-user-id'] as string || null;
  }

  private async handleResponseCaching(
    req: Request,
    res: Response,
    cacheKey: string,
    responseBody: any,
    statusCode: number
  ): Promise<void> {
    // Only cache successful responses
    if (statusCode < 200 || statusCode >= 300) {
      return;
    }

    // Don't cache empty responses
    if (!responseBody) {
      return;
    }

    try {
      const responseData = {
        body: responseBody,
        statusCode,
        headers: this.getHeadersToCache(res),
        timestamp: Date.now()
      };

      const serialized = JSON.stringify(responseData);
      
      // Check size limit
      if (serialized.length > this.config.maxCacheSize) {
        this.logger.warn(
          `Response too large to cache: ${serialized.length} bytes for ${req.path}`
        );
        return;
      }

      // Determine TTL based on response characteristics
      const ttl = this.calculateTtl(req, res, responseData);
      
      // Cache tags for invalidation
      const tags = this.generateCacheTags(req, responseData);

      await this.cacheService.set(cacheKey, responseData, {
        ttl,
        prefix: 'api',
        tags,
        compress: serialized.length > this.config.compressionThreshold
      });

      this.logger.debug(
        `Cached response for ${req.path} with TTL: ${ttl}s, size: ${serialized.length} bytes`
      );
    } catch (error) {
      this.logger.error(`Error caching response for ${req.path}:`, error);
    }
  }

  private getHeadersToCache(res: Response): Record<string, string> {
    const headersToCache = [
      'content-type',
      'content-encoding',
      'cache-control',
      'etag',
      'last-modified'
    ];

    const headers: Record<string, string> = {};
    headersToCache.forEach(header => {
      const value = res.getHeader(header);
      if (value) {
        headers[header] = String(value);
      }
    });

    return headers;
  }

  private calculateTtl(req: Request, res: Response, responseData: any): number {
    // Check if response has cache-control header
    const cacheControl = res.getHeader('cache-control') as string;
    if (cacheControl) {
      const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
      if (maxAgeMatch) {
        return parseInt(maxAgeMatch[1]);
      }
    }

    // Use route-specific TTL if available
    const routeTtl = this.getRouteTtl(req.path);
    if (routeTtl) {
      return routeTtl;
    }

    // Use default TTL
    return this.config.defaultTtl;
  }

  private getRouteTtl(path: string): number | null {
    // Define route-specific TTLs
    const routeTtls: Record<string, number> = {
      '/api/users/profile': 300,      // 5 minutes
      '/api/products': 1800,          // 30 minutes
      '/api/categories': 3600,        // 1 hour
      '/api/settings': 7200,          // 2 hours
      '/api/static': 86400,           // 24 hours
    };

    for (const [route, ttl] of Object.entries(routeTtls)) {
      if (path.startsWith(route)) {
        return ttl;
      }
    }

    return null;
  }

  private generateCacheTags(req: Request, responseData: any): string[] {
    const tags: string[] = [];

    // Add route-based tags
    const pathSegments = req.path.split('/').filter(Boolean);
    if (pathSegments.length > 0) {
      tags.push(`route:${pathSegments[0]}`);
      if (pathSegments.length > 1) {
        tags.push(`route:${pathSegments[0]}:${pathSegments[1]}`);
      }
    }

    // Add resource-based tags
    if (req.path.includes('/users/')) {
      tags.push('users');
      const userId = req.params?.id || this.extractUserId(req);
      if (userId) {
        tags.push(`user:${userId}`);
      }
    }

    if (req.path.includes('/products/')) {
      tags.push('products');
      if (req.params?.id) {
        tags.push(`product:${req.params.id}`);
      }
    }

    // Add query-based tags
    if (req.query.category) {
      tags.push(`category:${req.query.category}`);
    }

    return tags;
  }

  private sendCachedResponse(res: Response, cachedData: any): void {
    const { body, statusCode, headers } = cachedData;

    // Set cached headers
    Object.entries(headers).forEach(([name, value]) => {
      res.setHeader(name, value);
    });

    // Add cache age header
    const age = Math.floor((Date.now() - cachedData.timestamp) / 1000);
    res.setHeader('Age', age.toString());

    res.status(statusCode).send(body);
  }

  private setCacheHeaders(res: Response, status: 'HIT' | 'MISS'): void {
    res.setHeader('X-Cache-Status', status);
    res.setHeader('X-Cache-Date', new Date().toISOString());
  }
}

// Factory function for creating the middleware with configuration
export function createApiCacheMiddleware(
  cacheService: RedisCacheService,
  config: Partial<ApiCacheConfig> = {}
): ApiCacheMiddleware {
  const defaultConfig: ApiCacheConfig = {
    defaultTtl: 300,
    excludeRoutes: ['/api/auth', '/api/admin'],
    includeHeaders: ['accept', 'accept-language'],
    varyBy: ['query'],
    compressionThreshold: 1024,
    maxCacheSize: 1024 * 1024, // 1MB
    ...config
  };

  return new ApiCacheMiddleware(cacheService, defaultConfig);
}