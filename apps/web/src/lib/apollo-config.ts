/**
 * Apollo Client Configuration
 * Advanced configuration for performance optimization and development tools
 */

import { 
  ApolloClientOptions, 
  NormalizedCacheObject, 
  InMemoryCache,
  TypePolicies 
} from '@apollo/client'

// Environment configuration
export const APOLLO_CONFIG = {
  // GraphQL endpoint
  uri: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3333/graphql'
    : '/graphql',
    
  // WebSocket endpoint for subscriptions
  wsUri: process.env.NODE_ENV === 'development'
    ? 'ws://localhost:3333/graphql'
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/graphql`,
    
  // Apollo DevTools
  connectToDevTools: process.env.NODE_ENV === 'development',
  
  // Default fetch policies
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-first',
      errorPolicy: 'all',
      notifyOnNetworkStatusChange: true,
    },
    query: {
      fetchPolicy: 'cache-first',
      errorPolicy: 'all',
    },
    mutate: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
  },
  
  // Cache configuration
  cache: {
    // Garbage collection after each mutation
    enableGC: true,
    
    // Cache persistence (optional)
    persist: process.env.NODE_ENV === 'production',
  },
  
  // Performance monitoring
  performance: {
    // Log slow queries (in development)
    logSlowQueries: process.env.NODE_ENV === 'development',
    slowQueryThreshold: 1000, // 1 second
    
    // Enable query deduplication
    deduplication: true,
    
    // Batch link interval
    batchInterval: 10, // milliseconds
  },
}

// Type policies for intelligent caching
export const typePolicies: TypePolicies = {
  Query: {
    fields: {
      // Messages with cursor-based pagination
      messages: {
        keyArgs: ['filters'],
        merge(existing, incoming, { args }) {
          if (!existing) return incoming
          
          const { pagination } = args || {}
          
          // If no cursor, replace existing data
          if (!pagination?.after) {
            return incoming
          }
          
          // Merge paginated results
          return {
            ...incoming,
            edges: [...(existing.edges || []), ...(incoming.edges || [])],
          }
        },
      },
      
      // Users with similar pagination logic
      users: {
        keyArgs: ['filters'],
        merge(existing, incoming, { args }) {
          if (!existing) return incoming
          
          const { pagination } = args || {}
          
          if (!pagination?.after) {
            return incoming
          }
          
          return {
            ...incoming,
            edges: [...(existing.edges || []), ...(incoming.edges || [])],
          }
        },
      },
      
      // Search results (replace on new search)
      searchUsers: {
        keyArgs: ['searchTerm'],
        merge: (_existing, incoming) => incoming,
      },
      
      searchMessages: {
        keyArgs: ['searchTerm'],
        merge: (_existing, incoming) => incoming,
      },
    },
  },
  
  User: {
    fields: {
      // Virtual field for full name
      fullName: {
        read(_, { readField }) {
          const firstName = readField('firstName') as string
          const lastName = readField('lastName') as string
          return `${firstName} ${lastName}`.trim()
        },
      },
      
      // Virtual field for display name
      displayName: {
        read(_, { readField }) {
          const firstName = readField('firstName') as string
          const lastName = readField('lastName') as string
          return firstName || `${firstName} ${lastName}`.trim()
        },
      },
      
      // User's messages (paginated)
      messages: {
        merge(existing = [], incoming) {
          return [...existing, ...incoming]
        },
      },
    },
  },
  
  Message: {
    fields: {
      // Virtual field for edited status
      isEdited: {
        read(_, { readField }) {
          const createdAt = readField('createdAt') as string
          const updatedAt = readField('updatedAt') as string
          return createdAt !== updatedAt
        },
      },
      
      // Edit history (append new edits)
      editHistory: {
        merge(existing = [], incoming) {
          return [...existing, ...incoming]
        },
      },
    },
  },
  
  // Subscription types
  Subscription: {
    fields: {
      messageAdded: {
        merge: (_existing, incoming) => incoming,
      },
      messageUpdated: {
        merge: (_existing, incoming) => incoming,
      },
      userStatusChanged: {
        merge: (_existing, incoming) => incoming,
      },
    },
  },
}

// Cache configuration
export function createApolloCache(): InMemoryCache {
  return new InMemoryCache({
    typePolicies,
    
    // Data normalization
    addTypename: true,
    
    // Custom data ID generation
    dataIdFromObject: (object: any) => {
      if (object.__typename && object.id) {
        return `${object.__typename}:${object.id}`
      }
      return null
    },
    
    // Canonical type definitions
    possibleTypes: {
      // Add possible types for union/interface types if needed
    },
  })
}

// Performance monitoring utilities
export const performanceMonitor = {
  startTimer: (operationName: string) => {
    if (APOLLO_CONFIG.performance.logSlowQueries) {
      return performance.now()
    }
    return null
  },
  
  endTimer: (startTime: number | null, operationName: string) => {
    if (!startTime || !APOLLO_CONFIG.performance.logSlowQueries) return
    
    const duration = performance.now() - startTime
    
    if (duration > APOLLO_CONFIG.performance.slowQueryThreshold) {
      console.warn(`🐌 Slow GraphQL operation: ${operationName} took ${duration.toFixed(2)}ms`)
    } else {
      console.log(`⚡ GraphQL operation: ${operationName} took ${duration.toFixed(2)}ms`)
    }
  },
}

// Cache management utilities
export const cacheUtils = {
  // Clear specific cache entries
  evictCache: (cache: InMemoryCache, typename: string, id: string) => {
    cache.evict({ id: `${typename}:${id}` })
    cache.gc()
  },
  
  // Clear all cache entries of a specific type
  evictType: (cache: InMemoryCache, typename: string) => {
    cache.evict({ fieldName: typename })
    cache.gc()
  },
  
  // Get cache size (for debugging)
  getCacheSize: (cache: InMemoryCache) => {
    const snapshot = cache.extract()
    return {
      entities: Object.keys(snapshot).length,
      size: JSON.stringify(snapshot).length,
    }
  },
  
  // Reset specific query cache
  resetQuery: (cache: InMemoryCache, queryName: string) => {
    cache.evict({ fieldName: queryName })
    cache.gc()
  },
}

// Error categorization
export const errorCategories = {
  NETWORK: 'NETWORK',
  AUTHENTICATION: 'AUTHENTICATION', 
  AUTHORIZATION: 'AUTHORIZATION',
  VALIDATION: 'VALIDATION',
  SERVER: 'SERVER',
  UNKNOWN: 'UNKNOWN',
} as const

export function categorizeError(error: any): keyof typeof errorCategories {
  if (error.networkError) {
    return 'NETWORK'
  }
  
  if (error.graphQLErrors?.length > 0) {
    const graphQLError = error.graphQLErrors[0]
    const code = graphQLError.extensions?.code
    
    switch (code) {
      case 'UNAUTHENTICATED':
        return 'AUTHENTICATION'
      case 'FORBIDDEN':
        return 'AUTHORIZATION'
      case 'VALIDATION_ERROR':
        return 'VALIDATION'
      case 'INTERNAL_SERVER_ERROR':
        return 'SERVER'
      default:
        return 'UNKNOWN'
    }
  }
  
  return 'UNKNOWN'
}

// Development helpers
export const devHelpers = {
  // Log cache state
  logCacheState: (cache: InMemoryCache) => {
    if (process.env.NODE_ENV === 'development') {
      console.group('📊 Apollo Cache State')
      console.log('Cache extract:', cache.extract())
      console.log('Cache size:', cacheUtils.getCacheSize(cache))
      console.groupEnd()
    }
  },
  
  // Log query performance
  logQueryPerformance: (operationName: string, duration: number, variables?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.group(`⚡ Query Performance: ${operationName}`)
      console.log('Duration:', `${duration.toFixed(2)}ms`)
      console.log('Variables:', variables)
      console.groupEnd()
    }
  },
  
  // Validate schema in development
  validateSchema: () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 GraphQL Schema validation enabled in development')
    }
  },
}

// Export configuration
export default APOLLO_CONFIG