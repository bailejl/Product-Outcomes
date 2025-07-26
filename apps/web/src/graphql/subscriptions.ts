/**
 * GraphQL Subscriptions
 * Real-time subscription definitions for live updates
 */

import { gql } from '@apollo/client'
import { USER_FRAGMENT, MESSAGE_FRAGMENT } from './types'

// Message Subscriptions
export const MESSAGE_ADDED = gql`
  subscription MessageAdded {
    messageAdded {
      ...MessageFragment
    }
  }
  ${MESSAGE_FRAGMENT}
`

export const MESSAGE_UPDATED = gql`
  subscription MessageUpdated {
    messageUpdated {
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
  subscription MessageDeleted {
    messageDeleted
  }
`

// User Status Subscriptions
export const USER_STATUS_CHANGED = gql`
  subscription UserStatusChanged {
    userStatusChanged {
      ...UserFragment
    }
  }
  ${USER_FRAGMENT}
`

export const USER_REGISTERED = gql`
  subscription UserRegistered {
    userRegistered {
      ...UserFragment
    }
  }
  ${USER_FRAGMENT}
`

// System Subscriptions (Admin only)
export const SYSTEM_ALERT = gql`
  subscription SystemAlert($severity: String!) {
    systemAlert(severity: $severity)
  }
`

// Combined subscriptions for different views

// Chat/Messages view
export const MESSAGES_SUBSCRIPTION = gql`
  subscription MessagesSubscription {
    messageAdded {
      ...MessageFragment
    }
    messageUpdated {
      ...MessageFragment
      isEdited
    }
    messageDeleted
  }
  ${MESSAGE_FRAGMENT}
`

// Admin dashboard subscriptions
export const ADMIN_DASHBOARD_SUBSCRIPTION = gql`
  subscription AdminDashboardSubscription {
    userRegistered {
      ...UserFragment
    }
    userStatusChanged {
      ...UserFragment
    }
    systemAlert(severity: "high") 
  }
  ${USER_FRAGMENT}
`

// User profile subscriptions
export const USER_PROFILE_SUBSCRIPTION = gql`
  subscription UserProfileSubscription($userId: ID!) {
    messageAdded @include(if: $userId) {
      ...MessageFragment @include(if: { eq: [$userId, "user.id"] })
    }
    userStatusChanged @include(if: $userId) {
      ...UserFragment @include(if: { eq: [$userId, "id"] })
    }
  }
  ${MESSAGE_FRAGMENT}
  ${USER_FRAGMENT}
`

// Notification subscriptions
export const NOTIFICATIONS_SUBSCRIPTION = gql`
  subscription NotificationsSubscription {
    messageAdded {
      id
      content
      user {
        id
        firstName
        lastName
        displayName
      }
      createdAt
    }
    userStatusChanged {
      id
      firstName
      lastName
      isActive
      role
    }
  }
`