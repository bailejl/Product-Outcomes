import { gql } from 'apollo-server-express'

export const typeDefs = gql`
  scalar Date
  scalar JSON

  # User types
  enum LegacyUserRole {
    ADMIN
    USER
    MODERATOR
  }

  type User {
    id: ID!
    email: String!
    firstName: String!
    lastName: String!
    fullName: String!
    legacyRole: LegacyUserRole
    roles: [UserRole!]!
    isActive: Boolean!
    emailVerified: Boolean!
    lastLoginAt: Date
    createdAt: Date!
    updatedAt: Date!
    isAdmin: Boolean!
    isModerator: Boolean!
  }

  type UserRole {
    id: ID!
    name: String!
    description: String
    permissions: [String!]!
    isActive: Boolean!
  }

  # Organization types
  enum OrganizationStatus {
    ACTIVE
    INACTIVE
    PENDING
    SUSPENDED
  }

  type Organization {
    id: ID!
    name: String!
    slug: String!
    description: String
    websiteUrl: String
    logoUrl: String
    status: OrganizationStatus!
    maxMembers: Int!
    subscriptionTier: String!
    subscriptionExpiresAt: Date
    settings: JSON
    members: [User!]!
    okrs: [OKR!]!
    memberCount: Int!
    okrCount: Int!
    isActive: Boolean!
    isSubscriptionActive: Boolean!
    createdAt: Date!
    updatedAt: Date!
  }

  # OKR types
  enum OKRStatus {
    DRAFT
    ACTIVE
    PAUSED
    COMPLETED
    CANCELLED
  }

  enum OKRPeriod {
    QUARTERLY
    ANNUAL
    CUSTOM
  }

  enum OKRVisibility {
    PUBLIC
    ORGANIZATION
    TEAM
    PRIVATE
  }

  type OKR {
    id: ID!
    title: String!
    description: String
    status: OKRStatus!
    period: OKRPeriod!
    visibility: OKRVisibility!
    startDate: Date!
    endDate: Date!
    progress: Float!
    targetProgress: Float!
    metadata: JSON
    owner: User!
    organization: Organization!
    keyResults: [KeyResult!]!
    comments: [OKRComment!]!
    isActive: Boolean!
    isCompleted: Boolean!
    isOverdue: Boolean!
    daysRemaining: Int!
    progressPercentage: Float!
    keyResultsCount: Int!
    completedKeyResultsCount: Int!
    commentsCount: Int!
    createdAt: Date!
    updatedAt: Date!
  }

  # Key Result types
  enum KeyResultType {
    NUMERIC
    PERCENTAGE
    BOOLEAN
    MILESTONE
  }

  enum KeyResultStatus {
    NOT_STARTED
    IN_PROGRESS
    COMPLETED
    AT_RISK
    BLOCKED
  }

  type KeyResult {
    id: ID!
    title: String!
    description: String
    type: KeyResultType!
    status: KeyResultStatus!
    startValue: Float!
    targetValue: Float!
    currentValue: Float!
    unit: String
    dueDate: Date
    metadata: JSON
    okr: OKR!
    assignee: User
    progressPercentage: Float!
    isCompleted: Boolean!
    isOverdue: Boolean!
    isAtRisk: Boolean!
    daysRemaining: Int
    formattedValue: String!
    createdAt: Date!
    updatedAt: Date!
  }

  # Comment types
  enum CommentType {
    GENERAL
    PROGRESS_UPDATE
    CONCERN
    QUESTION
    MILESTONE
    BLOCKER
  }

  type OKRComment {
    id: ID!
    content: String!
    type: CommentType!
    isResolved: Boolean!
    isEdited: Boolean!
    editReason: String
    metadata: JSON
    okr: OKR!
    author: User!
    parentComment: OKRComment
    replies: [OKRComment!]!
    isReply: Boolean!
    hasReplies: Boolean!
    replyCount: Int!
    needsAttention: Boolean!
    createdAt: Date!
    updatedAt: Date!
  }

  # Input types for mutations
  input CreateOrganizationInput {
    name: String!
    description: String
    websiteUrl: String
    settings: JSON
  }

  input UpdateOrganizationInput {
    name: String
    description: String
    websiteUrl: String
    logoUrl: String
    status: OrganizationStatus
    maxMembers: Int
    settings: JSON
  }

  input CreateOKRInput {
    title: String!
    description: String
    period: OKRPeriod!
    visibility: OKRVisibility!
    startDate: Date!
    endDate: Date!
    organizationId: ID!
    metadata: JSON
  }

  input UpdateOKRInput {
    title: String
    description: String
    status: OKRStatus
    visibility: OKRVisibility
    progress: Float
    metadata: JSON
  }

  input CreateKeyResultInput {
    title: String!
    description: String
    type: KeyResultType!
    targetValue: Float!
    startValue: Float
    unit: String
    dueDate: Date
    okrId: ID!
    assigneeId: ID
    metadata: JSON
  }

  input UpdateKeyResultInput {
    title: String
    description: String
    status: KeyResultStatus
    currentValue: Float
    targetValue: Float
    unit: String
    dueDate: Date
    assigneeId: ID
    metadata: JSON
  }

  input CreateCommentInput {
    content: String!
    type: CommentType!
    okrId: ID!
    parentCommentId: ID
    metadata: JSON
  }

  input UpdateCommentInput {
    content: String
    type: CommentType
    isResolved: Boolean
    editReason: String
    metadata: JSON
  }

  # Filter inputs
  input OKRFilter {
    status: [OKRStatus!]
    period: [OKRPeriod!]
    visibility: [OKRVisibility!]
    ownerId: ID
    organizationId: ID
    search: String
    startDateAfter: Date
    startDateBefore: Date
    endDateAfter: Date
    endDateBefore: Date
  }

  input KeyResultFilter {
    status: [KeyResultStatus!]
    type: [KeyResultType!]
    okrId: ID
    assigneeId: ID
    overdue: Boolean
    atRisk: Boolean
  }

  input CommentFilter {
    type: [CommentType!]
    resolved: Boolean
    okrId: ID
    authorId: ID
    parentCommentId: ID
    needsAttention: Boolean
  }

  # Query types
  type Query {
    # User queries
    me: User
    user(id: ID!): User
    users(limit: Int = 10, offset: Int = 0): [User!]!

    # Organization queries
    organization(id: ID!): Organization
    organizationBySlug(slug: String!): Organization
    organizations(limit: Int = 10, offset: Int = 0): [Organization!]!
    myOrganizations: [Organization!]!

    # OKR queries
    okr(id: ID!): OKR
    okrs(filter: OKRFilter, limit: Int = 10, offset: Int = 0): [OKR!]!
    myOKRs(filter: OKRFilter, limit: Int = 10, offset: Int = 0): [OKR!]!
    organizationOKRs(organizationId: ID!, filter: OKRFilter, limit: Int = 10, offset: Int = 0): [OKR!]!

    # Key Result queries
    keyResult(id: ID!): KeyResult
    keyResults(filter: KeyResultFilter, limit: Int = 10, offset: Int = 0): [KeyResult!]!
    okrKeyResults(okrId: ID!, filter: KeyResultFilter): [KeyResult!]!

    # Comment queries
    comment(id: ID!): OKRComment
    comments(filter: CommentFilter, limit: Int = 10, offset: Int = 0): [OKRComment!]!
    okrComments(okrId: ID!, filter: CommentFilter, limit: Int = 10, offset: Int = 0): [OKRComment!]!
  }

  # Mutation types
  type Mutation {
    # Organization mutations
    createOrganization(input: CreateOrganizationInput!): Organization!
    updateOrganization(id: ID!, input: UpdateOrganizationInput!): Organization!
    deleteOrganization(id: ID!): Boolean!
    joinOrganization(organizationId: ID!): Organization!
    leaveOrganization(organizationId: ID!): Boolean!

    # OKR mutations
    createOKR(input: CreateOKRInput!): OKR!
    updateOKR(id: ID!, input: UpdateOKRInput!): OKR!
    deleteOKR(id: ID!): Boolean!
    calculateOKRProgress(id: ID!): OKR!

    # Key Result mutations
    createKeyResult(input: CreateKeyResultInput!): KeyResult!
    updateKeyResult(id: ID!, input: UpdateKeyResultInput!): KeyResult!
    deleteKeyResult(id: ID!): Boolean!
    updateKeyResultProgress(id: ID!, value: Float!, note: String): KeyResult!
    markKeyResultCompleted(id: ID!): KeyResult!
    markKeyResultAtRisk(id: ID!): KeyResult!
    markKeyResultBlocked(id: ID!): KeyResult!

    # Comment mutations
    createComment(input: CreateCommentInput!): OKRComment!
    updateComment(id: ID!, input: UpdateCommentInput!): OKRComment!
    deleteComment(id: ID!): Boolean!
    resolveComment(id: ID!): OKRComment!
    unresolveComment(id: ID!): OKRComment!
    addCommentReaction(id: ID!, emoji: String!): OKRComment!
    removeCommentReaction(id: ID!, emoji: String!): OKRComment!
  }

  # Subscription types for real-time updates
  type Subscription {
    # OKR subscriptions
    okrUpdated(okrId: ID): OKR!
    okrProgressChanged(organizationId: ID): OKR!
    okrStatusChanged(organizationId: ID): OKR!
    newOKRCreated(organizationId: ID): OKR!

    # Key Result subscriptions
    keyResultUpdated(okrId: ID): KeyResult!
    keyResultProgressUpdated(okrId: ID): KeyResult!
    keyResultStatusChanged(okrId: ID): KeyResult!

    # Comment subscriptions
    newComment(okrId: ID): OKRComment!
    commentUpdated(okrId: ID): OKRComment!
    commentResolved(okrId: ID): OKRComment!
    commentReactionAdded(okrId: ID): OKRComment!

    # Organization subscriptions
    organizationUpdated(organizationId: ID): Organization!
    newOrganizationMember(organizationId: ID): User!
    organizationMemberLeft(organizationId: ID): User!

    # User activity subscriptions
    userActivity(organizationId: ID): UserActivity!
    userPresence(organizationId: ID): UserPresence!

    # System notifications
    systemNotification(userId: ID): SystemNotification!
    organizationNotification(organizationId: ID): OrganizationNotification!
  }

  # Additional types for subscriptions
  type UserActivity {
    userId: ID!
    user: User!
    action: String!
    resourceType: String!
    resourceId: ID!
    metadata: JSON
    timestamp: Date!
  }

  type UserPresence {
    userId: ID!
    user: User!
    status: String! # online, away, busy, offline
    lastSeen: Date!
    currentPage: String
  }

  type SystemNotification {
    id: ID!
    type: String!
    title: String!
    message: String!
    priority: String!
    metadata: JSON
    createdAt: Date!
  }

  type OrganizationNotification {
    id: ID!
    organizationId: ID!
    type: String!
    title: String!
    message: String!
    priority: String!
    metadata: JSON
    createdAt: Date!
  }
`