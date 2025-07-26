import { Namespace } from 'socket.io'
import { AuthenticatedSocket } from '../socketAuth'
import { PresenceManager } from '../presenceManager'
import { socketRateLimiters } from '../rateLimiter'
import { AppDataSource } from '@product-outcomes/database'
import { Notification, NotificationType, NotificationPriority } from '@product-outcomes/database'

export class NotificationNamespaceHandler {
  private namespace: Namespace
  private presenceManager: PresenceManager
  private notificationRepository = AppDataSource.getRepository(Notification)

  constructor(namespace: Namespace, presenceManager: PresenceManager) {
    this.namespace = namespace
    this.presenceManager = presenceManager
    this.setupEventHandlers()
    console.log('🔔 Notification namespace handler initialized')
  }

  private setupEventHandlers(): void {
    this.namespace.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`🔔 User ${socket.userId} connected to notifications namespace`)

      // Join user to their personal notification room
      socket.join(`notifications:${socket.userId}`)

      // Send unread notifications count on connect
      this.sendUnreadCount(socket)

      // Handle marking notifications as read
      socket.on('notification:mark_read', async (data) => {
        if (socketRateLimiters.general.isAllowed(socket, 'notification:mark_read')) {
          await this.handleMarkAsRead(socket, data.notificationId)
        }
      })

      // Handle marking all notifications as read
      socket.on('notification:mark_all_read', async () => {
        if (socketRateLimiters.general.isAllowed(socket, 'notification:mark_all_read')) {
          await this.handleMarkAllAsRead(socket)
        }
      })

      // Handle getting notification history
      socket.on('notification:get_history', async (data) => {
        if (socketRateLimiters.general.isAllowed(socket, 'notification:get_history')) {
          await this.handleGetHistory(socket, data)
        }
      })

      // Handle deleting notification
      socket.on('notification:delete', async (data) => {
        if (socketRateLimiters.general.isAllowed(socket, 'notification:delete')) {
          await this.handleDeleteNotification(socket, data.notificationId)
        }
      })

      // Handle subscribing to specific notification types
      socket.on('notification:subscribe', (data) => {
        if (socketRateLimiters.general.isAllowed(socket, 'notification:subscribe')) {
          this.handleSubscribe(socket, data.types)
        }
      })

      // Handle unsubscribing from notification types
      socket.on('notification:unsubscribe', (data) => {
        if (socketRateLimiters.general.isAllowed(socket, 'notification:unsubscribe')) {
          this.handleUnsubscribe(socket, data.types)
        }
      })

      // Handle creating custom notification (admin only)
      socket.on('notification:create', async (data) => {
        if (socketRateLimiters.critical.isAllowed(socket, 'notification:create')) {
          if (socket.user.isAdmin()) {
            await this.handleCreateNotification(socket, data)
          } else {
            socket.emit('error', { message: 'Insufficient permissions' })
          }
        }
      })

      socket.on('disconnect', () => {
        console.log(`🔔 User ${socket.userId} disconnected from notifications namespace`)
      })
    })
  }

  private async sendUnreadCount(socket: AuthenticatedSocket): Promise<void> {
    try {
      const unreadCount = await this.notificationRepository.count({
        where: {
          recipientId: socket.userId,
          isRead: false
        }
      })

      socket.emit('notification:unread_count', { count: unreadCount })
    } catch (error) {
      console.error('Error sending unread count:', error)
    }
  }

  private async handleMarkAsRead(socket: AuthenticatedSocket, notificationId: string): Promise<void> {
    try {
      const notification = await this.notificationRepository.findOne({
        where: {
          id: notificationId,
          recipientId: socket.userId
        }
      })

      if (!notification) {
        socket.emit('error', { message: 'Notification not found' })
        return
      }

      if (!notification.isRead) {
        notification.markAsRead()
        await this.notificationRepository.save(notification)

        socket.emit('notification:marked_read', {
          notificationId,
          readAt: notification.readAt
        })

        // Send updated unread count
        await this.sendUnreadCount(socket)
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
      socket.emit('error', { message: 'Failed to mark notification as read' })
    }
  }

  private async handleMarkAllAsRead(socket: AuthenticatedSocket): Promise<void> {
    try {
      const result = await this.notificationRepository.update(
        {
          recipientId: socket.userId,
          isRead: false
        },
        {
          isRead: true,
          readAt: new Date()
        }
      )

      socket.emit('notification:all_marked_read', {
        markedCount: result.affected || 0,
        timestamp: new Date()
      })

      // Send updated unread count
      await this.sendUnreadCount(socket)
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      socket.emit('error', { message: 'Failed to mark all notifications as read' })
    }
  }

  private async handleGetHistory(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const { page = 1, limit = 20, types, read } = data

      const queryBuilder = this.notificationRepository
        .createQueryBuilder('notification')
        .leftJoinAndSelect('notification.sender', 'sender')
        .where('notification.recipientId = :userId', { userId: socket.userId })
        .orderBy('notification.createdAt', 'DESC')
        .take(limit)
        .skip((page - 1) * limit)

      if (types && types.length > 0) {
        queryBuilder.andWhere('notification.type IN (:...types)', { types })
      }

      if (read !== undefined) {
        queryBuilder.andWhere('notification.isRead = :read', { read })
      }

      const [notifications, total] = await queryBuilder.getManyAndCount()

      socket.emit('notification:history', {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      })
    } catch (error) {
      console.error('Error getting notification history:', error)
      socket.emit('error', { message: 'Failed to get notification history' })
    }
  }

  private async handleDeleteNotification(socket: AuthenticatedSocket, notificationId: string): Promise<void> {
    try {
      const result = await this.notificationRepository.delete({
        id: notificationId,
        recipientId: socket.userId
      })

      if (result.affected === 0) {
        socket.emit('error', { message: 'Notification not found' })
        return
      }

      socket.emit('notification:deleted', { notificationId })

      // Send updated unread count
      await this.sendUnreadCount(socket)
    } catch (error) {
      console.error('Error deleting notification:', error)
      socket.emit('error', { message: 'Failed to delete notification' })
    }
  }

  private handleSubscribe(socket: AuthenticatedSocket, types: NotificationType[]): void {
    types.forEach(type => {
      socket.join(`notification_type:${type}`)
    })

    socket.emit('notification:subscribed', { types })
    console.log(`🔔 User ${socket.userId} subscribed to notification types: ${types.join(', ')}`)
  }

  private handleUnsubscribe(socket: AuthenticatedSocket, types: NotificationType[]): void {
    types.forEach(type => {
      socket.leave(`notification_type:${type}`)
    })

    socket.emit('notification:unsubscribed', { types })
    console.log(`🔔 User ${socket.userId} unsubscribed from notification types: ${types.join(', ')}`)
  }

  private async handleCreateNotification(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const {
        recipientIds,
        type,
        title,
        message,
        priority = NotificationPriority.MEDIUM,
        actionUrl,
        metadata,
        expiresAt
      } = data

      if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
        socket.emit('error', { message: 'Recipient IDs are required' })
        return
      }

      const notifications = recipientIds.map(recipientId => {
        return this.notificationRepository.create({
          type,
          title,
          message,
          priority,
          actionUrl,
          metadata,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          recipientId,
          senderId: socket.userId
        })
      })

      const savedNotifications = await this.notificationRepository.save(notifications)

      // Send notifications to recipients
      savedNotifications.forEach(notification => {
        this.sendNotificationToUser(notification.recipientId, notification)
      })

      socket.emit('notification:created', {
        count: savedNotifications.length,
        notificationIds: savedNotifications.map(n => n.id)
      })

      console.log(`🔔 Admin ${socket.userId} created ${savedNotifications.length} notifications`)
    } catch (error) {
      console.error('Error creating notification:', error)
      socket.emit('error', { message: 'Failed to create notification' })
    }
  }

  /**
   * Send notification to specific user
   */
  public async sendNotificationToUser(userId: string, notification: Notification): Promise<void> {
    // Send to user's notification room
    this.namespace.to(`notifications:${userId}`).emit('notification:new', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      priority: notification.priority,
      actionUrl: notification.actionUrl,
      metadata: notification.metadata,
      senderId: notification.senderId,
      createdAt: notification.createdAt,
      timestamp: new Date()
    })

    // Also send to type-specific rooms if user is subscribed
    this.namespace.to(`notification_type:${notification.type}`).emit('notification:type_update', {
      type: notification.type,
      notification: {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        createdAt: notification.createdAt
      }
    })

    console.log(`🔔 Notification sent to user ${userId}: ${notification.title}`)
  }

  /**
   * Send notification to multiple users
   */
  public async sendNotificationToUsers(userIds: string[], notification: Notification): Promise<void> {
    const promises = userIds.map(userId => this.sendNotificationToUser(userId, notification))
    await Promise.all(promises)
  }

  /**
   * Broadcast system notification to all connected users
   */
  public broadcastSystemNotification(notification: any): void {
    this.namespace.emit('notification:system', {
      ...notification,
      timestamp: new Date()
    })

    console.log(`📢 System notification broadcasted: ${notification.title}`)
  }

  /**
   * Send notification by type to subscribed users
   */
  public sendNotificationByType(type: NotificationType, notification: any): void {
    this.namespace.to(`notification_type:${type}`).emit('notification:type_broadcast', {
      type,
      ...notification,
      timestamp: new Date()
    })

    console.log(`🔔 Type-specific notification sent (${type}): ${notification.title}`)
  }
}