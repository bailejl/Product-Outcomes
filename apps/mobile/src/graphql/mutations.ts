/**
 * Mobile GraphQL Mutations
 * Optimized for offline-first mobile experience
 */

import { gql } from '@apollo/client'
import { USER_FRAGMENT, MESSAGE_FRAGMENT, AUTH_TOKENS_FRAGMENT } from './queries'

// Authentication Mutations
export const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      user {
        ...UserFragment
        fullName
        displayName
      }
      tokens {
        ...AuthTokensFragment
      }
      success
      message
    }
  }
  ${USER_FRAGMENT}
  ${AUTH_TOKENS_FRAGMENT}
`

export const REGISTER = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      user {
        ...UserFragment
        fullName
        displayName
      }
      tokens {
        ...AuthTokensFragment
      }
      success
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

// Password Management
export const CHANGE_PASSWORD = gql`
  mutation ChangePassword($input: ChangePasswordInput!) {
    changePassword(input: $input) {
      success
      message
    }
  }
`

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
  mutation ResetPassword($input: ResetPasswordInput!) {
    resetPassword(input: $input) {
      success
      message
    }
  }
`

// Profile Management
export const UPDATE_PROFILE = gql`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      ...UserFragment
      fullName
      displayName
    }
  }
  ${USER_FRAGMENT}
`

export const UPDATE_PREFERENCES = gql`
  mutation UpdatePreferences($input: UpdatePreferencesInput!) {
    updatePreferences(input: $input) {
      success
      message
      preferences {
        theme
        language
        notifications {
          push
          email
          inApp
        }
        privacy {
          showOnlineStatus
          allowDirectMessages
        }
      }
    }
  }
`

export const UPLOAD_AVATAR = gql`
  mutation UploadAvatar($file: Upload!) {
    uploadAvatar(file: $file) {
      success
      message
      avatarUrl
      user {
        ...UserFragment
        avatarUrl
      }
    }
  }
  ${USER_FRAGMENT}
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

export const MARK_MESSAGE_AS_READ = gql`
  mutation MarkMessageAsRead($messageId: ID!) {
    markMessageAsRead(messageId: $messageId) {
      success
      message
    }
  }
`

export const BULK_MARK_MESSAGES_READ = gql`
  mutation BulkMarkMessagesRead($messageIds: [ID!]!) {
    bulkMarkMessagesRead(messageIds: $messageIds) {
      success
      message
      markedCount
    }
  }
`

// Reaction Mutations
export const ADD_REACTION = gql`
  mutation AddReaction($input: AddReactionInput!) {
    addReaction(input: $input) {
      success
      message
      reaction {
        id
        type
        user {
          id
          firstName
          lastName
        }
        createdAt
      }
    }
  }
`

export const REMOVE_REACTION = gql`
  mutation RemoveReaction($messageId: ID!, $reactionType: String!) {
    removeReaction(messageId: $messageId, reactionType: $reactionType) {
      success
      message
    }
  }
`

// Notification Mutations
export const MARK_NOTIFICATION_READ = gql`
  mutation MarkNotificationRead($notificationId: ID!) {
    markNotificationRead(notificationId: $notificationId) {
      success
      message
    }
  }
`

export const MARK_ALL_NOTIFICATIONS_READ = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead {
      success
      message
      markedCount
    }
  }
`

export const DELETE_NOTIFICATION = gql`
  mutation DeleteNotification($notificationId: ID!) {
    deleteNotification(notificationId: $notificationId) {
      success
      message
    }
  }
`

export const UPDATE_NOTIFICATION_SETTINGS = gql`
  mutation UpdateNotificationSettings($input: NotificationSettingsInput!) {
    updateNotificationSettings(input: $input) {
      success
      message
      settings {
        push
        email
        inApp
        categories {
          messages
          mentions
          systems
        }
      }
    }
  }
`

// Device and Session Management
export const REGISTER_DEVICE = gql`
  mutation RegisterDevice($input: RegisterDeviceInput!) {
    registerDevice(input: $input) {
      success
      message
      device {
        id
        name
        platform
        pushToken
        isActive
      }
    }
  }
`

export const UPDATE_DEVICE_TOKEN = gql`
  mutation UpdateDeviceToken($deviceId: ID!, $pushToken: String!) {
    updateDeviceToken(deviceId: $deviceId, pushToken: $pushToken) {
      success
      message
    }
  }
`

export const UNREGISTER_DEVICE = gql`
  mutation UnregisterDevice($deviceId: ID!) {
    unregisterDevice(deviceId: $deviceId) {
      success
      message
    }
  }
`

export const INVALIDATE_SESSION = gql`
  mutation InvalidateSession($sessionId: ID!) {
    invalidateSession(sessionId: $sessionId) {
      success
      message
    }
  }
`

export const INVALIDATE_ALL_SESSIONS = gql`
  mutation InvalidateAllSessions {
    invalidateAllSessions {
      success
      message
      invalidatedCount
    }
  }
`

// User Status and Presence
export const UPDATE_USER_STATUS = gql`
  mutation UpdateUserStatus($status: UserStatus!) {
    updateUserStatus(status: $status) {
      success
      message
      user {
        id
        status
        lastSeen
      }
    }
  }
`

export const SET_USER_TYPING = gql`
  mutation SetUserTyping($isTyping: Boolean!) {
    setUserTyping(isTyping: $isTyping) {
      success
    }
  }
`

// Data Management
export const CLEAR_USER_DATA = gql`
  mutation ClearUserData($dataTypes: [UserDataType!]!) {
    clearUserData(dataTypes: $dataTypes) {
      success
      message
      clearedTypes
    }
  }
`

export const EXPORT_USER_DATA = gql`
  mutation ExportUserData($format: ExportFormat = JSON) {
    exportUserData(format: $format) {
      success
      message
      downloadUrl
      expiresAt
    }
  }
`

// Cache Management
export const SYNC_CACHE = gql`
  mutation SyncCache($input: SyncCacheInput!) {
    syncCache(input: $input) {
      success
      message
      syncedEntities
      lastSyncTime
    }
  }
`

export const CLEAR_CACHE = gql`
  mutation ClearCache($cacheTypes: [CacheType!]) {
    clearCache(cacheTypes: $cacheTypes) {
      success
      message
      clearedTypes
    }
  }
`

// Analytics and Feedback
export const TRACK_EVENT = gql`
  mutation TrackEvent($input: TrackEventInput!) {
    trackEvent(input: $input) {
      success
    }
  }
`

export const SUBMIT_FEEDBACK = gql`
  mutation SubmitFeedback($input: SubmitFeedbackInput!) {
    submitFeedback(input: $input) {
      success
      message
      ticketId
    }
  }
`

export const REPORT_BUG = gql`
  mutation ReportBug($input: ReportBugInput!) {
    reportBug(input: $input) {
      success
      message
      reportId
    }
  }
`

// Optimistic Mutations (for offline support)
export const CREATE_MESSAGE_OPTIMISTIC = gql`
  mutation CreateMessageOptimistic($input: CreateMessageInput!) {
    createMessage(input: $input) {
      ...MessageFragment
    }
  }
  ${MESSAGE_FRAGMENT}
`

export const UPDATE_MESSAGE_OPTIMISTIC = gql`
  mutation UpdateMessageOptimistic($input: UpdateMessageInput!) {
    updateMessage(input: $input) {
      ...MessageFragment
      isEdited
    }
  }
  ${MESSAGE_FRAGMENT}
`

export const DELETE_MESSAGE_OPTIMISTIC = gql`
  mutation DeleteMessageOptimistic($id: ID!) {
    deleteMessage(id: $id) {
      success
      message
    }
  }
`

export const UPDATE_PROFILE_OPTIMISTIC = gql`
  mutation UpdateProfileOptimistic($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      ...UserFragment
      fullName
      displayName
    }
  }
  ${USER_FRAGMENT}
`

// Background sync mutations
export const BACKGROUND_SYNC = gql`
  mutation BackgroundSync($input: BackgroundSyncInput!) {
    backgroundSync(input: $input) {
      success
      message
      syncedData {
        messages {
          created
          updated
          deleted
        }
        users {
          created
          updated
        }
        notifications {
          created
          updated
        }
      }
      lastSyncTime
    }
  }
`

// Health check mutation
export const PING = gql`
  mutation Ping {
    ping {
      success
      timestamp
      serverTime
    }
  }
`