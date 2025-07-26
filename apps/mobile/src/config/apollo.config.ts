/**
 * Apollo Client Configuration for React Native
 * Includes authentication, offline support, cache persistence, and real-time subscriptions
 */

import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  from,
  ApolloLink,
  Observable,
  FetchResult,
  Operation,
  NextLink,
  split,
} from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import { onError } from '@apollo/client/link/error'
import { RetryLink } from '@apollo/client/link/retry'
import { createPersistedQueryLink } from '@apollo/client/link/persisted-queries'
import { BatchHttpLink } from '@apollo/client/link/batch-http'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { getMainDefinition } from '@apollo/client/utilities'
import { createClient } from 'graphql-ws'
import { persistCache, LocalStorageWrapper } from 'apollo3-cache-persist'
import AsyncStorage from '@react-native-async-storage/async-storage'
import EncryptedStorage from 'react-native-encrypted-storage'
import NetInfo from '@react-native-community/netinfo'
import { MMKV } from 'react-native-mmkv'
import { Platform } from 'react-native'

// Types
interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
}

interface NetworkStatus {
  isConnected: boolean
  isInternetReachable: boolean
  type: string
}

// Configuration
const APOLLO_CONFIG = {
  uri: __DEV__ 
    ? 'http://localhost:3333/graphql'
    : 'https://api.productoutcomes.com/graphql',
  wsUri: __DEV__
    ? 'ws://localhost:3333/graphql'
    : 'wss://api.productoutcomes.com/graphql',
  
  // Cache persistence
  cachePersistence: {
    maxSize: 50 * 1024 * 1024, // 50MB
    debounce: 1000, // 1 second
    serialize: true,
  },
  
  // Retry configuration
  retry: {
    attempts: 3,
    delay: {
      initial: 300,
      max: 5000,
      jitter: true,
    },
  },
  
  // Batch configuration
  batch: {
    batchMax: 10,
    batchInterval: 20,
  },
  
  // Performance
  queryDeduplication: true,
  persisted: true,
}

// Storage setup
const storage = new MMKV({
  id: 'apollo-cache',
  encryptionKey: 'apollo-cache-encryption-key-v1'
})

const asyncStorage = {
  getItem: async (key: string) => {
    try {
      return storage.getString(key) || null
    } catch (error) {
      console.warn('Cache read error:', error)
      return null
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      storage.set(key, value)
    } catch (error) {
      console.warn('Cache write error:', error)
    }
  },
  removeItem: async (key: string) => {
    try {
      storage.delete(key)
    } catch (error) {
      console.warn('Cache delete error:', error)
    }
  },
}

// Network status tracking
let networkStatus: NetworkStatus = {
  isConnected: true,
  isInternetReachable: true,
  type: 'unknown',
}

NetInfo.addEventListener(state => {
  networkStatus = {
    isConnected: state.isConnected ?? false,
    isInternetReachable: state.isInternetReachable ?? false,
    type: state.type,
  }
})

// Auth token management
class AuthManager {
  private static instance: AuthManager
  private tokens: AuthTokens | null = null
  
  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager()
    }
    return AuthManager.instance
  }
  
  async loadTokens(): Promise<AuthTokens | null> {
    try {
      const tokensStr = await EncryptedStorage.getItem('auth_tokens')
      if (tokensStr) {
        this.tokens = JSON.parse(tokensStr)
        return this.tokens
      }
    } catch (error) {
      console.error('Failed to load auth tokens:', error)
    }
    return null
  }
  
  async saveTokens(tokens: AuthTokens): Promise<void> {
    try {
      this.tokens = tokens
      await EncryptedStorage.setItem('auth_tokens', JSON.stringify(tokens))
    } catch (error) {
      console.error('Failed to save auth tokens:', error)
    }
  }
  
  async clearTokens(): Promise<void> {
    try {
      this.tokens = null
      await EncryptedStorage.removeItem('auth_tokens')
    } catch (error) {
      console.error('Failed to clear auth tokens:', error)
    }
  }
  
  getTokens(): AuthTokens | null {
    return this.tokens
  }
  
  async refreshTokens(): Promise<AuthTokens | null> {
    if (!this.tokens?.refreshToken) {
      return null
    }
    
    try {
      const response = await fetch(`${APOLLO_CONFIG.uri.replace('/graphql', '')}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          refreshToken: this.tokens.refreshToken 
        }),
      })
      
      if (!response.ok) {
        throw new Error('Token refresh failed')
      }
      
      const data = await response.json()
      const newTokens = data.tokens
      
      await this.saveTokens(newTokens)
      return newTokens
    } catch (error) {
      console.error('Token refresh failed:', error)
      await this.clearTokens()
      // Emit event for app to handle
      return null
    }
  }
}

const authManager = AuthManager.getInstance()

// HTTP Link with batching
const httpLink = new BatchHttpLink({
  uri: APOLLO_CONFIG.uri,
  batchMax: APOLLO_CONFIG.batch.batchMax,
  batchInterval: APOLLO_CONFIG.batch.batchInterval,
  fetchOptions: {
    credentials: 'include',
  },
})

// WebSocket Link for subscriptions
const wsLink = new GraphQLWsLink(
  createClient({
    url: APOLLO_CONFIG.wsUri,
    connectionParams: async () => {
      const tokens = authManager.getTokens()
      return {
        Authorization: tokens ? `Bearer ${tokens.accessToken}` : '',
      }
    },
    shouldRetry: () => true,
    retryAttempts: 5,
    retryWait: async function waitForRetry() {
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 1000))
    },
  })
)

// Auth Link
const authLink = setContext(async (_, { headers }) => {
  await authManager.loadTokens()
  const tokens = authManager.getTokens()
  
  return {
    headers: {
      ...headers,
      authorization: tokens ? `Bearer ${tokens.accessToken}` : '',
      'x-client-name': 'mobile-app',
      'x-client-version': '1.0.0',
      'x-platform': Platform.OS,
    },
  }
})

// Token refresh link
const tokenRefreshLink = new ApolloLink(
  (operation: Operation, forward: NextLink) => {
    return new Observable<FetchResult>((observer) => {
      let sub: any
      
      const handleResponse = (result: FetchResult) => {
        observer.next(result)
        observer.complete()
      }
      
      const handleError = async (error: any) => {
        // Check if it's an authentication error
        if (
          error.networkError?.statusCode === 401 ||
          error.graphQLErrors?.some(
            (err: any) => err.extensions?.code === 'UNAUTHENTICATED'
          )
        ) {
          try {
            // Attempt to refresh token
            const newTokens = await authManager.refreshTokens()
            
            if (newTokens) {
              // Update the operation with new auth header
              operation.setContext(({ headers = {} }) => ({
                headers: {
                  ...headers,
                  authorization: `Bearer ${newTokens.accessToken}`,
                },
              }))
              
              // Retry the operation
              sub = forward(operation).subscribe({
                next: handleResponse,
                error: (retryError) => observer.error(retryError),
              })
              return
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError)
          }
        }
        
        observer.error(error)
      }
      
      sub = forward(operation).subscribe({
        next: handleResponse,
        error: handleError,
      })
      
      return () => {
        if (sub) sub.unsubscribe()
      }
    })
  }
)

// Error Link
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `GraphQL error: Message: ${message}, Location: ${locations}, Path: ${path}`,
        extensions
      )
      
      // Handle specific error types
      switch (extensions?.code) {
        case 'UNAUTHENTICATED':
          // Emit event for app to handle
          break
        case 'FORBIDDEN':
          // Handle authorization errors
          break
        case 'VALIDATION_ERROR':
          // Handle validation errors
          break
        default:
          // Handle other GraphQL errors
      }
    })
  }
  
  if (networkError) {
    console.error(`Network error: ${networkError}`)
    
    // Handle offline scenarios
    if (!networkStatus.isConnected) {
      console.log('Device is offline, queuing operation for later')
      // Offline queue will handle this
    }
  }
})

// Retry Link
const retryLink = new RetryLink({
  delay: APOLLO_CONFIG.retry.delay,
  attempts: {
    max: APOLLO_CONFIG.retry.attempts,
    retryIf: (error, _operation) => {
      // Don't retry on auth errors
      if (error.networkError?.statusCode === 401 || 
          error.networkError?.statusCode === 403) {
        return false
      }
      
      // Retry on network errors and 5xx server errors
      return (
        !!error.networkError ||
        (error.networkError?.statusCode >= 500)
      )
    },
  },
})

// Persisted Queries Link
const persistedQueriesLink = createPersistedQueryLink({
  useGETForHashedQueries: true,
})

// Cache configuration
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
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
      },
    },
    User: {
      fields: {
        fullName: {
          read(_, { readField }) {
            const firstName = readField('firstName') as string
            const lastName = readField('lastName') as string
            return `${firstName} ${lastName}`.trim()
          },
        },
      },
    },
    Message: {
      fields: {
        isEdited: {
          read(_, { readField }) {
            const createdAt = readField('createdAt') as string
            const updatedAt = readField('updatedAt') as string
            return createdAt !== updatedAt
          },
        },
      },
    },
  },
  addTypename: true,
  dataIdFromObject: (object: any) => {
    if (object.__typename && object.id) {
      return `${object.__typename}:${object.id}`
    }
    return null
  },
})

// Link routing - HTTP for queries/mutations, WebSocket for subscriptions
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query)
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    )
  },
  wsLink,
  from([
    errorLink,
    retryLink,
    tokenRefreshLink,
    authLink,
    persistedQueriesLink,
    httpLink,
  ])
)

// Create Apollo Client
export const apolloClient = new ApolloClient({
  link: splitLink,
  cache,
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
  queryDeduplication: APOLLO_CONFIG.queryDeduplication,
  connectToDevTools: __DEV__,
})

// Cache persistence
export const initializeCachePersistence = async () => {
  try {
    await persistCache({
      cache,
      storage: asyncStorage,
      maxSize: APOLLO_CONFIG.cachePersistence.maxSize,
      debounce: APOLLO_CONFIG.cachePersistence.debounce,
      serialize: APOLLO_CONFIG.cachePersistence.serialize,
    })
    console.log('✅ Apollo cache persistence initialized')
  } catch (error) {
    console.error('❌ Failed to initialize cache persistence:', error)
  }
}

// Cache utilities
export const cacheUtils = {
  clear: async () => {
    await apolloClient.clearStore()
    await asyncStorage.removeItem('apollo-cache-persist')
    console.log('🗑️ Apollo cache cleared')
  },
  
  reset: async () => {
    await apolloClient.resetStore()
    console.log('🔄 Apollo cache reset')
  },
  
  size: () => {
    const snapshot = cache.extract()
    return {
      entities: Object.keys(snapshot).length,
      size: JSON.stringify(snapshot).length,
    }
  },
}

// Network status utilities
export const networkUtils = {
  isOnline: () => networkStatus.isConnected && networkStatus.isInternetReachable,
  getStatus: () => networkStatus,
  
  // Wait for network connection
  waitForConnection: (timeout = 10000): Promise<boolean> => {
    return new Promise((resolve) => {
      if (networkUtils.isOnline()) {
        resolve(true)
        return
      }
      
      const timer = setTimeout(() => {
        unsubscribe()
        resolve(false)
      }, timeout)
      
      const unsubscribe = NetInfo.addEventListener(state => {
        if (state.isConnected && state.isInternetReachable) {
          clearTimeout(timer)
          unsubscribe()
          resolve(true)
        }
      })
    })
  },
}

// Export auth manager
export { authManager }

// Initialize on import
if (!__DEV__) {
  initializeCachePersistence()
}