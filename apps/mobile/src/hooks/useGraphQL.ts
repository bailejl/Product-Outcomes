/**
 * Custom GraphQL Hooks
 * Provides optimized GraphQL operations with offline support and error handling
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  useQuery, 
  useMutation, 
  useSubscription, 
  QueryHookOptions, 
  MutationHookOptions,
  SubscriptionHookOptions,
  DocumentNode,
  ApolloError,
  OperationVariables,
  ApolloQueryResult,
  FetchResult,
} from '@apollo/client'
import { useNetwork } from '../store'
import { offlineQueue, queueMutation } from '../services/offline-queue'
import { networkMonitor } from '../services/network-monitor'

// Types
interface UseOfflineQueryOptions<TData, TVariables> extends QueryHookOptions<TData, TVariables> {
  enableOfflineQueue?: boolean
  retryOnReconnect?: boolean
  cacheFirst?: boolean
}

interface UseOfflineMutationOptions<TData, TVariables> extends MutationHookOptions<TData, TVariables> {
  enableOfflineQueue?: boolean
  optimisticResponse?: any
  priority?: 'high' | 'medium' | 'low'
  category?: string
}

interface UseRealtimeSubscriptionOptions<TData, TVariables> extends SubscriptionHookOptions<TData, TVariables> {
  autoReconnect?: boolean
  fallbackToPolling?: boolean
  pollingInterval?: number
}

interface NetworkAwareOptions {
  pauseOnOffline?: boolean
  resumeOnReconnect?: boolean
  showOfflineIndicator?: boolean
}

// Enhanced Query Hook
export function useOfflineQuery<TData = any, TVariables = OperationVariables>(
  query: DocumentNode,
  options: UseOfflineQueryOptions<TData, TVariables> = {}
) {
  const { isOnline } = useNetwork()
  const [lastSuccessfulData, setLastSuccessfulData] = useState<TData | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  
  const {
    enableOfflineQueue = true,
    retryOnReconnect = true,
    cacheFirst = true,
    ...apolloOptions
  } = options
  
  // Modify fetch policy based on network status
  const fetchPolicy = isOnline 
    ? (cacheFirst ? 'cache-first' : apolloOptions.fetchPolicy || 'cache-first')
    : 'cache-only'
  
  const queryResult = useQuery<TData, TVariables>(query, {
    ...apolloOptions,
    fetchPolicy,
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  })
  
  const { data, error, loading, refetch } = queryResult
  
  // Store successful data for offline use
  useEffect(() => {
    if (data && !error) {
      setLastSuccessfulData(data)
    }
  }, [data, error])
  
  // Retry on reconnect
  useEffect(() => {
    if (isOnline && retryOnReconnect && error) {
      const timer = setTimeout(async () => {
        setIsRetrying(true)
        try {
          await refetch()
        } catch (err) {
          console.warn('Retry failed:', err)
        } finally {
          setIsRetrying(false)
        }
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, [isOnline, retryOnReconnect, error, refetch])
  
  return {
    ...queryResult,
    data: data || (isOnline ? null : lastSuccessfulData),
    isOffline: !isOnline,
    isRetrying,
    hasOfflineData: !isOnline && !!lastSuccessfulData,
  }
}

// Enhanced Mutation Hook
export function useOfflineMutation<TData = any, TVariables = OperationVariables>(
  mutation: DocumentNode,
  options: UseOfflineMutationOptions<TData, TVariables> = {}
) {
  const { isOnline } = useNetwork()
  const [isQueued, setIsQueued] = useState(false)
  
  const {
    enableOfflineQueue = true,
    optimisticResponse,
    priority = 'medium',
    category = 'mutation',
    ...apolloOptions
  } = options
  
  const [apolloMutate, apolloResult] = useMutation<TData, TVariables>(mutation, {
    ...apolloOptions,
    errorPolicy: 'all',
  })
  
  const mutate = useCallback(async (mutationOptions?: any) => {
    if (isOnline) {
      // Execute immediately when online
      setIsQueued(false)
      return apolloMutate(mutationOptions)
    } else if (enableOfflineQueue) {
      // Queue for later execution when offline
      setIsQueued(true)
      
      try {
        const queueId = await queueMutation(mutation, mutationOptions?.variables || {}, {
          optimisticResponse,
          priority,
          category,
          update: mutationOptions?.update,
          context: mutationOptions?.context,
        })
        
        console.log(`📥 Mutation queued for offline execution: ${queueId}`)
        
        // Return a mock result for offline operations
        return {
          data: optimisticResponse,
          loading: false,
          called: true,
        } as FetchResult<TData>
        
      } catch (error) {
        console.error('Failed to queue mutation:', error)
        throw error
      }
    } else {
      // Reject if offline and queue disabled
      throw new Error('Operation requires internet connection')
    }
  }, [isOnline, enableOfflineQueue, apolloMutate, mutation, optimisticResponse, priority, category])
  
  return [mutate, { ...apolloResult, isQueued, isOffline: !isOnline }] as const
}

// Realtime Subscription Hook
export function useRealtimeSubscription<TData = any, TVariables = OperationVariables>(
  subscription: DocumentNode,
  options: UseRealtimeSubscriptionOptions<TData, TVariables> = {}
) {
  const { isOnline } = useNetwork()
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [fallbackData, setFallbackData] = useState<TData | null>(null)
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  const {
    autoReconnect = true,
    fallbackToPolling = true,
    pollingInterval = 30000,
    ...subscriptionOptions
  } = options
  
  // Use subscription when online
  const subscriptionResult = useSubscription<TData, TVariables>(subscription, {
    ...subscriptionOptions,
    skip: !isOnline || isReconnecting,
    onSubscriptionData: (result) => {
      if (result.subscriptionData.data) {
        setFallbackData(result.subscriptionData.data)
      }
      subscriptionOptions.onSubscriptionData?.(result)
    },
  })
  
  // Fallback to polling when offline
  useEffect(() => {
    if (!isOnline && fallbackToPolling) {
      pollingTimerRef.current = setInterval(() => {
        // Could implement polling logic here
        console.log('📊 Polling for updates while offline')
      }, pollingInterval)
      
      return () => {
        if (pollingTimerRef.current) {
          clearInterval(pollingTimerRef.current)
        }
      }
    }
  }, [isOnline, fallbackToPolling, pollingInterval])
  
  // Auto-reconnect logic
  useEffect(() => {
    if (isOnline && autoReconnect && subscriptionResult.error) {
      setIsReconnecting(true)
      
      const timer = setTimeout(() => {
        setIsReconnecting(false)
      }, 2000)
      
      return () => clearTimeout(timer)
    }
  }, [isOnline, autoReconnect, subscriptionResult.error])
  
  return {
    ...subscriptionResult,
    data: subscriptionResult.data || (!isOnline ? fallbackData : null),
    isOffline: !isOnline,
    isReconnecting,
    hasFallbackData: !isOnline && !!fallbackData,
  }
}

// Network-aware operation hook
export function useNetworkAwareOperation<T>(
  operation: () => Promise<T>,
  options: NetworkAwareOptions = {}
) {
  const { isOnline } = useNetwork()
  const [isExecuting, setIsExecuting] = useState(false)
  const [result, setResult] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  
  const {
    pauseOnOffline = true,
    resumeOnReconnect = true,
    showOfflineIndicator = true,
  } = options
  
  const execute = useCallback(async () => {
    if (pauseOnOffline && !isOnline) {
      if (showOfflineIndicator) {
        console.log('⏸️ Operation paused - device is offline')
      }
      return
    }
    
    setIsExecuting(true)
    setError(null)
    
    try {
      const operationResult = await operation()
      setResult(operationResult)
      return operationResult
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Operation failed')
      setError(error)
      throw error
    } finally {
      setIsExecuting(false)
    }
  }, [operation, isOnline, pauseOnOffline, showOfflineIndicator])
  
  // Resume on reconnect
  useEffect(() => {
    if (isOnline && resumeOnReconnect && error && !isExecuting) {
      console.log('🔄 Resuming operation after reconnect')
      execute()
    }
  }, [isOnline, resumeOnReconnect, error, isExecuting, execute])
  
  return {
    execute,
    result,
    error,
    isExecuting,
    isOffline: !isOnline,
    canExecute: !pauseOnOffline || isOnline,
  }
}

// Connection quality hook
export function useConnectionQuality() {
  const [quality, setQuality] = useState(networkMonitor.getCurrentQuality())
  
  useEffect(() => {
    const unsubscribe = networkMonitor.addListener(setQuality)
    return unsubscribe
  }, [])
  
  return {
    quality,
    isConnected: quality?.isConnected ?? false,
    hasInternet: quality?.isInternetReachable ?? false,
    strength: quality?.strength ?? 'unknown',
    speed: quality?.speed ?? 'unknown',
    latency: quality?.latency ?? 0,
    type: quality?.type ?? 'unknown',
  }
}

// Retry hook for failed operations
export function useRetryableOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
) {
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [lastError, setLastError] = useState<Error | null>(null)
  
  const executeWithRetry = useCallback(async (): Promise<T> => {
    let attempts = 0
    
    while (attempts <= maxRetries) {
      try {
        setIsRetrying(attempts > 0)
        setRetryCount(attempts)
        
        const result = await operation()
        
        // Success - reset state
        setIsRetrying(false)
        setRetryCount(0)
        setLastError(null)
        
        return result
        
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Operation failed')
        setLastError(err)
        
        attempts++
        
        if (attempts > maxRetries) {
          setIsRetrying(false)
          throw err
        }
        
        // Wait before retry with exponential backoff
        const retryDelay = delay * Math.pow(2, attempts - 1)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
    }
    
    throw lastError || new Error('Max retries exceeded')
  }, [operation, maxRetries, delay, lastError])
  
  return {
    executeWithRetry,
    isRetrying,
    retryCount,
    lastError,
    maxRetries,
  }
}

// Error boundary hook for GraphQL operations
export function useGraphQLErrorHandler() {
  const [lastError, setLastError] = useState<ApolloError | null>(null)
  
  const handleError = useCallback((error: ApolloError) => {
    setLastError(error)
    
    // Log error details
    console.error('GraphQL Error:', {
      message: error.message,
      graphQLErrors: error.graphQLErrors,
      networkError: error.networkError,
      extraInfo: error.extraInfo,
    })
    
    // Handle specific error types
    if (error.networkError) {
      console.log('🔌 Network error detected')
    }
    
    if (error.graphQLErrors?.length > 0) {
      error.graphQLErrors.forEach(graphQLError => {
        const { extensions } = graphQLError
        
        switch (extensions?.code) {
          case 'UNAUTHENTICATED':
            console.log('🔐 Authentication error')
            break
          case 'FORBIDDEN':
            console.log('🚫 Authorization error')
            break
          case 'VALIDATION_ERROR':
            console.log('📝 Validation error')
            break
          default:
            console.log('❌ GraphQL error:', graphQLError.message)
        }
      })
    }
  }, [])
  
  const clearError = useCallback(() => {
    setLastError(null)
  }, [])
  
  return {
    lastError,
    handleError,
    clearError,
    hasError: !!lastError,
  }
}

// Optimistic update hook
export function useOptimisticUpdate<T>(initialData: T) {
  const [optimisticData, setOptimisticData] = useState<T>(initialData)
  const [isOptimistic, setIsOptimistic] = useState(false)
  
  const applyOptimisticUpdate = useCallback((updater: (data: T) => T) => {
    setOptimisticData(current => updater(current))
    setIsOptimistic(true)
  }, [])
  
  const confirmUpdate = useCallback((confirmedData: T) => {
    setOptimisticData(confirmedData)
    setIsOptimistic(false)
  }, [])
  
  const revertUpdate = useCallback(() => {
    setOptimisticData(initialData)
    setIsOptimistic(false)
  }, [initialData])
  
  return {
    data: optimisticData,
    isOptimistic,
    applyOptimisticUpdate,
    confirmUpdate,
    revertUpdate,
  }
}