import { RedisPubSub } from 'graphql-redis-subscriptions'
import Redis from 'ioredis'

// Create Redis clients for pub/sub
const createRedisClient = () => {
  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_SUBSCRIPTIONS_DB || '1'), // Use different DB for subscriptions
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  })
}

// Create PubSub instance with Redis
export const pubsub = new RedisPubSub({
  publisher: createRedisClient(),
  subscriber: createRedisClient(),
  messageEventName: 'message',
  pmessageEventName: 'pmessage',
})

// Subscription event names
export const SUBSCRIPTION_EVENTS = {
  // OKR events
  OKR_UPDATED: 'OKR_UPDATED',
  OKR_PROGRESS_CHANGED: 'OKR_PROGRESS_CHANGED',
  OKR_STATUS_CHANGED: 'OKR_STATUS_CHANGED',
  NEW_OKR_CREATED: 'NEW_OKR_CREATED',

  // Key Result events
  KEY_RESULT_UPDATED: 'KEY_RESULT_UPDATED',
  KEY_RESULT_PROGRESS_UPDATED: 'KEY_RESULT_PROGRESS_UPDATED',
  KEY_RESULT_STATUS_CHANGED: 'KEY_RESULT_STATUS_CHANGED',

  // Comment events
  NEW_COMMENT: 'NEW_COMMENT',
  COMMENT_UPDATED: 'COMMENT_UPDATED',
  COMMENT_RESOLVED: 'COMMENT_RESOLVED',
  COMMENT_REACTION_ADDED: 'COMMENT_REACTION_ADDED',

  // Organization events
  ORGANIZATION_UPDATED: 'ORGANIZATION_UPDATED',
  NEW_ORGANIZATION_MEMBER: 'NEW_ORGANIZATION_MEMBER',
  ORGANIZATION_MEMBER_LEFT: 'ORGANIZATION_MEMBER_LEFT',

  // User activity events
  USER_ACTIVITY: 'USER_ACTIVITY',
  USER_PRESENCE: 'USER_PRESENCE',

  // System events
  SYSTEM_NOTIFICATION: 'SYSTEM_NOTIFICATION',
  ORGANIZATION_NOTIFICATION: 'ORGANIZATION_NOTIFICATION',
} as const

// Helper functions to publish events
export class SubscriptionPublisher {
  // OKR event publishers
  static async publishOKRUpdated(okr: any, organizationId?: string) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.OKR_UPDATED, {
      okrUpdated: okr,
      organizationId,
    })
  }

  static async publishOKRProgressChanged(okr: any, organizationId: string) {
    await Promise.all([
      pubsub.publish(SUBSCRIPTION_EVENTS.OKR_PROGRESS_CHANGED, {
        okrProgressChanged: okr,
        organizationId,
      }),
      pubsub.publish(SUBSCRIPTION_EVENTS.OKR_UPDATED, {
        okrUpdated: okr,
        organizationId,
      }),
    ])
  }

  static async publishOKRStatusChanged(okr: any, organizationId: string) {
    await Promise.all([
      pubsub.publish(SUBSCRIPTION_EVENTS.OKR_STATUS_CHANGED, {
        okrStatusChanged: okr,
        organizationId,
      }),
      pubsub.publish(SUBSCRIPTION_EVENTS.OKR_UPDATED, {
        okrUpdated: okr,
        organizationId,
      }),
    ])
  }

  static async publishNewOKR(okr: any, organizationId: string) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.NEW_OKR_CREATED, {
      newOKRCreated: okr,
      organizationId,
    })
  }

  // Key Result event publishers
  static async publishKeyResultUpdated(keyResult: any, okrId: string) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.KEY_RESULT_UPDATED, {
      keyResultUpdated: keyResult,
      okrId,
    })
  }

  static async publishKeyResultProgressUpdated(keyResult: any, okrId: string) {
    await Promise.all([
      pubsub.publish(SUBSCRIPTION_EVENTS.KEY_RESULT_PROGRESS_UPDATED, {
        keyResultProgressUpdated: keyResult,
        okrId,
      }),
      pubsub.publish(SUBSCRIPTION_EVENTS.KEY_RESULT_UPDATED, {
        keyResultUpdated: keyResult,
        okrId,
      }),
    ])
  }

  static async publishKeyResultStatusChanged(keyResult: any, okrId: string) {
    await Promise.all([
      pubsub.publish(SUBSCRIPTION_EVENTS.KEY_RESULT_STATUS_CHANGED, {
        keyResultStatusChanged: keyResult,
        okrId,
      }),
      pubsub.publish(SUBSCRIPTION_EVENTS.KEY_RESULT_UPDATED, {
        keyResultUpdated: keyResult,
        okrId,
      }),
    ])
  }

  // Comment event publishers
  static async publishNewComment(comment: any, okrId: string) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.NEW_COMMENT, {
      newComment: comment,
      okrId,
    })
  }

  static async publishCommentUpdated(comment: any, okrId: string) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.COMMENT_UPDATED, {
      commentUpdated: comment,
      okrId,
    })
  }

  static async publishCommentResolved(comment: any, okrId: string) {
    await Promise.all([
      pubsub.publish(SUBSCRIPTION_EVENTS.COMMENT_RESOLVED, {
        commentResolved: comment,
        okrId,
      }),
      pubsub.publish(SUBSCRIPTION_EVENTS.COMMENT_UPDATED, {
        commentUpdated: comment,
        okrId,
      }),
    ])
  }

  static async publishCommentReactionAdded(comment: any, okrId: string) {
    await Promise.all([
      pubsub.publish(SUBSCRIPTION_EVENTS.COMMENT_REACTION_ADDED, {
        commentReactionAdded: comment,
        okrId,
      }),
      pubsub.publish(SUBSCRIPTION_EVENTS.COMMENT_UPDATED, {
        commentUpdated: comment,
        okrId,
      }),
    ])
  }

  // Organization event publishers
  static async publishOrganizationUpdated(organization: any) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.ORGANIZATION_UPDATED, {
      organizationUpdated: organization,
      organizationId: organization.id,
    })
  }

  static async publishNewOrganizationMember(user: any, organizationId: string) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.NEW_ORGANIZATION_MEMBER, {
      newOrganizationMember: user,
      organizationId,
    })
  }

  static async publishOrganizationMemberLeft(user: any, organizationId: string) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.ORGANIZATION_MEMBER_LEFT, {
      organizationMemberLeft: user,
      organizationId,
    })
  }

  // User activity publishers
  static async publishUserActivity(activity: any, organizationId: string) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.USER_ACTIVITY, {
      userActivity: activity,
      organizationId,
    })
  }

  static async publishUserPresence(presence: any, organizationId: string) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.USER_PRESENCE, {
      userPresence: presence,
      organizationId,
    })
  }

  // System notification publishers
  static async publishSystemNotification(notification: any, userId: string) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.SYSTEM_NOTIFICATION, {
      systemNotification: notification,
      userId,
    })
  }

  static async publishOrganizationNotification(notification: any, organizationId: string) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.ORGANIZATION_NOTIFICATION, {
      organizationNotification: notification,
      organizationId,
    })
  }
}

// Helper function to create subscription filters
export const withFilter = (asyncIterator: any, filter: (payload: any, variables: any, context: any) => boolean) => {
  return {
    [Symbol.asyncIterator]: () => {
      const iterator = asyncIterator[Symbol.asyncIterator]()
      return {
        async next() {
          while (true) {
            const { value, done } = await iterator.next()
            if (done) return { done }
            
            try {
              if (await filter(value, {}, {})) {
                return { value, done: false }
              }
            } catch (error) {
              console.error('Subscription filter error:', error)
              // Continue to next value on filter error
            }
          }
        },
        async return() {
          return iterator.return?.() || { done: true }
        },
        async throw(error: any) {
          return iterator.throw?.(error) || { done: true }
        },
      }
    },
  }
}

// Cleanup function for graceful shutdown
export const cleanupPubSub = async () => {
  try {
    await pubsub.close()
    console.log('📡 PubSub connections closed successfully')
  } catch (error) {
    console.error('❌ Error closing PubSub connections:', error)
  }
}