/**
 * Apollo Client Configuration
 * Provides GraphQL client setup with authentication, cache policies, and error handling
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
} from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import { onError } from '@apollo/client/link/error'
import { RetryLink } from '@apollo/client/link/retry'

// Types for authentication
interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

// Auth storage keys
const TOKEN_STORAGE_KEY = 'auth_tokens'

/**
 * Get authentication tokens from localStorage
 */
function getAuthTokens(): AuthTokens | null {
  try {
    const tokensStr = localStorage.getItem(TOKEN_STORAGE_KEY)
    return tokensStr ? JSON.parse(tokensStr) : null
  } catch (error) {
    console.error('Failed to load auth tokens:', error)
    return null
  }
}

/**
 * Save authentication tokens to localStorage
 */
function saveAuthTokens(tokens: AuthTokens): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens))
  } catch (error) {
    console.error('Failed to save auth tokens:', error)
  }
}

/**
 * Clear authentication tokens from localStorage
 */
function clearAuthTokens(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(): Promise<AuthTokens | null> {
  const tokens = getAuthTokens()
  if (!tokens?.refreshToken) {
    return null
  }

  try {
    const response = await fetch('http://localhost:3333/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    })

    if (!response.ok) {
      throw new Error('Token refresh failed')
    }

    const data = await response.json()
    const newTokens = data.tokens

    saveAuthTokens(newTokens)
    return newTokens
  } catch (error) {
    console.error('Token refresh failed:', error)
    clearAuthTokens()
    // Redirect to login or trigger logout
    window.location.href = '/login'
    return null
  }
}

/**
 * HTTP Link for GraphQL requests
 */
const httpLink = new HttpLink({
  uri: 'http://localhost:3333/graphql', // GraphQL endpoint
  credentials: 'include', // Include cookies for session-based auth
})

/**
 * Auth Link - Adds authentication headers to requests
 */
const authLink = setContext(async (_, { headers }) => {
  const tokens = getAuthTokens()

  if (!tokens?.accessToken) {
    return {
      headers: {
        ...headers,
      },
    }
  }

  return {
    headers: {
      ...headers,
      authorization: `Bearer ${tokens.accessToken}`,
    },
  }
})

/**
 * Token Refresh Link - Handles token refresh on 401 errors
 */
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
            const newTokens = await refreshAccessToken()

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

/**
 * Error Link - Global error handling
 */
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
          // Handle authentication errors
          clearAuthTokens()
          window.dispatchEvent(new CustomEvent('apollo:unauthenticated'))
          break
        case 'FORBIDDEN':
          // Handle authorization errors
          window.dispatchEvent(new CustomEvent('apollo:forbidden'))
          break
        case 'VALIDATION_ERROR':
          // Handle validation errors
          window.dispatchEvent(new CustomEvent('apollo:validation-error', {
            detail: { message, path }
          }))
          break
        default:
          // Handle other GraphQL errors
          window.dispatchEvent(new CustomEvent('apollo:graphql-error', {
            detail: { message, path, extensions }
          }))
      }
    })
  }

  if (networkError) {
    console.error(`Network error: ${networkError}`)
    
    // Handle network errors
    window.dispatchEvent(new CustomEvent('apollo:network-error', {
      detail: { error: networkError }
    }))

    // Retry on network errors (handled by RetryLink)
  }
})

/**
 * Retry Link - Automatically retry failed requests
 */
const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: Infinity,
    jitter: true,
  },
  attempts: {
    max: 3,
    retryIf: (error, _operation) => {
      // Retry on network errors and specific server errors
      return (
        !!error.networkError &&
        error.networkError.statusCode !== 401 && // Don't retry auth errors
        error.networkError.statusCode !== 403    // Don't retry forbidden errors
      )
    },
  },
})

/**
 * Apollo Cache Configuration with type policies
 */
const cache = new InMemoryCache({
  typePolicies: {
    User: {
      fields: {
        // Cache user data by ID
        id: {
          read: (value) => value,
        },
      },
    },
    Message: {
      fields: {
        // Cache messages with timestamp-based ordering
        createdAt: {
          read: (value) => value,
        },
      },
    },
    Query: {
      fields: {
        messages: {
          // Merge incoming messages with existing ones
          merge: (existing = [], incoming) => {
            return [...existing, ...incoming]
          },
        },
        users: {
          // Replace existing users list with new data
          merge: (_existing, incoming) => incoming,
        },
      },
    },
  },
  // Enable cache normalization
  addTypename: true,
  // Cache data for 5 minutes by default
  dataIdFromObject: (object: any) => {
    if (object.__typename && object.id) {
      return `${object.__typename}:${object.id}`
    }
    return null
  },
})

/**
 * Create Apollo Client instance
 */
export const apolloClient = new ApolloClient({
  link: from([
    errorLink,
    retryLink,
    tokenRefreshLink,
    authLink,
    httpLink,
  ]),
  cache,
  defaultOptions: {
    watchQuery: {
      // Cache first, then network
      fetchPolicy: 'cache-first',
      // Show loading state only on first load
      notifyOnNetworkStatusChange: true,
      // Retry failed queries
      errorPolicy: 'all',
    },
    query: {
      // Cache first, then network
      fetchPolicy: 'cache-first',
      // Include partial data on errors
      errorPolicy: 'all',
    },
    mutate: {
      // Always fetch from network for mutations
      fetchPolicy: 'network-only',
      // Include partial results on errors
      errorPolicy: 'all',
    },
  },
  // Enable Apollo DevTools in development
  connectToDevTools: process.env.NODE_ENV === 'development',
})

/**
 * Clear Apollo cache and reset store
 */
export function clearApolloCache(): void {
  apolloClient.clearStore()
}

/**
 * Reset Apollo store completely
 */
export function resetApolloStore(): void {
  apolloClient.resetStore()
}

/**
 * Export helper functions
 */
export {
  getAuthTokens,
  saveAuthTokens,
  clearAuthTokens,
  refreshAccessToken,
}