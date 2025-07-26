import { Request, Response, NextFunction } from 'express';
import responseTime from 'response-time';
import { v4 as uuidv4 } from 'uuid';
import metricsService from '../metrics/MetricsService';

// Extend Express Request interface for correlation ID
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      startTime?: number;
      userId?: string;
      organizationId?: string;
    }
  }
}

/**
 * Middleware to add correlation ID to requests for distributed tracing
 */
export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Get correlation ID from header or generate new one
  const correlationId = (req.headers['x-correlation-id'] as string) || 
                       (req.headers['x-request-id'] as string) || 
                       uuidv4();
  
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  
  next();
};

/**
 * Middleware to record HTTP request metrics
 */
export const httpMetricsMiddleware = responseTime((req: Request, res: Response, time: number) => {
  const route = req.route?.path || req.path || 'unknown';
  const method = req.method;
  const statusCode = res.statusCode.toString();
  
  // Extract user and organization info from session or token
  const userId = req.userId || 'anonymous';
  const organizationId = req.organizationId || 'unknown';
  
  // Record metrics
  metricsService.httpRequestsTotal.inc({
    method,
    route,
    status_code: statusCode,
    user_id: userId,
    organization_id: organizationId
  });
  
  metricsService.httpRequestDuration.observe({
    method,
    route,
    status_code: statusCode
  }, time / 1000); // Convert to seconds
});

/**
 * Middleware to track request timing
 */
export const requestTimingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  req.startTime = Date.now();
  next();
};

/**
 * Middleware to extract user context from session or JWT
 */
export const userContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract from session
    if (req.session && (req.session as any).user) {
      const user = (req.session as any).user;
      req.userId = user.id;
      req.organizationId = user.organizationId;
    }
    
    // Extract from JWT token if no session
    if (!req.userId && req.headers.authorization) {
      const token = req.headers.authorization.replace('Bearer ', '');
      // TODO: Decode JWT and extract user info
      // This would integrate with your JWT service
    }
  } catch (error) {
    // Silently fail - metrics will use 'anonymous'/'unknown'
  }
  
  next();
};

/**
 * Error handling middleware that records error metrics
 */
export const errorMetricsMiddleware = (error: Error, req: Request, res: Response, next: NextFunction) => {
  const route = req.route?.path || req.path || 'unknown';
  const method = req.method;
  
  // Determine error severity based on status code or error type
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  let statusCode = 500;
  
  if (res.statusCode >= 500) {
    severity = 'critical';
    statusCode = res.statusCode;
  } else if (res.statusCode >= 400) {
    severity = 'high';
    statusCode = res.statusCode;
  }
  
  // Record error metrics
  metricsService.recordError(
    error.name || 'UnknownError',
    `api:${method}:${route}`,
    severity
  );
  
  // Add correlation ID to error for tracing
  console.error(`[${req.correlationId}] Error in ${method} ${route}:`, error);
  
  next(error);
};

/**
 * Health check metrics middleware
 */
export const healthMetricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/api/health') {
    // Record system health check
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = (Date.now() - startTime) / 1000;
      const isHealthy = res.statusCode < 400;
      
      metricsService.httpRequestDuration.observe({
        method: 'GET',
        route: '/api/health',
        status_code: res.statusCode.toString()
      }, duration);
    });
  }
  
  next();
};

/**
 * Database metrics middleware decorator
 */
export const withDatabaseMetrics = <T extends any[], R>(
  queryFn: (...args: T) => Promise<R>,
  queryType: string,
  table: string
) => {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    
    try {
      const result = await queryFn(...args);
      const duration = (Date.now() - startTime) / 1000;
      
      metricsService.recordDatabaseQuery(queryType, table, duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      
      metricsService.recordDatabaseQuery(queryType, table, duration);
      metricsService.recordDatabaseError(
        error instanceof Error ? error.name : 'UnknownError',
        table
      );
      
      throw error;
    }
  };
};

/**
 * Redis metrics middleware decorator
 */
export const withRedisMetrics = <T extends any[], R>(
  redisFn: (...args: T) => Promise<R>,
  operation: string
) => {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    
    try {
      const result = await redisFn(...args);
      const duration = (Date.now() - startTime) / 1000;
      
      metricsService.recordRedisOperation(operation, 'success', duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      
      metricsService.recordRedisOperation(operation, 'error', duration);
      throw error;
    }
  };
};

/**
 * GraphQL metrics extension for Apollo Server
 */
export const graphqlMetricsPlugin = {
  requestDidStart() {
    return {
      didResolveOperation(requestContext: any) {
        const { request, operationName } = requestContext;
        const operationType = request.query?.definitions?.[0]?.operation || 'unknown';
        
        // Extract user context
        const userId = requestContext.context?.user?.id || 'anonymous';
        
        metricsService.graphqlOperationsTotal.inc({
          operation_name: operationName || 'anonymous',
          operation_type: operationType,
          status: 'started',
          user_id: userId
        });
      },
      
      didEncounterErrors(requestContext: any) {
        const { operationName, errors } = requestContext;
        const userId = requestContext.context?.user?.id || 'anonymous';
        
        metricsService.graphqlOperationsTotal.inc({
          operation_name: operationName || 'anonymous',
          operation_type: 'unknown',
          status: 'error',
          user_id: userId
        });
        
        // Record each error
        errors?.forEach((error: any) => {
          metricsService.recordError(
            error.extensions?.code || 'GRAPHQL_ERROR',
            'graphql',
            'high'
          );
        });
      },
      
      willSendResponse(requestContext: any) {
        const { operationName, request } = requestContext;
        const operationType = request.query?.definitions?.[0]?.operation || 'unknown';
        const userId = requestContext.context?.user?.id || 'anonymous';
        const duration = Date.now() - requestContext.request.startTime;
        
        metricsService.graphqlOperationsTotal.inc({
          operation_name: operationName || 'anonymous',
          operation_type: operationType,
          status: 'completed',
          user_id: userId
        });
        
        metricsService.graphqlOperationDuration.observe({
          operation_name: operationName || 'anonymous',
          operation_type: operationType
        }, duration / 1000);
      }
    };
  }
};