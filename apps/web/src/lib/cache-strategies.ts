/**
 * Apollo Cache Management Strategies
 * Advanced caching patterns and optimization strategies
 */

import { InMemoryCache, Reference, StoreObject } from '@apollo/client'
import { GET_RECENT_MESSAGES, GET_USERS, GET_ME } from '../graphql/queries'

// Cache update strategies for different operations
export const cacheStrategies = {
  // Message-related cache updates
  messages: {
    // Add a new message to the messages list
    addMessage: (cache: InMemoryCache, newMessage: any) => {
      const existingMessages = cache.readQuery({
        query: GET_RECENT_MESSAGES,
        variables: { limit: 20 },
      })

      if (existingMessages) {
        cache.writeQuery({
          query: GET_RECENT_MESSAGES,
          variables: { limit: 20 },
          data: {
            messages: {
              ...existingMessages.messages,
              edges: [
                { node: newMessage, cursor: newMessage.id, __typename: 'MessageEdge' },
                ...existingMessages.messages.edges,
              ],
              pageInfo: {
                ...existingMessages.messages.pageInfo,
                totalCount: existingMessages.messages.pageInfo.totalCount + 1,
              },
            },
          },
        })
      }
    },

    // Update a message in the cache
    updateMessage: (cache: InMemoryCache, updatedMessage: any) => {
      cache.writeFragment({
        id: `Message:${updatedMessage.id}`,
        fragment: gql`
          fragment UpdatedMessage on Message {
            id
            content
            updatedAt
            isEdited
          }
        `,
        data: {
          ...updatedMessage,
          isEdited: true,
        },
      })
    },

    // Remove a message from the cache
    removeMessage: (cache: InMemoryCache, messageId: string) => {
      // Remove from specific queries
      const existingMessages = cache.readQuery({
        query: GET_RECENT_MESSAGES,
        variables: { limit: 20 },
      })

      if (existingMessages) {
        cache.writeQuery({
          query: GET_RECENT_MESSAGES,
          variables: { limit: 20 },
          data: {
            messages: {
              ...existingMessages.messages,
              edges: existingMessages.messages.edges.filter(
                (edge: any) => edge.node.id !== messageId
              ),
              pageInfo: {
                ...existingMessages.messages.pageInfo,
                totalCount: Math.max(0, existingMessages.messages.pageInfo.totalCount - 1),
              },
            },
          },
        })
      }

      // Evict the message entity
      cache.evict({ id: `Message:${messageId}` })
      cache.gc()
    },
  },

  // User-related cache updates
  users: {
    // Update user profile
    updateProfile: (cache: InMemoryCache, updatedUser: any) => {
      // Update the current user query
      cache.writeQuery({
        query: GET_ME,
        data: { me: updatedUser },
      })

      // Update user in users list if present
      cache.writeFragment({
        id: `User:${updatedUser.id}`,
        fragment: gql`
          fragment UpdatedUser on User {
            id
            email
            firstName
            lastName
            fullName
            displayName
            updatedAt
          }
        `,
        data: updatedUser,
      })
    },

    // Update user status
    updateStatus: (cache: InMemoryCache, userId: string, updates: any) => {
      cache.writeFragment({
        id: `User:${userId}`,
        fragment: gql`
          fragment UserStatus on User {
            id
            isActive
            role
            updatedAt
          }
        `,
        data: {
          id: userId,
          ...updates,
          updatedAt: new Date().toISOString(),
        },
      })
    },

    // Add new user to cache (e.g., from subscription)
    addUser: (cache: InMemoryCache, newUser: any) => {
      const existingUsers = cache.readQuery({
        query: GET_USERS,
        variables: { pagination: { first: 20 } },
      })

      if (existingUsers) {
        cache.writeQuery({
          query: GET_USERS,
          variables: { pagination: { first: 20 } },
          data: {
            users: {
              ...existingUsers.users,
              edges: [
                { node: newUser, cursor: newUser.id, __typename: 'UserEdge' },
                ...existingUsers.users.edges,
              ],
              pageInfo: {
                ...existingUsers.users.pageInfo,
                totalCount: existingUsers.users.pageInfo.totalCount + 1,
              },
            },
          },
        })
      }
    },
  },

  // Authentication-related cache updates
  auth: {
    // Clear all auth-related cache on logout
    clearAuthCache: (cache: InMemoryCache) => {
      // Remove current user
      cache.evict({ fieldName: 'me' })
      
      // Remove sensitive user data
      cache.evict({ fieldName: 'sessionInfo' })
      
      // Clear any user-specific cached data
      cache.gc()
    },

    // Update tokens in cache
    updateTokens: (cache: InMemoryCache, tokens: any) => {
      // Store tokens in cache for use by auth link
      cache.writeFragment({
        id: 'AuthTokens:current',
        fragment: gql`
          fragment CurrentTokens on AuthTokens {
            accessToken
            refreshToken
            expiresIn
          }
        `,
        data: tokens,
      })
    },
  },
}

// Optimistic response generators
export const optimisticResponses = {
  createMessage: (content: string, user: any) => ({
    createMessage: {
      id: `temp-${Date.now()}`,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      user: user || {
        id: 'temp-user',
        firstName: 'You',
        lastName: '',
        email: '',
        displayName: 'You',
      },
      __typename: 'Message',
    },
  }),

  updateMessage: (id: string, content: string) => ({
    updateMessage: {
      id,
      content,
      updatedAt: new Date().toISOString(),
      isEdited: true,
      __typename: 'Message',
    },
  }),

  deleteMessage: (id: string) => ({
    deleteMessage: {
      success: true,
      message: 'Message deleted successfully',
      __typename: 'BaseResponse',
    },
  }),

  updateProfile: (userId: string, updates: any) => ({
    updateProfile: {
      id: userId,
      ...updates,
      updatedAt: new Date().toISOString(),
      __typename: 'User',
    },
  }),
}

// Cache warming strategies
export const cacheWarming = {
  // Pre-load essential data
  warmCache: async (apolloClient: any, user?: any) => {
    const promises = []

    // Pre-load recent messages
    promises.push(
      apolloClient.query({
        query: GET_RECENT_MESSAGES,
        variables: { limit: 10 },
        fetchPolicy: 'cache-first',
      })
    )

    // Pre-load user profile if authenticated
    if (user) {
      promises.push(
        apolloClient.query({
          query: GET_ME,
          fetchPolicy: 'cache-first',
        })
      )
    }

    try {
      await Promise.all(promises)
      console.log('✅ Cache warmed successfully')
    } catch (error) {
      console.warn('⚠️ Cache warming failed:', error)
    }
  },

  // Pre-load data for specific routes
  preloadRoute: async (apolloClient: any, route: string, params?: any) => {
    switch (route) {
      case '/messages':
        return apolloClient.query({
          query: GET_RECENT_MESSAGES,
          variables: { limit: 20 },
          fetchPolicy: 'cache-first',
        })

      case '/users':
        return apolloClient.query({
          query: GET_USERS,
          variables: { pagination: { first: 20 } },
          fetchPolicy: 'cache-first',
        })

      case '/profile':
        if (params?.userId) {
          return apolloClient.query({
            query: GET_USER,
            variables: { id: params.userId },
            fetchPolicy: 'cache-first',
          })
        }
        break

      default:
        console.log(`No preload strategy for route: ${route}`)
    }
  },
}

// Cache persistence utilities
export const cachePersistence = {
  // Save cache to localStorage
  saveCache: (cache: InMemoryCache) => {
    try {
      const cacheData = cache.extract()
      localStorage.setItem('apollo-cache', JSON.stringify(cacheData))
      console.log('💾 Cache saved to localStorage')
    } catch (error) {
      console.error('Failed to save cache:', error)
    }
  },

  // Load cache from localStorage
  loadCache: (cache: InMemoryCache) => {
    try {
      const cacheData = localStorage.getItem('apollo-cache')
      if (cacheData) {
        cache.restore(JSON.parse(cacheData))
        console.log('📂 Cache loaded from localStorage')
      }
    } catch (error) {
      console.error('Failed to load cache:', error)
      // Clear invalid cache data
      localStorage.removeItem('apollo-cache')
    }
  },

  // Clear persisted cache
  clearCache: () => {
    localStorage.removeItem('apollo-cache')
    console.log('🗑️ Persisted cache cleared')
  },
}

// Import gql for fragments
import { gql } from '@apollo/client'