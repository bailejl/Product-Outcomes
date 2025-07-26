import { Server, Socket } from 'socket.io'
import { UserPresence, PresenceStatus, ActivityType } from '@product-outcomes/database'
import { AppDataSource } from '@product-outcomes/database'
import { AuthenticatedSocket } from './socketAuth'

export interface PresenceUpdate {
  userId: string
  status: PresenceStatus
  activity?: ActivityType
  context?: string
  lastSeen: Date
}

export class PresenceManager {
  private io: Server
  private userSockets: Map<string, Set<string>> = new Map() // userId -> Set of socketIds
  private socketUsers: Map<string, string> = new Map() // socketId -> userId
  private presenceRepository = AppDataSource.getRepository(UserPresence)

  constructor(io: Server) {
    this.io = io
  }

  /**
   * Handle user connection
   */
  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    const userId = socket.userId
    const socketId = socket.id

    // Track socket association
    this.socketUsers.set(socketId, userId)
    
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set())
    }
    this.userSockets.get(userId)!.add(socketId)

    // Update presence in database
    await this.updateUserPresence(userId, PresenceStatus.ONLINE, {
      socketId,
      ipAddress: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'],
    })

    // Broadcast presence update to relevant users
    await this.broadcastPresenceUpdate(userId)

    console.log(`User ${userId} connected with socket ${socketId}`)
  }

  /**
   * Handle user disconnection
   */
  async handleDisconnection(socket: Socket): Promise<void> {
    const socketId = socket.id
    const userId = this.socketUsers.get(socketId)

    if (!userId) return

    // Remove socket tracking
    this.socketUsers.delete(socketId)
    const userSockets = this.userSockets.get(userId)
    
    if (userSockets) {
      userSockets.delete(socketId)
      
      // If no more sockets for this user, mark as offline
      if (userSockets.size === 0) {
        this.userSockets.delete(userId)
        await this.updateUserPresence(userId, PresenceStatus.OFFLINE)
        await this.broadcastPresenceUpdate(userId)
      }
    }

    console.log(`User ${userId} disconnected from socket ${socketId}`)
  }

  /**
   * Update user activity
   */
  async updateActivity(
    userId: string, 
    activity: ActivityType, 
    context?: string
  ): Promise<void> {
    const presence = await this.presenceRepository.findOne({ 
      where: { userId },
      relations: ['user']
    })

    if (presence) {
      presence.currentActivity = activity
      presence.activityContext = context
      presence.lastSeen = new Date()
      await this.presenceRepository.save(presence)

      // Broadcast activity update
      this.io.emit('presence:activity_update', {
        userId,
        activity,
        context,
        lastSeen: presence.lastSeen
      })
    }
  }

  /**
   * Update user status
   */
  async updateStatus(userId: string, status: PresenceStatus): Promise<void> {
    await this.updateUserPresence(userId, status)
    await this.broadcastPresenceUpdate(userId)
  }

  /**
   * Get online users
   */
  async getOnlineUsers(): Promise<PresenceUpdate[]> {
    const onlinePresences = await this.presenceRepository.find({
      where: { status: PresenceStatus.ONLINE },
      relations: ['user']
    })

    return onlinePresences.map(presence => ({
      userId: presence.userId,
      status: presence.status,
      activity: presence.currentActivity,
      context: presence.activityContext,
      lastSeen: presence.lastSeen
    }))
  }

  /**
   * Get user presence
   */
  async getUserPresence(userId: string): Promise<PresenceUpdate | null> {
    const presence = await this.presenceRepository.findOne({
      where: { userId },
      relations: ['user']
    })

    if (!presence) return null

    return {
      userId: presence.userId,
      status: presence.status,
      activity: presence.currentActivity,
      context: presence.activityContext,
      lastSeen: presence.lastSeen
    }
  }

  /**
   * Get users currently viewing/editing a specific OKR
   */
  async getOkrViewers(okrId: string): Promise<PresenceUpdate[]> {
    const viewers = await this.presenceRepository.find({
      where: [
        { 
          currentActivity: ActivityType.VIEWING_OKR, 
          activityContext: okrId,
          status: PresenceStatus.ONLINE 
        },
        { 
          currentActivity: ActivityType.EDITING_OKR, 
          activityContext: okrId,
          status: PresenceStatus.ONLINE 
        }
      ],
      relations: ['user']
    })

    return viewers.map(presence => ({
      userId: presence.userId,
      status: presence.status,
      activity: presence.currentActivity,
      context: presence.activityContext,
      lastSeen: presence.lastSeen
    }))
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId)
  }

  /**
   * Get socket IDs for a user
   */
  getUserSockets(userId: string): string[] {
    const sockets = this.userSockets.get(userId)
    return sockets ? Array.from(sockets) : []
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId: string, event: string, data: any): void {
    const socketIds = this.getUserSockets(userId)
    socketIds.forEach(socketId => {
      this.io.to(socketId).emit(event, data)
    })
  }

  /**
   * Send message to multiple users
   */
  sendToUsers(userIds: string[], event: string, data: any): void {
    userIds.forEach(userId => {
      this.sendToUser(userId, event, data)
    })
  }

  /**
   * Update user presence in database
   */
  private async updateUserPresence(
    userId: string, 
    status: PresenceStatus,
    metadata?: Record<string, any>
  ): Promise<void> {
    let presence = await this.presenceRepository.findOne({ where: { userId } })

    if (!presence) {
      presence = this.presenceRepository.create({
        userId,
        status,
        lastSeen: new Date(),
        metadata
      })
    } else {
      presence.updateStatus(status)
      if (metadata) {
        presence.metadata = { ...presence.metadata, ...metadata }
      }
    }

    await this.presenceRepository.save(presence)
  }

  /**
   * Broadcast presence update to relevant users
   */
  private async broadcastPresenceUpdate(userId: string): Promise<void> {
    const presence = await this.getUserPresence(userId)
    if (presence) {
      // Broadcast to all connected users (you may want to filter based on relationships)
      this.io.emit('presence:user_update', presence)
    }
  }

  /**
   * Clean up inactive presences (call periodically)
   */
  async cleanupInactivePresences(): Promise<void> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    
    // Mark users as offline if their last socket connection was > 5 minutes ago
    // and they're not currently tracked as having active sockets
    const stalePresences = await this.presenceRepository
      .createQueryBuilder('presence')
      .where('presence.status != :offline', { offline: PresenceStatus.OFFLINE })
      .andWhere('presence.lastSeen < :cutoff', { cutoff: fiveMinutesAgo })
      .getMany()

    for (const presence of stalePresences) {
      if (!this.isUserOnline(presence.userId)) {
        presence.updateStatus(PresenceStatus.OFFLINE)
        await this.presenceRepository.save(presence)
        await this.broadcastPresenceUpdate(presence.userId)
      }
    }
  }
}

// Clean up inactive presences every 2 minutes
setInterval(() => {
  // This will be initialized when the PresenceManager is created
}, 2 * 60 * 1000)