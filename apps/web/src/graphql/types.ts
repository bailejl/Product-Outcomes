/**
 * GraphQL Type Definitions
 * Centralized type definitions for GraphQL operations
 */

import { gql } from '@apollo/client'

// User Types
export const USER_FRAGMENT = gql`
  fragment UserFragment on User {
    id
    email
    firstName
    lastName
    role
    isActive
    emailVerified
    createdAt
    updatedAt
    lastLoginAt
    loginAttempts
    accountLockedUntil
  }
`

export const AUTH_TOKENS_FRAGMENT = gql`
  fragment AuthTokensFragment on AuthTokens {
    accessToken
    refreshToken
    expiresIn
  }
`

// Message Types
export const MESSAGE_FRAGMENT = gql`
  fragment MessageFragment on Message {
    id
    content
    userId
    user {
      ...UserFragment
    }
    createdAt
    updatedAt
  }
  ${USER_FRAGMENT}
`

// Type Definitions
export const TYPE_DEFS = gql`
  # Scalar Types
  scalar DateTime
  scalar JSON

  # Enums
  enum UserRole {
    ADMIN
    USER
    MODERATOR
  }

  enum MessageStatus {
    ACTIVE
    DELETED
    EDITED
  }

  # User Types
  type User {
    id: ID!
    email: String!
    firstName: String!
    lastName: String!
    role: UserRole!
    isActive: Boolean!
    emailVerified: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    lastLoginAt: DateTime
    loginAttempts: Int!
    accountLockedUntil: DateTime
    canAttemptLogin: Boolean!
    # Virtual fields
    fullName: String!
    displayName: String!
    # Relationships
    messages: [Message!]!
    messageCount: Int!
  }

  type AuthTokens {
    accessToken: String!
    refreshToken: String!
    expiresIn: Int!
  }

  type AuthResponse {
    user: User!
    tokens: AuthTokens!
    message: String!
  }

  # Message Types
  type Message {
    id: ID!
    content: String!
    status: MessageStatus!
    userId: ID!
    user: User!
    createdAt: DateTime!
    updatedAt: DateTime!
    # Virtual fields
    isEdited: Boolean!
    editHistory: [MessageEdit!]!
  }

  type MessageEdit {
    id: ID!
    content: String!
    editedAt: DateTime!
    editedBy: User!
  }

  # Pagination Types
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
    totalCount: Int!
  }

  type MessagesConnection {
    edges: [MessageEdge!]!
    pageInfo: PageInfo!
  }

  type MessageEdge {
    node: Message!
    cursor: String!
  }

  type UsersConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
  }

  type UserEdge {
    node: User!
    cursor: String!
  }

  # Input Types
  input RegisterInput {
    email: String!
    password: String!
    firstName: String!
    lastName: String!
    role: UserRole = USER
  }

  input LoginInput {
    email: String!
    password: String!
    rememberMe: Boolean = false
  }

  input UpdateProfileInput {
    firstName: String
    lastName: String
    email: String
  }

  input ChangePasswordInput {
    currentPassword: String!
    newPassword: String!
  }

  input CreateMessageInput {
    content: String!
  }

  input UpdateMessageInput {
    id: ID!
    content: String!
  }

  input MessageFilters {
    userId: ID
    status: MessageStatus
    searchTerm: String
    createdAfter: DateTime
    createdBefore: DateTime
  }

  input UserFilters {
    role: UserRole
    isActive: Boolean
    emailVerified: Boolean
    searchTerm: String
  }

  input PaginationInput {
    first: Int
    after: String
    last: Int
    before: String
  }

  # Response Types
  type BaseResponse {
    success: Boolean!
    message: String!
  }

  type PasswordResetResponse {
    success: Boolean!
    message: String!
    emailSent: Boolean!
  }

  type SessionInfo {
    activeSessions: Int!
    currentSession: SessionDetails!
  }

  type SessionDetails {
    id: String!
    lastAccess: DateTime
    createdAt: DateTime
  }

  # Statistics Types
  type UserStats {
    totalUsers: Int!
    activeUsers: Int!
    verifiedUsers: Int!
    adminUsers: Int!
    recentRegistrations: Int!
  }

  type MessageStats {
    totalMessages: Int!
    activeMessages: Int!
    deletedMessages: Int!
    messagesLast24h: Int!
    messagesLast7d: Int!
  }

  type SystemStats {
    users: UserStats!
    messages: MessageStats!
    uptime: String!
    version: String!
  }

  # Root Types
  type Query {
    # Authentication
    me: User
    sessionInfo: SessionInfo
    
    # Users
    users(
      filters: UserFilters
      pagination: PaginationInput
    ): UsersConnection!
    user(id: ID!): User
    
    # Messages
    messages(
      filters: MessageFilters
      pagination: PaginationInput
    ): MessagesConnection!
    message(id: ID!): Message
    
    # Statistics (Admin only)
    systemStats: SystemStats!
    
    # Health check
    health: String!
  }

  type Mutation {
    # Authentication
    register(input: RegisterInput!): AuthResponse!
    login(input: LoginInput!): AuthResponse!
    logout: BaseResponse!
    refreshToken: AuthTokens!
    
    # Profile Management
    updateProfile(input: UpdateProfileInput!): User!
    changePassword(input: ChangePasswordInput!): BaseResponse!
    
    # Password Reset
    requestPasswordReset(email: String!): PasswordResetResponse!
    resetPassword(token: String!, newPassword: String!): BaseResponse!
    
    # Session Management
    invalidateAllSessions: BaseResponse!
    
    # Messages
    createMessage(input: CreateMessageInput!): Message!
    updateMessage(input: UpdateMessageInput!): Message!
    deleteMessage(id: ID!): BaseResponse!
    
    # Admin Operations
    toggleUserActive(userId: ID!): User!
    promoteUser(userId: ID!, role: UserRole!): User!
  }

  type Subscription {
    # Real-time message updates
    messageAdded: Message!
    messageUpdated: Message!
    messageDeleted: ID!
    
    # User status updates
    userStatusChanged: User!
    
    # Admin notifications
    userRegistered: User!
    systemAlert(severity: String!): JSON!
  }
`

// Export common field selections
export const COMMON_USER_FIELDS = `
  id
  email
  firstName
  lastName
  role
  isActive
  emailVerified
  createdAt
  updatedAt
`

export const COMMON_MESSAGE_FIELDS = `
  id
  content
  userId
  createdAt
  updatedAt
  user {
    ${COMMON_USER_FIELDS}
  }
`

export const PAGINATION_FIELDS = `
  pageInfo {
    hasNextPage
    hasPreviousPage
    startCursor
    endCursor
    totalCount
  }
`