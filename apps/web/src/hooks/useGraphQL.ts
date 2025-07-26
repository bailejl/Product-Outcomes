/**
 * Custom GraphQL Hooks
 * Convenient hooks for GraphQL operations with Apollo Client
 */

import {
  useQuery,
  useMutation,
  useSubscription,
  useLazyQuery,
  QueryHookOptions,
  MutationHookOptions,
  SubscriptionHookOptions,
  FetchResult,
  ApolloError,
  OperationVariables,
  gql,
} from '@apollo/client'
import { useCallback, useEffect, useState } from 'react'

// Import GraphQL operations
import {
  GET_ME,
  GET_USERS,
  GET_USER,
  GET_MESSAGES,
  GET_MESSAGE,
  GET_RECENT_MESSAGES,
  GET_SESSION_INFO,
  GET_SYSTEM_STATS,
  GET_DASHBOARD_DATA,
  SEARCH_USERS,
  SEARCH_MESSAGES,
} from '../graphql/queries'

import {
  REGISTER,
  LOGIN,
  LOGOUT,
  REFRESH_TOKEN,
  UPDATE_PROFILE,
  CHANGE_PASSWORD,
  REQUEST_PASSWORD_RESET,
  RESET_PASSWORD,
  CREATE_MESSAGE,
  UPDATE_MESSAGE,
  DELETE_MESSAGE,
  TOGGLE_USER_ACTIVE,
  PROMOTE_USER,
} from '../graphql/mutations'

import {
  MESSAGE_ADDED,
  MESSAGE_UPDATED,
  MESSAGE_DELETED,
  USER_STATUS_CHANGED,
  USER_REGISTERED,
  SYSTEM_ALERT,
} from '../graphql/subscriptions'

// Types
interface AuthResult {
  user: any
  tokens: any
  message: string
}

interface BaseResponse {
  success: boolean
  message: string
}

interface PaginationInput {
  first?: number
  after?: string
  last?: number
  before?: string
}

interface MessageFilters {
  userId?: string
  status?: string
  searchTerm?: string
  createdAfter?: string
  createdBefore?: string
}

interface UserFilters {
  role?: string
  isActive?: boolean
  emailVerified?: boolean
  searchTerm?: string
}

// Authentication Hooks
export function useAuth() {
  const { data, loading, error, refetch } = useQuery(GET_ME, {
    errorPolicy: 'ignore', // Don't show errors for unauthenticated users
  })

  const [login] = useMutation<{ login: AuthResult }>(LOGIN)
  const [register] = useMutation<{ register: AuthResult }>(REGISTER)
  const [logout] = useMutation<{ logout: BaseResponse }>(LOGOUT)
  const [refreshToken] = useMutation(REFRESH_TOKEN)

  return {
    user: data?.me,
    isAuthenticated: !!data?.me,
    loading,
    error,
    refetch,
    login,
    register,
    logout,
    refreshToken,
  }
}

// User Management Hooks
export function useUsers(filters?: UserFilters, pagination?: PaginationInput) {
  return useQuery(GET_USERS, {
    variables: { filters, pagination },
    notifyOnNetworkStatusChange: true,
  })
}

export function useUser(id: string) {
  return useQuery(GET_USER, {
    variables: { id },
    skip: !id,
  })
}

export function useLazyUser() {
  return useLazyQuery(GET_USER)
}

// Message Hooks
export function useMessages(filters?: MessageFilters, pagination?: PaginationInput) {
  return useQuery(GET_MESSAGES, {
    variables: { filters, pagination },
    notifyOnNetworkStatusChange: true,
  })
}

export function useRecentMessages(limit = 20) {
  return useQuery(GET_RECENT_MESSAGES, {
    variables: { limit },
    pollInterval: 30000, // Poll every 30 seconds
  })
}

export function useMessage(id: string) {
  return useQuery(GET_MESSAGE, {
    variables: { id },
    skip: !id,
  })
}

// Profile Management Hooks
export function useUpdateProfile() {
  const [updateProfile, { loading, error }] = useMutation(UPDATE_PROFILE, {
    update: (cache, { data }) => {
      if (data?.updateProfile) {
        cache.writeQuery({
          query: GET_ME,
          data: { me: data.updateProfile },
        })
      }
    },
  })

  return { updateProfile, loading, error }
}

export function useChangePassword() {
  return useMutation<{ changePassword: BaseResponse }>(CHANGE_PASSWORD)
}

// Message Management Hooks
export function useCreateMessage() {
  const [createMessage, { loading, error }] = useMutation(CREATE_MESSAGE, {
    update: (cache, { data }) => {
      if (data?.createMessage) {
        // Add new message to recent messages cache
        const existing = cache.readQuery({
          query: GET_RECENT_MESSAGES,
          variables: { limit: 20 },
        })

        if (existing) {
          cache.writeQuery({
            query: GET_RECENT_MESSAGES,
            variables: { limit: 20 },
            data: {
              messages: {
                ...existing.messages,
                edges: [
                  { node: data.createMessage, cursor: data.createMessage.id },
                  ...existing.messages.edges,
                ],
              },
            },
          })
        }
      }
    },
    optimisticResponse: (variables) => ({
      createMessage: {
        id: `temp-${Date.now()}`,
        content: variables.input.content,
        userId: 'current-user', // Will be replaced by actual user
        user: null, // Will be populated by server
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        __typename: 'Message',
      },
    }),
  })

  return { createMessage, loading, error }
}

export function useUpdateMessage() {
  return useMutation(UPDATE_MESSAGE, {
    optimisticResponse: (variables) => ({
      updateMessage: {
        id: variables.input.id,
        content: variables.input.content,
        updatedAt: new Date().toISOString(),
        isEdited: true,
        __typename: 'Message',
      },
    }),
  })
}

export function useDeleteMessage() {
  const [deleteMessage, { loading, error }] = useMutation(DELETE_MESSAGE, {
    update: (cache, { data }, { variables }) => {
      if (data?.deleteMessage.success && variables?.id) {
        // Remove message from cache
        cache.evict({ id: `Message:${variables.id}` })
        cache.gc()
      }
    },
  })

  return { deleteMessage, loading, error }
}

// Search Hooks
export function useSearchUsers(searchTerm: string, limit = 10) {
  const [search, { data, loading, error }] = useLazyQuery(SEARCH_USERS, {
    variables: { searchTerm, limit },
  })

  const debouncedSearch = useCallback(
    debounce((term: string) => {
      if (term.length >= 2) {
        search({ variables: { searchTerm: term, limit } })
      }
    }, 300),
    [search, limit]
  )

  useEffect(() => {
    debouncedSearch(searchTerm)
  }, [searchTerm, debouncedSearch])

  return { users: data?.users?.edges?.map(edge => edge.node) || [], loading, error }
}

export function useSearchMessages(searchTerm: string, limit = 20) {
  const [search, { data, loading, error }] = useLazyQuery(SEARCH_MESSAGES, {
    variables: { searchTerm, limit },
  })

  const debouncedSearch = useCallback(
    debounce((term: string) => {
      if (term.length >= 2) {
        search({ variables: { searchTerm: term, limit } })
      }
    }, 300),
    [search, limit]
  )

  useEffect(() => {
    debouncedSearch(searchTerm)
  }, [searchTerm, debouncedSearch])

  return { messages: data?.messages?.edges?.map(edge => edge.node) || [], loading, error }
}

// Admin Hooks
export function useSystemStats() {
  return useQuery(GET_SYSTEM_STATS, {
    pollInterval: 60000, // Update every minute
  })
}

export function useToggleUserActive() {
  return useMutation(TOGGLE_USER_ACTIVE, {
    update: (cache, { data }) => {
      if (data?.toggleUserActive) {
        cache.writeFragment({
          id: `User:${data.toggleUserActive.id}`,
          fragment: gql`
            fragment UpdatedUser on User {
              isActive
            }
          `,
          data: { isActive: data.toggleUserActive.isActive },
        })
      }
    },
  })
}

export function usePromoteUser() {
  return useMutation(PROMOTE_USER)
}

// Dashboard Hook
export function useDashboard() {
  return useQuery(GET_DASHBOARD_DATA, {
    pollInterval: 30000, // Update every 30 seconds
  })
}

// Session Management Hook
export function useSessionInfo() {
  return useQuery(GET_SESSION_INFO)
}

// Subscription Hooks
export function useMessageSubscriptions() {
  const { data: newMessage } = useSubscription(MESSAGE_ADDED)
  const { data: updatedMessage } = useSubscription(MESSAGE_UPDATED)
  const { data: deletedMessageId } = useSubscription(MESSAGE_DELETED)

  return {
    newMessage: newMessage?.messageAdded,
    updatedMessage: updatedMessage?.messageUpdated,
    deletedMessageId: deletedMessageId?.messageDeleted,
  }
}

export function useUserSubscriptions() {
  const { data: statusChanged } = useSubscription(USER_STATUS_CHANGED)
  const { data: newUser } = useSubscription(USER_REGISTERED)

  return {
    statusChanged: statusChanged?.userStatusChanged,
    newUser: newUser?.userRegistered,
  }
}

export function useSystemAlerts(severity = 'high') {
  const { data } = useSubscription(SYSTEM_ALERT, {
    variables: { severity },
  })

  return data?.systemAlert
}

// Pagination Hook
export function usePagination<T>(
  query: any,
  variables: any,
  options?: QueryHookOptions
) {
  const { data, loading, error, fetchMore, refetch } = useQuery(query, {
    variables,
    ...options,
  })

  const [hasMore, setHasMore] = useState(true)

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return

    try {
      const result = await fetchMore({
        variables: {
          ...variables,
          pagination: {
            ...variables.pagination,
            after: data?.edges?.slice(-1)[0]?.cursor,
          },
        },
      })

      if (!result.data?.edges?.length || !result.data.pageInfo?.hasNextPage) {
        setHasMore(false)
      }
    } catch (err) {
      console.error('Failed to load more:', err)
    }
  }, [fetchMore, variables, data, hasMore, loading])

  useEffect(() => {
    setHasMore(data?.pageInfo?.hasNextPage ?? true)
  }, [data?.pageInfo?.hasNextPage])

  return {
    items: data?.edges?.map((edge: any) => edge.node) || [],
    loading,
    error,
    hasMore,
    loadMore,
    refetch,
    pageInfo: data?.pageInfo,
  }
}

// Utility function for debouncing
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Error handling hook
export function useGraphQLError() {
  const [errors, setErrors] = useState<ApolloError[]>([])

  const addError = useCallback((error: ApolloError) => {
    setErrors(prev => [...prev, error])
  }, [])

  const removeError = useCallback((index: number) => {
    setErrors(prev => prev.filter((_, i) => i !== index))
  }, [])

  const clearErrors = useCallback(() => {
    setErrors([])
  }, [])

  return { errors, addError, removeError, clearErrors }
}