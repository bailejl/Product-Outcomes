import { withFilter } from 'graphql-subscriptions'
import { pubsub, SUBSCRIPTION_EVENTS } from '../pubsub'
import { AuthenticationError, ForbiddenError } from 'apollo-server-express'

// Authentication helper for subscriptions
const requireAuth = (context: any) => {
  if (!context.user) {
    throw new AuthenticationError('Authentication required for subscriptions')
  }
  return context.user
}

// Authorization helpers
const canAccessOKR = async (okrId: string, userId: string, context: any) => {
  // Implementation would check if user has access to this OKR
  // For now, return true - implement actual authorization logic
  return true
}

const canAccessOrganization = async (organizationId: string, userId: string, context: any) => {
  // Implementation would check if user is member of organization
  // For now, return true - implement actual authorization logic
  return true
}

export const subscriptionResolvers = {
  Subscription: {
    // OKR subscriptions
    okrUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.OKR_UPDATED),
        async (payload, variables, context) => {
          const user = requireAuth(context)
          
          // If okrId specified, check access to specific OKR
          if (variables.okrId) {
            return await canAccessOKR(variables.okrId, user.id, context)
          }
          
          // If no okrId, check organization access
          if (payload.organizationId) {
            return await canAccessOrganization(payload.organizationId, user.id, context)
          }
          
          return false
        }
      ),
      resolve: (payload: any) => payload.okrUpdated,
    },

    okrProgressChanged: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.OKR_PROGRESS_CHANGED),
        async (payload, variables, context) => {
          const user = requireAuth(context)
          
          if (variables.organizationId) {
            return await canAccessOrganization(variables.organizationId, user.id, context)
          }
          
          return await canAccessOrganization(payload.organizationId, user.id, context)
        }
      ),
      resolve: (payload: any) => payload.okrProgressChanged,
    },

    okrStatusChanged: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.OKR_STATUS_CHANGED),
        async (payload, variables, context) => {
          const user = requireAuth(context)
          
          if (variables.organizationId) {
            return await canAccessOrganization(variables.organizationId, user.id, context)
          }
          
          return await canAccessOrganization(payload.organizationId, user.id, context)
        }
      ),
      resolve: (payload: any) => payload.okrStatusChanged,
    },

    newOKRCreated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.NEW_OKR_CREATED),
        async (payload, variables, context) => {
          const user = requireAuth(context)
          
          if (variables.organizationId) {
            return await canAccessOrganization(variables.organizationId, user.id, context)
          }
          
          return await canAccessOrganization(payload.organizationId, user.id, context)
        }
      ),
      resolve: (payload: any) => payload.newOKRCreated,
    },

    // Key Result subscriptions
    keyResultUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.KEY_RESULT_UPDATED),
        async (payload, variables, context) => {
          const user = requireAuth(context)
          
          if (variables.okrId) {
            return await canAccessOKR(variables.okrId, user.id, context)
          }
          
          return await canAccessOKR(payload.okrId, user.id, context)
        }
      ),
      resolve: (payload: any) => payload.keyResultUpdated,
    },

    keyResultProgressUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.KEY_RESULT_PROGRESS_UPDATED),
        async (payload, variables, context) => {
          const user = requireAuth(context)
          
          if (variables.okrId) {
            return await canAccessOKR(variables.okrId, user.id, context)
          }
          
          return await canAccessOKR(payload.okrId, user.id, context)
        }
      ),
      resolve: (payload: any) => payload.keyResultProgressUpdated,
    },

    keyResultStatusChanged: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.KEY_RESULT_STATUS_CHANGED),
        async (payload, variables, context) => {
          const user = requireAuth(context)
          
          if (variables.okrId) {
            return await canAccessOKR(variables.okrId, user.id, context)
          }
          
          return await canAccessOKR(payload.okrId, user.id, context)
        }
      ),
      resolve: (payload: any) => payload.keyResultStatusChanged,
    },

    // Comment subscriptions
    newComment: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.NEW_COMMENT),
        async (payload, variables, context) => {
          const user = requireAuth(context)
          
          if (variables.okrId) {
            return await canAccessOKR(variables.okrId, user.id, context)
          }
          
          return await canAccessOKR(payload.okrId, user.id, context)
        }
      ),
      resolve: (payload: any) => payload.newComment,
    },

    commentUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.COMMENT_UPDATED),
        async (payload, variables, context) => {
          const user = requireAuth(context)
          
          if (variables.okrId) {
            return await canAccessOKR(variables.okrId, user.id, context)
          }
          
          return await canAccessOKR(payload.okrId, user.id, context)
        }
      ),
      resolve: (payload: any) => payload.commentUpdated,
    },

    commentResolved: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.COMMENT_RESOLVED),
        async (payload, variables, context) => {
          const user = requireAuth(context)
          
          if (variables.okrId) {
            return await canAccessOKR(variables.okrId, user.id, context)
          }
          
          return await canAccessOKR(payload.okrId, user.id, context)
        }
      ),
      resolve: (payload: any) => payload.commentResolved,
    },

    commentReactionAdded: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.COMMENT_REACTION_ADDED),
        async (payload, variables, context) => {
          const user = requireAuth(context)
          
          if (variables.okrId) {
            return await canAccessOKR(variables.okrId, user.id, context)
          }
          
          return await canAccessOKR(payload.okrId, user.id, context)
        }
      ),
      resolve: (payload: any) => payload.commentReactionAdded,
    },

    // Organization subscriptions
    organizationUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.ORGANIZATION_UPDATED),
        async (payload, variables, context) => {
          const user = requireAuth(context)
          
          if (variables.organizationId) {
            return await canAccessOrganization(variables.organizationId, user.id, context)
          }
          
          return await canAccessOrganization(payload.organizationId, user.id, context)
        }
      ),
      resolve: (payload: any) => payload.organizationUpdated,
    },

    newOrganizationMember: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.NEW_ORGANIZATION_MEMBER),
        async (payload, variables, context) => {
          const user = requireAuth(context)
          
          if (variables.organizationId) {
            return await canAccessOrganization(variables.organizationId, user.id, context)
          }
          
          return await canAccessOrganization(payload.organizationId, user.id, context)
        }
      ),
      resolve: (payload: any) => payload.newOrganizationMember,
    },

    organizationMemberLeft: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.ORGANIZATION_MEMBER_LEFT),
        async (payload, variables, context) => {
          const user = requireAuth(context)
          
          if (variables.organizationId) {
            return await canAccessOrganization(variables.organizationId, user.id, context)
          }
          
          return await canAccessOrganization(payload.organizationId, user.id, context)
        }
      ),
      resolve: (payload: any) => payload.organizationMemberLeft,
    },

    // User activity subscriptions
    userActivity: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.USER_ACTIVITY),
        async (payload, variables, context) => {
          const user = requireAuth(context)
          
          if (variables.organizationId) {
            return await canAccessOrganization(variables.organizationId, user.id, context)
          }
          
          return await canAccessOrganization(payload.organizationId, user.id, context)
        }
      ),
      resolve: (payload: any) => payload.userActivity,
    },

    userPresence: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.USER_PRESENCE),
        async (payload, variables, context) => {
          const user = requireAuth(context)
          
          if (variables.organizationId) {
            return await canAccessOrganization(variables.organizationId, user.id, context)
          }
          
          return await canAccessOrganization(payload.organizationId, user.id, context)
        }
      ),
      resolve: (payload: any) => payload.userPresence,
    },

    // System notification subscriptions
    systemNotification: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.SYSTEM_NOTIFICATION),
        async (payload, variables, context) => {
          const user = requireAuth(context)
          
          if (variables.userId) {
            return user.id === variables.userId
          }
          
          return user.id === payload.userId
        }
      ),
      resolve: (payload: any) => payload.systemNotification,
    },

    organizationNotification: {
      subscribe: withFilter(
        () => pubsub.asyncIterator(SUBSCRIPTION_EVENTS.ORGANIZATION_NOTIFICATION),
        async (payload, variables, context) => {
          const user = requireAuth(context)
          
          if (variables.organizationId) {
            return await canAccessOrganization(variables.organizationId, user.id, context)
          }
          
          return await canAccessOrganization(payload.organizationId, user.id, context)
        }
      ),
      resolve: (payload: any) => payload.organizationNotification,
    },
  },
}