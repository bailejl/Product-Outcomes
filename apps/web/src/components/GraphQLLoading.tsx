/**
 * GraphQL Loading Components
 * Provides loading states optimized for GraphQL operations
 */

import React from 'react'
import {
  Box,
  Text,
  Spinner,
  VStack,
  HStack,
  Skeleton,
  Card,
} from '@gluestack-ui/themed'
import { NetworkStatus } from '@apollo/client'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  showProgress?: boolean
}

interface NetworkStatusProps {
  networkStatus: NetworkStatus
  error?: any
}

interface SkeletonListProps {
  count?: number
  height?: string | number
  spacing?: string
}

// Basic loading spinner with optional text
export function GraphQLLoading({ size = 'md', text = 'Loading...', showProgress = false }: LoadingProps) {
  return (
    <VStack space="md" alignItems="center" p="$4">
      <Spinner size={size} />
      {text && (
        <Text fontSize="$sm" color="$textLight600" textAlign="center">
          {text}
        </Text>
      )}
      {showProgress && (
        <Box w="$full" maxWidth="$64">
          <Box h="$1" bg="$backgroundLight200" borderRadius="$full">
            <Box 
              h="$full" 
              bg="$primary500" 
              borderRadius="$full" 
              w="$1/2"
              style={{
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          </Box>
        </Box>
      )}
    </VStack>
  )
}

// Network status indicator
export function NetworkStatusIndicator({ networkStatus, error }: NetworkStatusProps) {
  const getStatusInfo = () => {
    switch (networkStatus) {
      case NetworkStatus.loading:
        return { text: 'Loading...', color: '$blue500', icon: '⏳' }
      case NetworkStatus.fetchMore:
        return { text: 'Loading more...', color: '$blue500', icon: '⏳' }
      case NetworkStatus.refetch:
        return { text: 'Refreshing...', color: '$blue500', icon: '🔄' }
      case NetworkStatus.setVariables:
        return { text: 'Updating...', color: '$blue500', icon: '⚡' }
      case NetworkStatus.poll:
        return { text: 'Syncing...', color: '$green500', icon: '🔄' }
      case NetworkStatus.error:
        return { text: 'Error occurred', color: '$red500', icon: '❌' }
      case NetworkStatus.ready:
        return null
      default:
        return { text: 'Loading...', color: '$blue500', icon: '⏳' }
    }
  }

  const status = getStatusInfo()

  if (!status && !error) {
    return null
  }

  return (
    <HStack
      space="xs"
      alignItems="center"
      bg="$backgroundLight50"
      px="$3"
      py="$2"
      borderRadius="$md"
      borderColor="$borderLight200"
      borderWidth="$1"
    >
      <Text fontSize="$sm">{status?.icon || '❌'}</Text>
      <Text fontSize="$sm" color={status?.color || '$red500'}>
        {error ? 'Failed to load' : status?.text}
      </Text>
    </HStack>
  )
}

// Skeleton loading for lists
export function SkeletonList({ count = 3, height = '$16', spacing = 'md' }: SkeletonListProps) {
  return (
    <VStack space={spacing}>
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} p="$4" variant="outline">
          <VStack space="sm">
            <HStack space="sm" alignItems="center">
              <Skeleton borderRadius="$full" h="$10" w="$10" />
              <VStack space="xs" flex={1}>
                <Skeleton h="$4" w="$3/4" borderRadius="$sm" />
                <Skeleton h="$3" w="$1/2" borderRadius="$sm" />
              </VStack>
            </HStack>
            <Skeleton h={height} w="$full" borderRadius="$sm" />
          </VStack>
        </Card>
      ))}
    </VStack>
  )
}

// Skeleton for user profile
export function UserProfileSkeleton() {
  return (
    <Card p="$6" variant="outline">
      <VStack space="lg">
        <HStack space="md" alignItems="center">
          <Skeleton borderRadius="$full" h="$20" w="$20" />
          <VStack space="sm" flex={1}>
            <Skeleton h="$6" w="$3/4" borderRadius="$md" />
            <Skeleton h="$4" w="$1/2" borderRadius="$sm" />
            <Skeleton h="$3" w="$2/3" borderRadius="$sm" />
          </VStack>
        </HStack>
        
        <VStack space="sm">
          <Skeleton h="$4" w="$full" borderRadius="$sm" />
          <Skeleton h="$4" w="$5/6" borderRadius="$sm" />
          <Skeleton h="$4" w="$4/5" borderRadius="$sm" />
        </VStack>
        
        <HStack space="sm">
          <Skeleton h="$10" w="$24" borderRadius="$md" />
          <Skeleton h="$10" w="$20" borderRadius="$md" />
        </HStack>
      </VStack>
    </Card>
  )
}

// Skeleton for message list
export function MessageListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <VStack space="md">
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} p="$4" variant="outline">
          <VStack space="sm">
            <HStack space="sm" alignItems="center">
              <Skeleton borderRadius="$full" h="$8" w="$8" />
              <VStack space="xs">
                <Skeleton h="$3" w="$20" borderRadius="$sm" />
                <Skeleton h="$2" w="$16" borderRadius="$sm" />
              </VStack>
            </HStack>
            <Skeleton h="$12" w="$full" borderRadius="$sm" />
            <HStack space="sm" justifyContent="space-between">
              <Skeleton h="$3" w="$12" borderRadius="$sm" />
              <HStack space="xs">
                <Skeleton h="$6" w="$6" borderRadius="$sm" />
                <Skeleton h="$6" w="$6" borderRadius="$sm" />
                <Skeleton h="$6" w="$6" borderRadius="$sm" />
              </HStack>
            </HStack>
          </VStack>
        </Card>
      ))}
    </VStack>
  )
}

// Skeleton for dashboard
export function DashboardSkeleton() {
  return (
    <VStack space="lg">
      {/* Stats cards */}
      <HStack space="md" flexWrap="wrap">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} flex={1} minWidth="$48" p="$4" variant="outline">
            <VStack space="sm">
              <HStack justifyContent="space-between" alignItems="center">
                <Skeleton h="$4" w="$20" borderRadius="$sm" />
                <Skeleton h="$6" w="$6" borderRadius="$sm" />
              </HStack>
              <Skeleton h="$8" w="$16" borderRadius="$md" />
              <Skeleton h="$3" w="$24" borderRadius="$sm" />
            </VStack>
          </Card>
        ))}
      </HStack>
      
      {/* Charts */}
      <Card p="$6" variant="outline">
        <VStack space="md">
          <Skeleton h="$6" w="$32" borderRadius="$md" />
          <Skeleton h="$64" w="$full" borderRadius="$lg" />
        </VStack>
      </Card>
      
      {/* Recent activity */}
      <Card p="$6" variant="outline">
        <VStack space="md">
          <Skeleton h="$5" w="$28" borderRadius="$md" />
          <SkeletonList count={3} height="$8" />
        </VStack>
      </Card>
    </VStack>
  )
}

// Progressive loading with stages
interface ProgressiveLoadingProps {
  stage: 'initial' | 'auth' | 'data' | 'complete'
  error?: boolean
}

export function ProgressiveLoading({ stage, error }: ProgressiveLoadingProps) {
  const stages = [
    { key: 'initial', label: 'Initializing...', icon: '🚀' },
    { key: 'auth', label: 'Authenticating...', icon: '🔐' },
    { key: 'data', label: 'Loading data...', icon: '📊' },
    { key: 'complete', label: 'Ready!', icon: '✅' },
  ]

  const currentStageIndex = stages.findIndex(s => s.key === stage)

  return (
    <VStack space="lg" alignItems="center" p="$6">
      <VStack space="md" alignItems="center">
        {stages.map((stageInfo, index) => {
          const isActive = index === currentStageIndex
          const isComplete = index < currentStageIndex
          const isFailed = error && isActive

          return (
            <HStack key={stageInfo.key} space="md" alignItems="center">
              <Box
                h="$8"
                w="$8"
                borderRadius="$full"
                alignItems="center"
                justifyContent="center"
                bg={
                  isFailed
                    ? '$red500'
                    : isComplete
                    ? '$green500'
                    : isActive
                    ? '$blue500'
                    : '$gray300'
                }
              >
                <Text fontSize="$sm" color="$white">
                  {isFailed ? '❌' : isComplete ? '✅' : isActive ? '⏳' : stageInfo.icon}
                </Text>
              </Box>
              <Text
                fontSize="$md"
                color={
                  isFailed
                    ? '$red600'
                    : isComplete
                    ? '$green600'
                    : isActive
                    ? '$blue600'
                    : '$gray500'
                }
                fontWeight={isActive ? '$semibold' : '$normal'}
              >
                {isFailed ? 'Failed to load' : stageInfo.label}
              </Text>
              {isActive && !isFailed && <Spinner size="sm" />}
            </HStack>
          )
        })}
      </VStack>
      
      {error && (
        <Text fontSize="$sm" color="$red600" textAlign="center">
          Something went wrong. Please try again.
        </Text>
      )}
    </VStack>
  )
}

// Higher-order component for adding loading states
export function withGraphQLLoading<P extends object>(
  Component: React.ComponentType<P>,
  LoadingComponent: React.ComponentType = GraphQLLoading
) {
  return function WithLoadingComponent(props: P & { loading?: boolean }) {
    const { loading, ...componentProps } = props

    if (loading) {
      return <LoadingComponent />
    }

    return <Component {...(componentProps as P)} />
  }
}