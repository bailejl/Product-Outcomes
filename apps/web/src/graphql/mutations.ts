/**
 * GraphQL Mutations
 * Centralized mutation definitions for data modifications
 */

import { gql } from '@apollo/client'
import { USER_FRAGMENT, MESSAGE_FRAGMENT, AUTH_TOKENS_FRAGMENT } from './types'

// Authentication Mutations
export const REGISTER = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      user {
        ...UserFragment
      }
      tokens {
        ...AuthTokensFragment
      }
      message
    }
  }
  ${USER_FRAGMENT}
  ${AUTH_TOKENS_FRAGMENT}
`

export const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      user {
        ...UserFragment
      }
      tokens {
        ...AuthTokensFragment
      }
      message
    }
  }
  ${USER_FRAGMENT}
  ${AUTH_TOKENS_FRAGMENT}
`

export const LOGOUT = gql`
  mutation Logout {
    logout {
      success
      message
    }
  }
`

export const REFRESH_TOKEN = gql`
  mutation RefreshToken {
    refreshToken {
      ...AuthTokensFragment
    }
  }
  ${AUTH_TOKENS_FRAGMENT}
`

// Profile Management Mutations
export const UPDATE_PROFILE = gql`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      ...UserFragment
    }
  }
  ${USER_FRAGMENT}
`

export const CHANGE_PASSWORD = gql`
  mutation ChangePassword($input: ChangePasswordInput!) {
    changePassword(input: $input) {
      success
      message
    }
  }
`

// Password Reset Mutations
export const REQUEST_PASSWORD_RESET = gql`
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(email: $email) {
      success
      message
      emailSent
    }
  }
`

export const RESET_PASSWORD = gql`
  mutation ResetPassword($token: String!, $newPassword: String!) {
    resetPassword(token: $token, newPassword: $newPassword) {
      success
      message
    }
  }
`

// Session Management Mutations
export const INVALIDATE_ALL_SESSIONS = gql`
  mutation InvalidateAllSessions {
    invalidateAllSessions {
      success
      message
    }
  }
`

// Message Mutations
export const CREATE_MESSAGE = gql`
  mutation CreateMessage($input: CreateMessageInput!) {
    createMessage(input: $input) {
      ...MessageFragment
    }
  }
  ${MESSAGE_FRAGMENT}
`

export const UPDATE_MESSAGE = gql`
  mutation UpdateMessage($input: UpdateMessageInput!) {
    updateMessage(input: $input) {
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

export const DELETE_MESSAGE = gql`
  mutation DeleteMessage($id: ID!) {
    deleteMessage(id: $id) {
      success
      message
    }
  }
`

// Admin Mutations
export const TOGGLE_USER_ACTIVE = gql`
  mutation ToggleUserActive($userId: ID!) {
    toggleUserActive(userId: $userId) {
      ...UserFragment
    }
  }
  ${USER_FRAGMENT}
`

export const PROMOTE_USER = gql`
  mutation PromoteUser($userId: ID!, $role: UserRole!) {
    promoteUser(userId: $userId, role: $role) {
      ...UserFragment
    }
  }
  ${USER_FRAGMENT}
`

// Optimistic update helpers - these are used for immediate UI updates

// Create message with optimistic response
export const CREATE_MESSAGE_OPTIMISTIC = gql`
  mutation CreateMessageOptimistic($input: CreateMessageInput!) {
    createMessage(input: $input) {
      ...MessageFragment
    }
  }
  ${MESSAGE_FRAGMENT}
`

// Update message with optimistic response
export const UPDATE_MESSAGE_OPTIMISTIC = gql`
  mutation UpdateMessageOptimistic($input: UpdateMessageInput!) {
    updateMessage(input: $input) {
      ...MessageFragment
      isEdited
    }
  }
  ${MESSAGE_FRAGMENT}
`

// Delete message with optimistic response
export const DELETE_MESSAGE_OPTIMISTIC = gql`
  mutation DeleteMessageOptimistic($id: ID!) {
    deleteMessage(id: $id) {
      success
      message
    }
  }
`

// Batch operations for admin

// Bulk user operations
export const BULK_UPDATE_USERS = gql`
  mutation BulkUpdateUsers($userIds: [ID!]!, $updates: JSON!) {
    bulkUpdateUsers(userIds: $userIds, updates: $updates) {
      success
      message
      updatedCount
    }
  }
`

export const BULK_DELETE_MESSAGES = gql`
  mutation BulkDeleteMessages($messageIds: [ID!]!) {
    bulkDeleteMessages(messageIds: $messageIds) {
      success
      message
      deletedCount
    }
  }
`

// Cache update helpers - these are used to update local cache

// Add message to cache
export const ADD_MESSAGE_TO_CACHE = gql`
  fragment AddMessageToCache on Message {
    ...MessageFragment
  }
  ${MESSAGE_FRAGMENT}
`

// Update message in cache
export const UPDATE_MESSAGE_IN_CACHE = gql`
  fragment UpdateMessageInCache on Message {
    ...MessageFragment
    isEdited
  }
  ${MESSAGE_FRAGMENT}
`

// Remove message from cache
export const REMOVE_MESSAGE_FROM_CACHE = gql`
  fragment RemoveMessageFromCache on Message {
    id
  }
`

// Update user in cache
export const UPDATE_USER_IN_CACHE = gql`
  fragment UpdateUserInCache on User {
    ...UserFragment
  }
  ${USER_FRAGMENT}
`

// Complex mutations with multiple operations

// Register and auto-login
export const REGISTER_AND_LOGIN = gql`
  mutation RegisterAndLogin($input: RegisterInput!) {
    register(input: $input) {
      user {
        ...UserFragment
      }
      tokens {
        ...AuthTokensFragment
      }
      message
    }
  }
  ${USER_FRAGMENT}
  ${AUTH_TOKENS_FRAGMENT}
`

// Update profile with session refresh
export const UPDATE_PROFILE_WITH_SESSION = gql`
  mutation UpdateProfileWithSession($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      ...UserFragment
    }
  }
  ${USER_FRAGMENT}
`

// Create message with user context
export const CREATE_MESSAGE_WITH_USER = gql`
  mutation CreateMessageWithUser($input: CreateMessageInput!) {
    createMessage(input: $input) {
      ...MessageFragment
      user {
        ...UserFragment
        messageCount
      }
    }
  }
  ${MESSAGE_FRAGMENT}
  ${USER_FRAGMENT}
`