/**
 * GraphQL Module Exports
 * Centralized exports for all GraphQL-related functionality
 */

// Apollo Client
export { apolloClient, clearApolloCache, resetApolloStore } from '../lib/apollo-client'
export { default as APOLLO_CONFIG, createApolloCache, performanceMonitor, cacheUtils } from '../lib/apollo-config'

// Type definitions and fragments
export * from './types'
export { USER_FRAGMENT, MESSAGE_FRAGMENT, AUTH_TOKENS_FRAGMENT } from './types'

// Queries
export * from './queries'

// Mutations  
export * from './mutations'

// Subscriptions
export * from './subscriptions'

// Custom hooks
export * from '../hooks/useGraphQL'

// Components
export { GraphQLErrorBoundary, withGraphQLErrorBoundary } from '../components/GraphQLErrorBoundary'
export { 
  GraphQLLoading, 
  NetworkStatusIndicator, 
  SkeletonList, 
  UserProfileSkeleton,
  MessageListSkeleton,
  DashboardSkeleton,
  ProgressiveLoading,
  withGraphQLLoading 
} from '../components/GraphQLLoading'
export { GraphQLDemo } from '../components/GraphQLDemo'

// Auth context
export { GraphQLAuthProvider, useGraphQLAuth } from '../contexts/GraphQLAuthContext'

// Re-export commonly used Apollo Client exports
export {
  useQuery,
  useMutation,
  useSubscription,
  useLazyQuery,
  ApolloProvider,
  ApolloConsumer,
  gql,
  NetworkStatus,
} from '@apollo/client'

// Helper types
export type {
  QueryResult,
  MutationResult,
  SubscriptionResult,
  ApolloError,
  DocumentNode,
  OperationVariables,
} from '@apollo/client'