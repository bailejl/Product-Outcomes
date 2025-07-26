/**
 * Mobile GraphQL Queries
 * Optimized for mobile performance with minimal data fetching
 */

import { gql } from '@apollo/client'

// Fragment definitions for consistent data shape
export const USER_FRAGMENT = gql`
  fragment UserFragment on User {
    id
    email
    firstName
    lastName
    role
    isActive
    createdAt
    updatedAt
  }
`

export const MESSAGE_FRAGMENT = gql`
  fragment MessageFragment on Message {
    id
    content
    createdAt
    updatedAt
    user {
      ...UserFragment
    }
  }
  ${USER_FRAGMENT}
`

export const AUTH_TOKENS_FRAGMENT = gql`
  fragment AuthTokensFragment on AuthTokens {
    accessToken
    refreshToken
    expiresIn
    tokenType
  }
`

export const PAGINATION_FRAGMENT = gql`
  fragment PaginationFragment on PageInfo {
    hasNextPage
    hasPreviousPage
    startCursor
    endCursor
    totalCount
  }
`

// Authentication Queries
export const GET_ME = gql`
  query GetMe {
    me {
      ...UserFragment
      fullName
      displayName
    }
  }
  ${USER_FRAGMENT}
`

export const GET_SESSION_INFO = gql`
  query GetSessionInfo {
    sessionInfo {
      activeSessions
      currentSession {
        id
        lastAccess
        createdAt
        deviceInfo
        location
      }
    }
  }
`

// Message Queries - Optimized for mobile
export const GET_RECENT_MESSAGES = gql`
  query GetRecentMessages($limit: Int = 20, $offset: Int = 0) {
    messages(
      pagination: { first: $limit, offset: $offset }
      filters: { status: ACTIVE }
      orderBy: { createdAt: DESC }
    ) {
      edges {
        node {
          ...MessageFragment
        }
        cursor
      }
      pageInfo {
        ...PaginationFragment
      }
    }
  }
  ${MESSAGE_FRAGMENT}
  ${PAGINATION_FRAGMENT}
`

export const GET_MESSAGES_AFTER = gql`
  query GetMessagesAfter($after: String!, $limit: Int = 20) {
    messages(
      pagination: { first: $limit, after: $after }
      filters: { status: ACTIVE }
      orderBy: { createdAt: DESC }
    ) {
      edges {
        node {
          ...MessageFragment
        }
        cursor
      }
      pageInfo {
        ...PaginationFragment
      }
    }
  }
  ${MESSAGE_FRAGMENT}
  ${PAGINATION_FRAGMENT}
`

export const GET_MESSAGES_BEFORE = gql`
  query GetMessagesBefore($before: String!, $limit: Int = 20) {
    messages(
      pagination: { last: $limit, before: $before }
      filters: { status: ACTIVE }
      orderBy: { createdAt: DESC }
    ) {
      edges {
        node {
          ...MessageFragment
        }
        cursor
      }
      pageInfo {
        ...PaginationFragment
      }
    }
  }
  ${MESSAGE_FRAGMENT}
  ${PAGINATION_FRAGMENT}
`

export const GET_MESSAGE = gql`
  query GetMessage($id: ID!) {
    message(id: $id) {
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

// User Queries
export const GET_USERS = gql`
  query GetUsers($limit: Int = 20, $offset: Int = 0, $searchTerm: String) {
    users(
      pagination: { first: $limit, offset: $offset }
      filters: { 
        isActive: true
        searchTerm: $searchTerm
      }
      orderBy: { firstName: ASC }
    ) {
      edges {
        node {
          ...UserFragment
          fullName
          displayName
          messageCount
          lastSeen
        }
        cursor
      }
      pageInfo {
        ...PaginationFragment
      }
    }
  }
  ${USER_FRAGMENT}
  ${PAGINATION_FRAGMENT}
`

export const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      ...UserFragment
      fullName
      displayName
      messageCount
      lastSeen
      recentMessages: messages(
        pagination: { first: 5 }
        filters: { status: ACTIVE }
        orderBy: { createdAt: DESC }
      ) {
        edges {
          node {
            id
            content
            createdAt
          }
        }
      }
    }
  }
  ${USER_FRAGMENT}
`

// Search Queries - Lightweight for mobile
export const SEARCH_MESSAGES = gql`
  query SearchMessages($searchTerm: String!, $limit: Int = 20) {
    messages(
      pagination: { first: $limit }
      filters: { 
        searchTerm: $searchTerm
        status: ACTIVE 
      }
      orderBy: { createdAt: DESC }
    ) {
      edges {
        node {
          id
          content
          createdAt
          user {
            id
            firstName
            lastName
            fullName
          }
        }
        cursor
      }
      pageInfo {
        totalCount
        hasNextPage
      }
    }
  }
`

export const SEARCH_USERS = gql`
  query SearchUsers($searchTerm: String!, $limit: Int = 10) {
    users(
      pagination: { first: $limit }
      filters: { 
        searchTerm: $searchTerm
        isActive: true 
      }
      orderBy: { firstName: ASC }
    ) {
      edges {
        node {
          id
          firstName
          lastName
          email
          role
          fullName
          displayName
          lastSeen
        }
        cursor
      }
      pageInfo {
        totalCount
        hasNextPage
      }
    }
  }
`

// Dashboard Query - Optimized single request
export const GET_DASHBOARD_DATA = gql`
  query GetDashboardData {
    me {
      ...UserFragment
      fullName
      displayName
      messageCount
    }
    recentMessages: messages(
      pagination: { first: 10 }
      filters: { status: ACTIVE }
      orderBy: { createdAt: DESC }
    ) {
      edges {
        node {
          ...MessageFragment
        }
      }
      pageInfo {
        totalCount
      }
    }
    activeUsers: users(
      pagination: { first: 5 }
      filters: { isActive: true }
      orderBy: { lastSeen: DESC }
    ) {
      edges {
        node {
          id
          firstName
          lastName
          fullName
          lastSeen
          role
        }
      }
    }
    systemStats {
      users {
        totalUsers
        activeUsers
      }
      messages {
        totalMessages
        messagesLast24h
      }
      uptime
    }
  }
  ${USER_FRAGMENT}
  ${MESSAGE_FRAGMENT}
`

// Offline-first queries
export const GET_CACHED_MESSAGES = gql`
  query GetCachedMessages {
    messages(
      pagination: { first: 50 }
      filters: { status: ACTIVE }
      orderBy: { createdAt: DESC }
    ) @cached(ttl: 300) {
      edges {
        node {
          ...MessageFragment
        }
        cursor
      }
      pageInfo {
        hasNextPage
        totalCount
      }
    }
  }
  ${MESSAGE_FRAGMENT}
`

export const GET_CACHED_USERS = gql`
  query GetCachedUsers {
    users(
      pagination: { first: 100 }
      filters: { isActive: true }
      orderBy: { firstName: ASC }
    ) @cached(ttl: 600) {
      edges {
        node {
          ...UserFragment
          fullName
          displayName
        }
        cursor
      }
    }
  }
  ${USER_FRAGMENT}
`

// Health and connectivity
export const HEALTH_CHECK = gql`
  query HealthCheck {
    health
    serverTime
    version
  }
`

export const GET_SERVER_STATUS = gql`
  query GetServerStatus {
    serverStatus {
      healthy
      uptime
      version
      environment
      timestamp
    }
  }
`

// Sync queries for background refresh
export const GET_SYNC_DATA = gql`
  query GetSyncData($since: DateTime) {
    syncData(since: $since) {
      messages {
        edges {
          node {
            ...MessageFragment
          }
        }
        pageInfo {
          totalCount
        }
      }
      users {
        edges {
          node {
            ...UserFragment
            fullName
          }
        }
        pageInfo {
          totalCount
        }
      }
      lastSyncTime
    }
  }
  ${MESSAGE_FRAGMENT}
  ${USER_FRAGMENT}
`

// Profile queries
export const GET_PROFILE = gql`
  query GetProfile($userId: ID!) {
    user(id: $userId) {
      ...UserFragment
      fullName
      displayName
      messageCount
      joinedAt: createdAt
      lastActivity: lastSeen
      statistics {
        totalMessages
        messagesThisWeek
        messagesThisMonth
      }
    }
  }
  ${USER_FRAGMENT}
`

export const GET_MY_PROFILE = gql`
  query GetMyProfile {
    me {
      ...UserFragment
      fullName
      displayName
      preferences {
        theme
        language
        notifications {
          push
          email
          inApp
        }
      }
      statistics {
        totalMessages
        messagesThisWeek
        messagesThisMonth
        joinedDaysAgo
      }
      sessions {
        id
        deviceInfo
        lastAccess
        location
        isCurrentSession
      }
    }
  }
  ${USER_FRAGMENT}
`

// Notification queries
export const GET_NOTIFICATIONS = gql`
  query GetNotifications($limit: Int = 20, $unreadOnly: Boolean = false) {
    notifications(
      pagination: { first: $limit }
      filters: { unreadOnly: $unreadOnly }
      orderBy: { createdAt: DESC }
    ) {
      edges {
        node {
          id
          type
          title
          message
          data
          isRead
          createdAt
          relatedUser {
            id
            firstName
            lastName
            fullName
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        totalCount
      }
    }
  }
`

export const GET_UNREAD_COUNT = gql`
  query GetUnreadCount {
    unreadCounts {
      notifications
      messages
      total
    }
  }
`