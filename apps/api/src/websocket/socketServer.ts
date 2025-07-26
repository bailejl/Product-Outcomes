import { Server as HttpServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { SocketAuthMiddleware, AuthenticatedSocket } from './socketAuth'
import { PresenceManager } from './presenceManager'
import { socketRateLimiters } from './rateLimiter'
import { OkrNamespaceHandler } from './namespaces/okrNamespace'
import { NotificationNamespaceHandler } from './namespaces/notificationNamespace'
import { CollaborationNamespaceHandler } from './namespaces/collaborationNamespace'
import { AdminNamespaceHandler } from './namespaces/adminNamespace'

export class SocketServer {
  private io: SocketIOServer
  private auth: SocketAuthMiddleware
  private presenceManager: PresenceManager
  private connectedUsers: Map<string, Set<string>> = new Map()

  constructor(httpServer: HttpServer) {
    // Initialize Socket.IO server with CORS configuration
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:4200',
        credentials: true,
        methods: ['GET', 'POST']
      },
      allowEIO3: true,
      transports: ['polling', 'websocket'],
      pingTimeout: 60000,
      pingInterval: 25000
    })

    this.auth = new SocketAuthMiddleware()
    this.presenceManager = new PresenceManager(this.io)

    this.setupMiddleware()
    this.setupNamespaces()
    this.setupEventHandlers()
    this.setupCleanupTasks()

    console.log('🔌 Socket.IO server initialized')
  }

  /**
   * Setup global middleware
   */
  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use((socket, next) => {
      this.auth.authenticate(socket, next)
    })

    // Rate limiting middleware
    this.io.use((socket, next) => {
      // Attach rate limiters to socket for later use
      ;(socket as any).rateLimiters = socketRateLimiters
      next()
    })

    // Logging middleware
    this.io.use((socket, next) => {
      console.log(`Socket connection attempt: ${socket.id} from ${socket.handshake.address}`)
      next()
    })
  }

  /**
   * Setup namespaces for different feature areas
   */
  private setupNamespaces(): void {
    // OKR namespace for OKR-related real-time features
    const okrNamespace = this.io.of('/okr')
    okrNamespace.use((socket, next) => this.auth.authenticate(socket, next))
    new OkrNamespaceHandler(okrNamespace, this.presenceManager)

    // Notification namespace for real-time notifications
    const notificationNamespace = this.io.of('/notifications')
    notificationNamespace.use((socket, next) => this.auth.authenticate(socket, next))
    new NotificationNamespaceHandler(notificationNamespace, this.presenceManager)

    // Collaboration namespace for collaborative editing and presence
    const collaborationNamespace = this.io.of('/collaboration')
    collaborationNamespace.use((socket, next) => this.auth.authenticate(socket, next))
    new CollaborationNamespaceHandler(collaborationNamespace, this.presenceManager)

    // Admin namespace for administrative real-time features
    const adminNamespace = this.io.of('/admin')
    adminNamespace.use((socket, next) => this.auth.authenticate(socket, next))
    adminNamespace.use(this.auth.requireRole(['Administrator']))
    new AdminNamespaceHandler(adminNamespace, this.presenceManager)

    console.log('🏷️ Socket.IO namespaces configured: /okr, /notifications, /collaboration, /admin')
  }

  /**
   * Setup main namespace event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', async (socket: AuthenticatedSocket) => {
      const userId = socket.userId
      const socketId = socket.id

      console.log(`✅ User ${userId} connected (${socketId})`)

      // Handle presence
      await this.presenceManager.handleConnection(socket)

      // Track user connection
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set())
      }
      this.connectedUsers.get(userId)!.add(socketId)

      // Send initial data
      await this.sendInitialData(socket)

      // Handle presence updates
      socket.on('presence:update_status', async (data) => {
        if (socketRateLimiters.general.isAllowed(socket, 'presence:update_status')) {
          await this.presenceManager.updateStatus(userId, data.status)
        }
      })

      socket.on('presence:update_activity', async (data) => {
        if (socketRateLimiters.highFrequency.isAllowed(socket, 'presence:update_activity')) {
          await this.presenceManager.updateActivity(userId, data.activity, data.context)
        }
      })

      // Handle typing indicators
      socket.on('typing:start', (data) => {
        if (socketRateLimiters.highFrequency.isAllowed(socket, 'typing:start')) {
          socket.broadcast.emit('typing:user_typing', {
            userId,
            context: data.context,
            timestamp: new Date()
          })
        }
      })

      socket.on('typing:stop', (data) => {
        if (socketRateLimiters.highFrequency.isAllowed(socket, 'typing:stop')) {
          socket.broadcast.emit('typing:user_stopped', {
            userId,
            context: data.context,
            timestamp: new Date()
          })
        }
      })

      // Handle generic messaging
      socket.on('message:send', async (data) => {
        if (socketRateLimiters.general.isAllowed(socket, 'message:send')) {
          // Emit to all connected clients
          this.io.emit('message:received', {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: data.content,
            senderId: userId,
            senderName: socket.user.fullName,
            timestamp: new Date(),
            type: data.type || 'general'
          })
        }
      })

      // Handle heartbeat for connection monitoring
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() })
      })

      // Handle disconnection
      socket.on('disconnect', async (reason) => {
        console.log(`❌ User ${userId} disconnected (${socketId}): ${reason}`)
        
        await this.presenceManager.handleDisconnection(socket)
        
        // Clean up user tracking
        const userSockets = this.connectedUsers.get(userId)
        if (userSockets) {
          userSockets.delete(socketId)
          if (userSockets.size === 0) {
            this.connectedUsers.delete(userId)
          }
        }
      })

      // Error handling
      socket.on('error', (error) => {
        console.error(`Socket error for user ${userId}:`, error)
      })
    })
  }

  /**
   * Send initial data to newly connected socket
   */
  private async sendInitialData(socket: AuthenticatedSocket): Promise<void> {
    try {
      // Send current online users
      const onlineUsers = await this.presenceManager.getOnlineUsers()
      socket.emit('presence:online_users', onlineUsers)

      // Send connection confirmation
      socket.emit('connection:confirmed', {
        userId: socket.userId,
        socketId: socket.id,
        timestamp: new Date(),
        serverTime: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error sending initial data:', error)
    }
  }

  /**
   * Setup cleanup tasks
   */
  private setupCleanupTasks(): void {
    // Clean up inactive presences every 2 minutes
    setInterval(() => {
      this.presenceManager.cleanupInactivePresences()
    }, 2 * 60 * 1000)

    // Log connection stats every 5 minutes
    setInterval(() => {
      const totalConnections = this.io.engine.clientsCount
      const totalUsers = this.connectedUsers.size
      console.log(`📊 Socket.IO Stats: ${totalConnections} connections, ${totalUsers} unique users`)
    }, 5 * 60 * 1000)
  }

  /**
   * Get Socket.IO server instance
   */
  getIO(): SocketIOServer {
    return this.io
  }

  /**
   * Get presence manager
   */
  getPresenceManager(): PresenceManager {
    return this.presenceManager
  }

  /**
   * Send notification to specific user
   */
  sendNotificationToUser(userId: string, notification: any): void {
    this.presenceManager.sendToUser(userId, 'notification:new', notification)
  }

  /**
   * Send notification to multiple users
   */
  sendNotificationToUsers(userIds: string[], notification: any): void {
    this.presenceManager.sendToUsers(userIds, 'notification:new', notification)
  }

  /**
   * Broadcast system announcement
   */
  broadcastAnnouncement(announcement: any): void {
    this.io.emit('system:announcement', announcement)
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      totalConnections: this.io.engine.clientsCount,
      totalUsers: this.connectedUsers.size,
      namespaces: {
        main: this.io.sockets.sockets.size,
        okr: this.io.of('/okr').sockets.size,
        notifications: this.io.of('/notifications').sockets.size,
        collaboration: this.io.of('/collaboration').sockets.size,
        admin: this.io.of('/admin').sockets.size
      }
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🔌 Shutting down Socket.IO server...')
    
    // Notify all clients
    this.io.emit('system:shutdown', {
      message: 'Server is shutting down',
      timestamp: new Date()
    })

    // Close all connections
    this.io.close(() => {
      console.log('✅ Socket.IO server shut down')
    })
  }
}