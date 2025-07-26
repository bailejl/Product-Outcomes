import depthLimit from 'graphql-depth-limit'
import { createRateLimitRule } from 'graphql-rate-limit'
import { costAnalysisRule } from 'graphql-cost-analysis'
import { Request } from 'express'
import { ValidationRule } from 'graphql'
import Redis from 'ioredis'

// Redis client for GraphQL rate limiting
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
})

redis.on('error', (err) => {
  console.error('Redis connection error for GraphQL rate limiting:', err)
})

// GraphQL complexity analysis configuration
export const complexityAnalysisRule = costAnalysisRule({
  maximumCost: 1000,
  onComplete: (cost: number, context: any) => {
    console.log(`GraphQL query cost: ${cost}`)
    
    // Log expensive queries
    if (cost > 500) {
      console.warn('Expensive GraphQL query detected:', {
        cost,
        user: context.user?.id,
        ip: context.req?.ip,
        userAgent: context.req?.get('User-Agent')
      })
    }
  },
  scalarCost: 1,
  objectCost: 2,
  listFactor: 10,
  introspectionCost: 1000,
  createError: (max: number, actual: number) => {
    return new Error(`Query complexity limit exceeded. Maximum: ${max}, Actual: ${actual}`)
  }
})

// GraphQL depth limiting
export const depthLimitRule = depthLimit(10, {
  ignore: ['__schema', '__type'] // Ignore introspection queries
})

// GraphQL rate limiting store using Redis
class GraphQLRateLimitRedisStore {
  private prefix: string

  constructor(prefix = 'gql_rate_limit:') {
    this.prefix = prefix
  }

  async getItem(key: string): Promise<any> {
    try {
      const value = await redis.get(`${this.prefix}${key}`)
      return value ? JSON.parse(value) : null
    } catch (error) {
      console.error('GraphQL rate limit get error:', error)
      return null
    }
  }

  async setItem(key: string, value: any, ttl: number): Promise<void> {
    try {
      await redis.setex(`${this.prefix}${key}`, ttl, JSON.stringify(value))
    } catch (error) {
      console.error('GraphQL rate limit set error:', error)
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await redis.del(`${this.prefix}${key}`)
    } catch (error) {
      console.error('GraphQL rate limit remove error:', error)
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await redis.keys(`${this.prefix}*`)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } catch (error) {
      console.error('GraphQL rate limit clear error:', error)
    }
  }
}

const graphqlRateLimitStore = new GraphQLRateLimitRedisStore()

// Rate limiting configurations for different GraphQL operations
export const graphqlRateLimitRule = createRateLimitRule({
  identifyContext: (context: any) => {
    // Use user ID if authenticated, otherwise IP
    const user = context.user
    const req = context.req as Request
    
    return user ? `user:${user.id}` : `ip:${req.ip}`
  },
  store: graphqlRateLimitStore
})

// Specific rate limit configurations
export const rateLimitConfigs = {
  // Query rate limiting - more permissive
  query: {
    window: '15m',
    max: 1000, // 1000 queries per 15 minutes
    message: 'Too many GraphQL queries'
  },

  // Mutation rate limiting - more restrictive
  mutation: {
    window: '15m',
    max: 100, // 100 mutations per 15 minutes
    message: 'Too many GraphQL mutations'
  },

  // Subscription rate limiting - very restrictive
  subscription: {
    window: '15m',
    max: 50, // 50 subscriptions per 15 minutes
    message: 'Too many GraphQL subscriptions'
  },

  // Specific operation rate limits
  login: {
    window: '15m',
    max: 5, // 5 login attempts per 15 minutes
    message: 'Too many login attempts'
  },

  passwordReset: {
    window: '1h',
    max: 3, // 3 password reset attempts per hour
    message: 'Too many password reset attempts'
  },

  createUser: {
    window: '1h',
    max: 5, // 5 user creation attempts per hour
    message: 'Too many user creation attempts'
  },

  fileUpload: {
    window: '1h',
    max: 20, // 20 file uploads per hour
    message: 'Too many file upload attempts'
  }
}

// Query whitelist for public operations
export const publicQueries = new Set([
  'GetHealth',
  'GetVersion',
  'IntrospectionQuery'
])

// Expensive operation blocklist
export const expensiveOperations = new Set([
  'GetAllUsers', // Block operations that return all users
  'GetAllOrganizations',
  'GetAllOKRs'
])

// GraphQL security validation rules
export const validationRules: ValidationRule[] = [
  depthLimitRule,
  complexityAnalysisRule,
  
  // Custom validation rule for operation blocking
  {
    OperationDefinition: {
      enter(node: any) {
        const operationName = node.name?.value
        
        if (operationName && expensiveOperations.has(operationName)) {
          throw new Error(`Operation '${operationName}' is not allowed`)
        }
      }
    }
  } as any,

  // Custom validation rule for introspection limiting
  {
    Field: {
      enter(node: any, key: any, parent: any, path: any, ancestors: any[]) {
        const fieldName = node.name.value
        
        // Block introspection in production
        if (process.env.NODE_ENV === 'production' && 
            (fieldName === '__schema' || fieldName === '__type')) {
          throw new Error('GraphQL introspection is disabled in production')
        }
      }
    }
  } as any
]

// Query complexity scoring
export const queryComplexityScoring = {
  // Basic field costs
  User: {
    id: 1,
    email: 1,
    name: 1,
    roles: 5, // More expensive due to relation
    organizations: 10, // Very expensive due to potential N+1
    okrs: 10
  },
  
  OKR: {
    id: 1,
    title: 1,
    description: 2,
    keyResults: 5,
    comments: 10,
    owner: 3,
    organization: 3
  },
  
  Organization: {
    id: 1,
    name: 1,
    description: 2,
    members: 20, // Very expensive
    okrs: 15,
    teams: 10
  },

  // Query multipliers
  Query: {
    users: 20, // High cost for listing users
    organizations: 15,
    okrs: 10,
    user: 5, // Lower cost for single user lookup
    organization: 5,
    okr: 3
  },

  // Mutation costs
  Mutation: {
    createUser: 10,
    updateUser: 8,
    deleteUser: 15,
    createOKR: 12,
    updateOKR: 10,
    deleteOKR: 15,
    login: 5,
    logout: 2,
    resetPassword: 8
  },

  // Subscription costs
  Subscription: {
    okrUpdated: 20,
    userPresence: 15,
    notifications: 10
  }
}

// Security monitoring for GraphQL operations
export const graphqlSecurityMonitor = {
  onQueryStart: (context: any, query: string) => {
    const startTime = Date.now()
    context._queryStartTime = startTime

    // Log query start for monitoring
    console.log('GraphQL query started:', {
      user: context.user?.id,
      ip: context.req?.ip,
      userAgent: context.req?.get('User-Agent'),
      queryLength: query.length,
      timestamp: new Date(startTime).toISOString()
    })
  },

  onQueryEnd: (context: any, result: any) => {
    const endTime = Date.now()
    const duration = endTime - (context._queryStartTime || endTime)

    // Log slow queries
    if (duration > 5000) { // 5 seconds
      console.warn('Slow GraphQL query detected:', {
        user: context.user?.id,
        ip: context.req?.ip,
        duration: `${duration}ms`,
        hasErrors: result.errors && result.errors.length > 0
      })
    }

    // Log errors
    if (result.errors && result.errors.length > 0) {
      console.error('GraphQL query errors:', {
        user: context.user?.id,
        ip: context.req?.ip,
        errors: result.errors.map((err: any) => ({
          message: err.message,
          path: err.path
        }))
      })
    }
  },

  onSubscriptionStart: (context: any, subscription: string) => {
    console.log('GraphQL subscription started:', {
      user: context.user?.id,
      ip: context.req?.ip,
      subscription: subscription
    })
  },

  onSubscriptionEnd: (context: any) => {
    console.log('GraphQL subscription ended:', {
      user: context.user?.id,
      ip: context.req?.ip
    })
  }
}

// Authentication check for GraphQL context
export const requireAuth = (context: any) => {
  if (!context.user) {
    throw new Error('Authentication required')
  }
  return context.user
}

// Authorization check for GraphQL context
export const requireRole = (context: any, requiredRoles: string[]) => {
  const user = requireAuth(context)
  
  const userRoles = user.roles?.map((role: any) => role.name) || []
  const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role))
  
  if (!hasRequiredRole) {
    throw new Error(`Insufficient permissions. Required: ${requiredRoles.join(' or ')}`)
  }
  
  return user
}

// Permission check for GraphQL context
export const requirePermission = (context: any, resource: string, action: string) => {
  const user = requireAuth(context)
  
  // Check if user has specific permission
  const hasPermission = user.permissions?.some((perm: any) => 
    perm.resource === resource && perm.action === action
  )
  
  if (!hasPermission) {
    throw new Error(`Insufficient permissions for ${action} on ${resource}`)
  }
  
  return user
}

// Resource ownership check
export const requireOwnership = (context: any, resourceOwnerId: string) => {
  const user = requireAuth(context)
  
  if (user.id !== resourceOwnerId) {
    // Check if user has admin role
    const userRoles = user.roles?.map((role: any) => role.name) || []
    if (!userRoles.includes('admin')) {
      throw new Error('Access denied: not resource owner or admin')
    }
  }
  
  return user
}

// Export Redis client for cleanup
export { redis as graphqlSecurityRedis }