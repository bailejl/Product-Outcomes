/**
 * Mobile GraphQL Subscriptions
 * Real-time updates optimized for mobile connections
 */

import { gql } from '@apollo/client'
import { USER_FRAGMENT, MESSAGE_FRAGMENT } from './queries'

// Message Subscriptions
export const MESSAGE_ADDED = gql`
  subscription MessageAdded($filters: MessageSubscriptionFilters) {
    messageAdded(filters: $filters) {
      ...MessageFragment
    }
  }
  ${MESSAGE_FRAGMENT}
`

export const MESSAGE_UPDATED = gql`
  subscription MessageUpdated($filters: MessageSubscriptionFilters) {
    messageUpdated(filters: $filters) {
      ...MessageFragment
      isEdited
      editHistory {
        id
        content
        editedAt
        editedBy {
          ...UserFragment
        }
      }
    }
  }
  ${MESSAGE_FRAGMENT}
  ${USER_FRAGMENT}
`

export const MESSAGE_DELETED = gql`
  subscription MessageDeleted($filters: MessageSubscriptionFilters) {
    messageDeleted(filters: $filters) {
      id
      deletedAt
      deletedBy {
        id
        firstName
        lastName
      }
    }
  }
`

// User Subscriptions
export const USER_STATUS_CHANGED = gql`
  subscription UserStatusChanged($userId: ID) {
    userStatusChanged(userId: $userId) {
      id
      status
      lastSeen
      isOnline
    }
  }
`

export const USER_TYPING = gql`
  subscription UserTyping {
    userTyping {
      userId
      isTyping
      timestamp
    }
  }
`

export const USER_PRESENCE_CHANGED = gql`
  subscription UserPresenceChanged {
    userPresenceChanged {
      user {
        id
        firstName
        lastName
        status
        lastSeen
      }
      presence {
        isOnline
        status
        device
        location
      }
      timestamp
    }
  }
`

// Notification Subscriptions
export const NOTIFICATION_RECEIVED = gql`
  subscription NotificationReceived {
    notificationReceived {
      id
      type
      title
      message
      data
      priority
      category
      isRead
      createdAt
      relatedUser {
        id
        firstName
        lastName
        fullName
      }
      actions {
        label
        action
        style
      }
    }
  }
`

export const NOTIFICATION_UPDATED = gql`
  subscription NotificationUpdated {
    notificationUpdated {
      id
      isRead
      updatedAt
    }
  }
`

// System Subscriptions
export const SYSTEM_ANNOUNCEMENT = gql`
  subscription SystemAnnouncement {
    systemAnnouncement {
      id
      type
      title
      message
      severity
      timestamp
      expiresAt
      targetUsers
      actions {
        label
        action
        style
      }
    }
  }
`

export const SERVER_STATUS_CHANGED = gql`
  subscription ServerStatusChanged {
    serverStatusChanged {
      status
      message
      timestamp
      affectedServices
      estimatedResolution
    }
  }
`

export const MAINTENANCE_SCHEDULED = gql`
  subscription MaintenanceScheduled {
    maintenanceScheduled {
      id
      title
      description
      scheduledStart
      estimatedDuration
      affectedServices
      severity
    }
  }
`

// Session and Security Subscriptions
export const SESSION_INVALIDATED = gql`
  subscription SessionInvalidated {
    sessionInvalidated {
      sessionId
      reason
      timestamp
      requiresReauth
    }
  }
`

export const SECURITY_EVENT = gql`
  subscription SecurityEvent {
    securityEvent {
      type
      description
      severity
      timestamp
      deviceInfo
      location
      requiresAction
    }
  }
`

// Collaboration Subscriptions
export const USER_JOINED = gql`
  subscription UserJoined {
    userJoined {
      user {
        ...UserFragment
        fullName
        displayName
      }
      timestamp
    }
  }
  ${USER_FRAGMENT}
`

export const USER_LEFT = gql`
  subscription UserLeft {
    userLeft {
      userId
      userName
      timestamp
      reason
    }
  }
`

// Real-time Stats Subscriptions
export const STATS_UPDATED = gql`
  subscription StatsUpdated {
    statsUpdated {
      type
      value
      change
      timestamp
      metadata
    }
  }
`

export const USER_COUNT_CHANGED = gql`
  subscription UserCountChanged {
    userCountChanged {
      total
      online
      active
      timestamp
    }
  }
`

// Connection Status Subscriptions
export const CONNECTION_STATUS = gql`
  subscription ConnectionStatus {
    connectionStatus {
      status
      quality
      latency
      timestamp
      reconnectAttempts
    }
  }
`

// Reaction Subscriptions
export const REACTION_ADDED = gql`
  subscription ReactionAdded($messageId: ID!) {
    reactionAdded(messageId: $messageId) {
      id
      type
      messageId
      user {
        id
        firstName
        lastName
      }
      createdAt
    }
  }
`

export const REACTION_REMOVED = gql`
  subscription ReactionRemoved($messageId: ID!) {
    reactionRemoved(messageId: $messageId) {
      id
      type
      messageId
      userId
      removedAt
    }
  }
`

// Data Sync Subscriptions
export const SYNC_STATUS_CHANGED = gql`
  subscription SyncStatusChanged {
    syncStatusChanged {
      status
      progress
      lastSync
      nextSync
      error
      queueSize
    }
  }
`

export const CACHE_INVALIDATED = gql`
  subscription CacheInvalidated {
    cacheInvalidated {
      type
      keys
      reason
      timestamp
      requiresRefresh
    }
  }
`

// Admin Subscriptions (when user has admin role)
export const ADMIN_ALERT = gql`
  subscription AdminAlert {
    adminAlert {
      id
      type
      severity
      title
      message
      data
      timestamp
      actions {
        label
        action
        style
      }
    }
  }
`

export const USER_ACTIVITY = gql`
  subscription UserActivity {
    userActivity {
      userId
      activity
      timestamp
      metadata
    }
  }
`

// Performance and Monitoring
export const PERFORMANCE_METRICS = gql`
  subscription PerformanceMetrics {
    performanceMetrics {
      type
      value
      unit
      timestamp
      threshold
      status
    }
  }
`

// Error and Debug Subscriptions
export const ERROR_OCCURRED = gql`
  subscription ErrorOccurred {
    errorOccurred {
      id
      type
      message
      stack
      timestamp
      userId
      context
      severity
    }
  }
`

// Feature Flag Subscriptions
export const FEATURE_FLAG_CHANGED = gql`
  subscription FeatureFlagChanged {
    featureFlagChanged {
      flag
      enabled
      value
      timestamp
      targetUsers
      reason
    }
  }
`

// Background Process Subscriptions
export const BACKGROUND_JOB_STATUS = gql`
  subscription BackgroundJobStatus($jobId: ID!) {
    backgroundJobStatus(jobId: $jobId) {
      jobId
      status
      progress
      message
      result
      error
      timestamp
    }
  }
`

// Bulk Operation Subscriptions
export const BULK_OPERATION_PROGRESS = gql`
  subscription BulkOperationProgress($operationId: ID!) {
    bulkOperationProgress(operationId: $operationId) {
      operationId
      status
      progress
      processed
      total
      errors
      timestamp
      estimatedCompletion
    }
  }
`

// Combined subscription for dashboard
export const DASHBOARD_UPDATES = gql`
  subscription DashboardUpdates {
    dashboardUpdates {
      type
      data
      timestamp
    }
  }
`

// Mobile-specific optimized subscription
export const MOBILE_UPDATES = gql`
  subscription MobileUpdates($userId: ID!, $deviceId: String!) {
    mobileUpdates(userId: $userId, deviceId: $deviceId) {
      type
      priority
      data
      timestamp
      requiresAction
      backgroundSync
    }
  }
`