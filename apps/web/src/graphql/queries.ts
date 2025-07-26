/**
 * GraphQL Queries
 * Centralized query definitions for data fetching
 */

import { gql } from '@apollo/client'
import { USER_FRAGMENT, MESSAGE_FRAGMENT, PAGINATION_FIELDS } from './types'

// Authentication Queries
export const GET_ME = gql`
  query GetMe {
    me {
      ...UserFragment
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
      }
    }
  }
`

// User Queries
export const GET_USERS = gql`
  query GetUsers(
    $filters: UserFilters
    $pagination: PaginationInput
  ) {
    users(filters: $filters, pagination: $pagination) {
      edges {
        node {
          ...UserFragment
          messageCount
        }
        cursor
      }
      ${PAGINATION_FIELDS}
    }
  }
  ${USER_FRAGMENT}
`

export const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      ...UserFragment
      fullName
      displayName
      messageCount
      messages {
        ...MessageFragment
      }
    }
  }
  ${USER_FRAGMENT}
  ${MESSAGE_FRAGMENT}
`

// Message Queries
export const GET_MESSAGES = gql`
  query GetMessages(
    $filters: MessageFilters
    $pagination: PaginationInput
  ) {
    messages(filters: $filters, pagination: $pagination) {
      edges {
        node {
          ...MessageFragment
          isEdited
        }
        cursor
      }
      ${PAGINATION_FIELDS}
    }
  }
  ${MESSAGE_FRAGMENT}
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

// Recent Messages (optimized for real-time updates)
export const GET_RECENT_MESSAGES = gql`
  query GetRecentMessages($limit: Int = 20) {
    messages(
      pagination: { first: $limit }
      filters: { status: ACTIVE }
    ) {
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

// User Messages (for profile page)
export const GET_USER_MESSAGES = gql`
  query GetUserMessages(
    $userId: ID!
    $pagination: PaginationInput
  ) {
    messages(
      filters: { userId: $userId, status: ACTIVE }
      pagination: $pagination
    ) {
      edges {
        node {
          ...MessageFragment
        }
        cursor
      }
      ${PAGINATION_FIELDS}
    }
  }
  ${MESSAGE_FRAGMENT}
`

// Statistics Queries (Admin only)
export const GET_SYSTEM_STATS = gql`
  query GetSystemStats {
    systemStats {
      users {
        totalUsers
        activeUsers
        verifiedUsers
        adminUsers
        recentRegistrations
      }
      messages {
        totalMessages
        activeMessages
        deletedMessages
        messagesLast24h
        messagesLast7d
      }
      uptime
      version
    }
  }
`

// Search Queries
export const SEARCH_USERS = gql`
  query SearchUsers($searchTerm: String!, $limit: Int = 10) {
    users(
      filters: { searchTerm: $searchTerm, isActive: true }
      pagination: { first: $limit }
    ) {
      edges {
        node {
          id
          email
          firstName
          lastName
          role
          fullName
          displayName
        }
        cursor
      }
      pageInfo {
        totalCount
      }
    }
  }
`

export const SEARCH_MESSAGES = gql`
  query SearchMessages($searchTerm: String!, $limit: Int = 20) {
    messages(
      filters: { searchTerm: $searchTerm, status: ACTIVE }
      pagination: { first: $limit }
    ) {
      edges {
        node {
          ...MessageFragment
        }
        cursor
      }
      pageInfo {
        totalCount
      }
    }
  }
  ${MESSAGE_FRAGMENT}
`

// Health Check
export const HEALTH_CHECK = gql`
  query HealthCheck {
    health
  }
`

// Optimized queries for specific use cases

// Dashboard data (combines multiple queries)
export const GET_DASHBOARD_DATA = gql`
  query GetDashboardData {
    me {
      ...UserFragment
    }
    messages(
      pagination: { first: 5 }
      filters: { status: ACTIVE }
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
    sessionInfo {
      activeSessions
    }
  }
  ${USER_FRAGMENT}
  ${MESSAGE_FRAGMENT}
`

// Profile page data
export const GET_PROFILE_DATA = gql`
  query GetProfileData($userId: ID!) {
    user(id: $userId) {
      ...UserFragment
      fullName
      displayName
      messageCount
    }
    messages(
      filters: { userId: $userId, status: ACTIVE }
      pagination: { first: 10 }
    ) {
      edges {
        node {
          ...MessageFragment
        }
      }
      pageInfo {
        hasNextPage
        totalCount
      }
    }
  }
  ${USER_FRAGMENT}
  ${MESSAGE_FRAGMENT}
`

// Admin dashboard data
export const GET_ADMIN_DASHBOARD = gql`
  query GetAdminDashboard {
    systemStats {
      users {
        totalUsers
        activeUsers
        recentRegistrations
      }
      messages {
        totalMessages
        messagesLast24h
      }
    }
    users(
      pagination: { first: 10 }
      filters: { isActive: true }
    ) {
      edges {
        node {
          ...UserFragment
          messageCount
        }
      }
      pageInfo {
        totalCount
      }
    }
    messages(
      pagination: { first: 10 }
      filters: { status: ACTIVE }
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
  }
  ${USER_FRAGMENT}
  ${MESSAGE_FRAGMENT}
`

// Pagination helpers
export const GET_MORE_MESSAGES = gql`
  query GetMoreMessages(
    $after: String!
    $first: Int = 20
    $filters: MessageFilters
  ) {
    messages(
      pagination: { first: $first, after: $after }
      filters: $filters
    ) {
      edges {
        node {
          ...MessageFragment
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
  ${MESSAGE_FRAGMENT}
`

export const GET_MORE_USERS = gql`
  query GetMoreUsers(
    $after: String!
    $first: Int = 20
    $filters: UserFilters
  ) {
    users(
      pagination: { first: $first, after: $after }
      filters: $filters
    ) {
      edges {
        node {
          ...UserFragment
          messageCount
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
  ${USER_FRAGMENT}
`