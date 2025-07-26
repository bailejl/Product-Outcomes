import { Namespace } from 'socket.io'
import { AuthenticatedSocket } from '../socketAuth'
import { PresenceManager } from '../presenceManager'
import { socketRateLimiters } from '../rateLimiter'

export class AdminNamespaceHandler {
  private namespace: Namespace
  private presenceManager: PresenceManager
  private adminSockets: Set<string> = new Set()

  constructor(namespace: Namespace, presenceManager: PresenceManager) {
    this.namespace = namespace
    this.presenceManager = presenceManager
    this.setupEventHandlers()
    console.log('⚡ Admin namespace handler initialized')
  }

  private setupEventHandlers(): void {
    this.namespace.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`⚡ Admin ${socket.userId} connected to admin namespace`)

      // Track admin socket
      this.adminSockets.add(socket.id)

      // Join admin broadcast room
      socket.join('admin_broadcast')

      // Send admin dashboard initial data
      this.sendDashboardData(socket)

      // Handle system-wide announcements
      socket.on('admin:broadcast_announcement', (data) => {
        if (socketRateLimiters.broadcast.isAllowed(socket, 'admin:broadcast_announcement')) {
          this.handleBroadcastAnnouncement(socket, data)
        }
      })

      // Handle user management actions
      socket.on('admin:user_action', async (data) => {
        if (socketRateLimiters.critical.isAllowed(socket, 'admin:user_action')) {
          await this.handleUserAction(socket, data)
        }
      })

      // Handle system monitoring requests
      socket.on('admin:get_system_stats', () => {
        if (socketRateLimiters.general.isAllowed(socket, 'admin:get_system_stats')) {
          this.handleGetSystemStats(socket)
        }
      })

      // Handle real-time monitoring toggle
      socket.on('admin:toggle_monitoring', (data) => {
        if (socketRateLimiters.general.isAllowed(socket, 'admin:toggle_monitoring')) {
          this.handleToggleMonitoring(socket, data.enabled)
        }
      })

      // Handle session management
      socket.on('admin:manage_sessions', async (data) => {
        if (socketRateLimiters.critical.isAllowed(socket, 'admin:manage_sessions')) {
          await this.handleManageSessions(socket, data)
        }
      })

      // Handle notification management
      socket.on('admin:send_notification', async (data) => {
        if (socketRateLimiters.critical.isAllowed(socket, 'admin:send_notification')) {
          await this.handleSendNotification(socket, data)
        }
      })

      // Handle system maintenance
      socket.on('admin:maintenance_mode', (data) => {
        if (socketRateLimiters.critical.isAllowed(socket, 'admin:maintenance_mode')) {
          this.handleMaintenanceMode(socket, data)
        }
      })

      // Handle security alerts
      socket.on('admin:security_alert', (data) => {
        if (socketRateLimiters.critical.isAllowed(socket, 'admin:security_alert')) {
          this.handleSecurityAlert(socket, data)
        }
      })

      // Handle performance monitoring
      socket.on('admin:performance_report', () => {
        if (socketRateLimiters.general.isAllowed(socket, 'admin:performance_report')) {
          this.handlePerformanceReport(socket)
        }
      })

      // Handle disconnection
      socket.on('disconnect', () => {
        this.adminSockets.delete(socket.id)
        console.log(`⚡ Admin ${socket.userId} disconnected from admin namespace`)
      })
    })
  }

  private async sendDashboardData(socket: AuthenticatedSocket): Promise<void> {
    try {
      const onlineUsers = await this.presenceManager.getOnlineUsers()
      
      const dashboardData = {
        users: {
          total: onlineUsers.length,
          online: onlineUsers.filter(u => u.status === 'online').length,
          away: onlineUsers.filter(u => u.status === 'away').length,
          busy: onlineUsers.filter(u => u.status === 'busy').length
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date()
        },
        socketStats: this.getSocketStats()
      }

      socket.emit('admin:dashboard_data', dashboardData)
    } catch (error) {
      console.error('Error sending dashboard data:', error)
      socket.emit('error', { message: 'Failed to load dashboard data' })
    }
  }

  private handleBroadcastAnnouncement(socket: AuthenticatedSocket, data: any): void {
    try {
      const { title, message, priority, targetUsers, expiresAt } = data

      const announcement = {
        id: `announcement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        message,
        priority: priority || 'medium',
        sender: {
          id: socket.userId,
          name: socket.user.fullName
        },
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        timestamp: new Date()
      }

      if (targetUsers && targetUsers.length > 0) {
        // Send to specific users
        targetUsers.forEach((userId: string) => {
          this.presenceManager.sendToUser(userId, 'system:announcement', announcement)
        })
      } else {
        // Broadcast to all connected users
        socket.broadcast.emit('system:announcement', announcement)
      }

      // Log announcement
      console.log(`📢 Admin ${socket.userId} broadcasted announcement: ${title}`)

      // Notify other admins
      socket.to('admin_broadcast').emit('admin:announcement_sent', {
        announcement,
        sentBy: socket.user.fullName
      })

      socket.emit('admin:announcement_success', {
        announcementId: announcement.id,
        sentTo: targetUsers ? targetUsers.length : 'all_users'
      })
    } catch (error) {
      console.error('Error broadcasting announcement:', error)
      socket.emit('error', { message: 'Failed to broadcast announcement' })
    }
  }

  private async handleUserAction(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const { action, userId, reason } = data

      switch (action) {
        case 'disconnect':
          await this.disconnectUser(userId, reason)
          break
        case 'ban':
          await this.banUser(userId, reason)
          break
        case 'warn':
          await this.warnUser(userId, reason)
          break
        default:
          socket.emit('error', { message: 'Unknown user action' })
          return
      }

      socket.emit('admin:user_action_success', {
        action,
        userId,
        reason,
        timestamp: new Date()
      })

      // Notify other admins
      socket.to('admin_broadcast').emit('admin:user_action_taken', {
        action,
        userId,
        reason,
        adminId: socket.userId,
        adminName: socket.user.fullName,
        timestamp: new Date()
      })

      console.log(`⚡ Admin ${socket.userId} performed action ${action} on user ${userId}`)
    } catch (error) {
      console.error('Error handling user action:', error)
      socket.emit('error', { message: 'Failed to perform user action' })
    }
  }

  private handleGetSystemStats(socket: AuthenticatedSocket): void {
    try {
      const stats = {
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          version: process.version,
          platform: process.platform
        },
        socket: this.getSocketStats(),
        presence: {
          totalTracked: this.presenceManager.isUserOnline.length, // This would need to be implemented
        },
        timestamp: new Date()
      }

      socket.emit('admin:system_stats', stats)
    } catch (error) {
      console.error('Error getting system stats:', error)
      socket.emit('error', { message: 'Failed to get system stats' })
    }
  }

  private handleToggleMonitoring(socket: AuthenticatedSocket, enabled: boolean): void {
    try {
      if (enabled) {
        socket.join('real_time_monitoring')
        this.startRealTimeMonitoring(socket)
      } else {
        socket.leave('real_time_monitoring')
      }

      socket.emit('admin:monitoring_toggled', { enabled, timestamp: new Date() })
    } catch (error) {
      console.error('Error toggling monitoring:', error)
      socket.emit('error', { message: 'Failed to toggle monitoring' })
    }
  }

  private async handleManageSessions(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const { action, sessionIds, userId } = data

      switch (action) {
        case 'invalidate':
          // This would integrate with sessionManager
          socket.emit('admin:sessions_invalidated', {
            sessionIds,
            timestamp: new Date()
          })
          break
        case 'list':
          // This would get session data from sessionManager
          socket.emit('admin:session_list', {
            sessions: [], // Would be populated with actual session data
            timestamp: new Date()
          })
          break
        default:
          socket.emit('error', { message: 'Unknown session action' })
      }
    } catch (error) {
      console.error('Error managing sessions:', error)
      socket.emit('error', { message: 'Failed to manage sessions' })
    }
  }

  private async handleSendNotification(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const { recipientIds, title, message, priority, type } = data

      // This would integrate with the notification system
      const notification = {
        id: `admin_notif_${Date.now()}`,
        title,
        message,
        priority: priority || 'medium',
        type: type || 'system_announcement',
        sender: {
          id: socket.userId,
          name: socket.user.fullName
        },
        timestamp: new Date()
      }

      // Send notifications (this would use the notification namespace)
      recipientIds.forEach((userId: string) => {
        this.presenceManager.sendToUser(userId, 'notification:admin', notification)
      })

      socket.emit('admin:notification_sent', {
        notificationId: notification.id,
        recipients: recipientIds.length
      })

      console.log(`🔔 Admin ${socket.userId} sent notification to ${recipientIds.length} users`)
    } catch (error) {
      console.error('Error sending notification:', error)
      socket.emit('error', { message: 'Failed to send notification' })
    }
  }

  private handleMaintenanceMode(socket: AuthenticatedSocket, data: any): void {
    try {
      const { enabled, message, estimatedDuration } = data

      const maintenanceNotice = {
        enabled,
        message: message || 'System maintenance in progress',
        estimatedDuration,
        startedBy: {
          id: socket.userId,
          name: socket.user.fullName
        },
        timestamp: new Date()
      }

      // Broadcast to all users
      socket.broadcast.emit('system:maintenance_mode', maintenanceNotice)

      // Notify other admins
      socket.to('admin_broadcast').emit('admin:maintenance_toggled', maintenanceNotice)

      socket.emit('admin:maintenance_success', maintenanceNotice)

      console.log(`🔧 Admin ${socket.userId} ${enabled ? 'enabled' : 'disabled'} maintenance mode`)
    } catch (error) {
      console.error('Error handling maintenance mode:', error)
      socket.emit('error', { message: 'Failed to toggle maintenance mode' })
    }
  }

  private handleSecurityAlert(socket: AuthenticatedSocket, data: any): void {
    try {
      const { level, message, userId, ipAddress, action } = data

      const alert = {
        id: `security_${Date.now()}`,
        level, // 'low', 'medium', 'high', 'critical'
        message,
        userId,
        ipAddress,
        action,
        reportedBy: {
          id: socket.userId,
          name: socket.user.fullName
        },
        timestamp: new Date()
      }

      // Notify all admins
      this.namespace.to('admin_broadcast').emit('admin:security_alert', alert)

      console.log(`🚨 Security alert [${level}] reported by admin ${socket.userId}: ${message}`)
    } catch (error) {
      console.error('Error handling security alert:', error)
      socket.emit('error', { message: 'Failed to send security alert' })
    }
  }

  private handlePerformanceReport(socket: AuthenticatedSocket): void {
    try {
      const report = {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime(),
        socketConnections: this.getSocketStats(),
        activeSessions: this.adminSockets.size,
        timestamp: new Date()
      }

      socket.emit('admin:performance_report', report)
    } catch (error) {
      console.error('Error generating performance report:', error)
      socket.emit('error', { message: 'Failed to generate performance report' })
    }
  }

  private async disconnectUser(userId: string, reason: string): Promise<void> {
    const userSockets = this.presenceManager.getUserSockets(userId)
    
    userSockets.forEach(socketId => {
      const socket = this.namespace.sockets.get(socketId)
      if (socket) {
        socket.emit('system:force_disconnect', {
          reason,
          timestamp: new Date()
        })
        socket.disconnect(true)
      }
    })
  }

  private async banUser(userId: string, reason: string): Promise<void> {
    // This would integrate with the user management system
    // For now, we'll just disconnect the user
    await this.disconnectUser(userId, `Banned: ${reason}`)
  }

  private async warnUser(userId: string, reason: string): Promise<void> {
    this.presenceManager.sendToUser(userId, 'system:warning', {
      message: reason,
      timestamp: new Date()
    })
  }

  private getSocketStats() {
    return {
      totalConnections: this.namespace.sockets.size,
      adminConnections: this.adminSockets.size,
      rooms: Array.from(this.namespace.adapter.rooms.keys()),
      timestamp: new Date()
    }
  }

  private startRealTimeMonitoring(socket: AuthenticatedSocket): void {
    const interval = setInterval(() => {
      if (socket.connected && socket.rooms.has('real_time_monitoring')) {
        const stats = {
          memory: process.memoryUsage(),
          connections: this.namespace.sockets.size,
          timestamp: new Date()
        }
        socket.emit('admin:real_time_stats', stats)
      } else {
        clearInterval(interval)
      }
    }, 5000) // Send stats every 5 seconds
  }

  /**
   * Broadcast urgent message to all admins
   */
  public broadcastToAdmins(event: string, data: any): void {
    this.namespace.to('admin_broadcast').emit(event, {
      ...data,
      timestamp: new Date()
    })
  }

  /**
   * Get list of currently connected admins
   */
  public getConnectedAdmins(): string[] {
    return Array.from(this.adminSockets)
  }
}