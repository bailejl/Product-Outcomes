// Integration file to bridge GraphQL subscriptions with existing Socket.io setup
import { SubscriptionPublisher } from './pubsub'
import { SocketServer } from '../websocket/socketServer'

export class GraphQLSocketIntegration {
  private socketServer: SocketServer

  constructor(socketServer: SocketServer) {
    this.socketServer = socketServer
  }

  // Bridge Socket.io events to GraphQL subscriptions
  setupBridge() {
    // Listen for Socket.io events and republish as GraphQL subscriptions
    
    // OKR Events
    this.socketServer.onOKRUpdate((data) => {
      SubscriptionPublisher.publishOKRUpdated(data.okr, data.organizationId)
    })

    this.socketServer.onOKRProgressUpdate((data) => {
      SubscriptionPublisher.publishOKRProgressChanged(data.okr, data.organizationId)
    })

    this.socketServer.onOKRStatusChange((data) => {
      SubscriptionPublisher.publishOKRStatusChanged(data.okr, data.organizationId)
    })

    this.socketServer.onNewOKR((data) => {
      SubscriptionPublisher.publishNewOKR(data.okr, data.organizationId)
    })

    // Key Result Events
    this.socketServer.onKeyResultUpdate((data) => {
      SubscriptionPublisher.publishKeyResultUpdated(data.keyResult, data.okrId)
    })

    this.socketServer.onKeyResultProgressUpdate((data) => {
      SubscriptionPublisher.publishKeyResultProgressUpdated(data.keyResult, data.okrId)
    })

    // Comment Events
    this.socketServer.onNewComment((data) => {
      SubscriptionPublisher.publishNewComment(data.comment, data.okrId)
    })

    this.socketServer.onCommentUpdate((data) => {
      SubscriptionPublisher.publishCommentUpdated(data.comment, data.okrId)
    })

    // User Activity Events
    this.socketServer.onUserActivity((data) => {
      SubscriptionPublisher.publishUserActivity(data.activity, data.organizationId)
    })

    this.socketServer.onUserPresence((data) => {
      SubscriptionPublisher.publishUserPresence(data.presence, data.organizationId)
    })

    // Organization Events
    this.socketServer.onOrganizationUpdate((data) => {
      SubscriptionPublisher.publishOrganizationUpdated(data.organization)
    })

    console.log('✅ GraphQL-Socket.io bridge initialized')
  }

  // Methods to emit events from GraphQL mutations to Socket.io
  async emitOKRUpdate(okr: any, organizationId: string) {
    // Emit to Socket.io clients
    this.socketServer.emitOKRUpdate(okr, organizationId)
    
    // Also publish GraphQL subscription
    await SubscriptionPublisher.publishOKRUpdated(okr, organizationId)
  }

  async emitOKRProgressUpdate(okr: any, organizationId: string) {
    this.socketServer.emitOKRProgressUpdate(okr, organizationId)
    await SubscriptionPublisher.publishOKRProgressChanged(okr, organizationId)
  }

  async emitKeyResultUpdate(keyResult: any, okrId: string) {
    this.socketServer.emitKeyResultUpdate(keyResult, okrId)
    await SubscriptionPublisher.publishKeyResultUpdated(keyResult, okrId)
  }

  async emitNewComment(comment: any, okrId: string) {
    this.socketServer.emitNewComment(comment, okrId)
    await SubscriptionPublisher.publishNewComment(comment, okrId)
  }

  async emitUserActivity(activity: any, organizationId: string) {
    this.socketServer.emitUserActivity(activity, organizationId)
    await SubscriptionPublisher.publishUserActivity(activity, organizationId)
  }

  async emitSystemNotification(notification: any, userId: string) {
    this.socketServer.emitSystemNotification(notification, userId)
    await SubscriptionPublisher.publishSystemNotification(notification, userId)
  }

  async emitOrganizationNotification(notification: any, organizationId: string) {
    this.socketServer.emitOrganizationNotification(notification, organizationId)
    await SubscriptionPublisher.publishOrganizationNotification(notification, organizationId)
  }

  // Cleanup method
  cleanup() {
    console.log('🔄 Cleaning up GraphQL-Socket.io bridge...')
    // Remove event listeners if needed
  }
}

// Singleton instance
let integrationInstance: GraphQLSocketIntegration | null = null

export const createGraphQLSocketIntegration = (socketServer: SocketServer): GraphQLSocketIntegration => {
  if (!integrationInstance) {
    integrationInstance = new GraphQLSocketIntegration(socketServer)
    integrationInstance.setupBridge()
  }
  return integrationInstance
}

export const getGraphQLSocketIntegration = (): GraphQLSocketIntegration | null => {
  return integrationInstance
}