import { Namespace } from 'socket.io'
import { AuthenticatedSocket } from '../socketAuth'
import { PresenceManager } from '../presenceManager'
import { socketRateLimiters } from '../rateLimiter'
import { ActivityType } from '@product-outcomes/database'

interface CollaborativeSession {
  id: string
  documentId: string
  participants: Set<string>
  owner: string
  created: Date
  lastActivity: Date
}

interface CursorPosition {
  userId: string
  userName: string
  documentId: string
  position: {
    line: number
    column: number
  }
  selection?: {
    start: { line: number; column: number }
    end: { line: number; column: number }
  }
  field?: string
  timestamp: Date
}

interface DocumentChange {
  documentId: string
  userId: string
  userName: string
  operation: 'insert' | 'delete' | 'replace'
  position: {
    line: number
    column: number
  }
  content: string
  timestamp: Date
  changeId: string
}

export class CollaborationNamespaceHandler {
  private namespace: Namespace
  private presenceManager: PresenceManager
  private activeSessions: Map<string, CollaborativeSession> = new Map()
  private userCursors: Map<string, CursorPosition> = new Map()
  private documentLocks: Map<string, Set<string>> = new Map() // documentId -> Set of userIds with locks
  private typingUsers: Map<string, Set<string>> = new Map() // documentId -> Set of userIds typing

  constructor(namespace: Namespace, presenceManager: PresenceManager) {
    this.namespace = namespace
    this.presenceManager = presenceManager
    this.setupEventHandlers()
    this.setupCleanupTasks()
    console.log('🤝 Collaboration namespace handler initialized')
  }

  private setupEventHandlers(): void {
    this.namespace.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`🤝 User ${socket.userId} connected to collaboration namespace`)

      // Join user to their personal room
      socket.join(`user:${socket.userId}`)

      // Handle joining a collaborative session
      socket.on('collaboration:join_session', async (data) => {
        if (socketRateLimiters.general.isAllowed(socket, 'collaboration:join_session')) {
          await this.handleJoinSession(socket, data.documentId, data.sessionId)
        }
      })

      // Handle leaving a collaborative session
      socket.on('collaboration:leave_session', async (data) => {
        if (socketRateLimiters.general.isAllowed(socket, 'collaboration:leave_session')) {
          await this.handleLeaveSession(socket, data.documentId, data.sessionId)
        }
      })

      // Handle creating a new collaborative session
      socket.on('collaboration:create_session', async (data) => {
        if (socketRateLimiters.general.isAllowed(socket, 'collaboration:create_session')) {
          await this.handleCreateSession(socket, data.documentId, data.documentType)
        }
      })

      // Handle document changes (operational transformation)
      socket.on('collaboration:document_change', (data) => {
        if (socketRateLimiters.highFrequency.isAllowed(socket, 'collaboration:document_change')) {
          this.handleDocumentChange(socket, data)
        }
      })

      // Handle cursor position updates
      socket.on('collaboration:cursor_update', (data) => {
        if (socketRateLimiters.highFrequency.isAllowed(socket, 'collaboration:cursor_update')) {
          this.handleCursorUpdate(socket, data)
        }
      })

      // Handle text selection updates
      socket.on('collaboration:selection_update', (data) => {
        if (socketRateLimiters.highFrequency.isAllowed(socket, 'collaboration:selection_update')) {
          this.handleSelectionUpdate(socket, data)
        }
      })

      // Handle document locking/unlocking
      socket.on('collaboration:request_lock', async (data) => {
        if (socketRateLimiters.general.isAllowed(socket, 'collaboration:request_lock')) {
          await this.handleRequestLock(socket, data.documentId, data.section)
        }
      })

      socket.on('collaboration:release_lock', (data) => {
        if (socketRateLimiters.general.isAllowed(socket, 'collaboration:release_lock')) {
          this.handleReleaseLock(socket, data.documentId, data.section)
        }
      })

      // Handle typing indicators
      socket.on('collaboration:typing_start', (data) => {
        if (socketRateLimiters.highFrequency.isAllowed(socket, 'collaboration:typing_start')) {
          this.handleTypingStart(socket, data.documentId, data.field)
        }
      })

      socket.on('collaboration:typing_stop', (data) => {
        if (socketRateLimiters.highFrequency.isAllowed(socket, 'collaboration:typing_stop')) {
          this.handleTypingStop(socket, data.documentId, data.field)
        }
      })

      // Handle conflict resolution
      socket.on('collaboration:resolve_conflict', (data) => {
        if (socketRateLimiters.general.isAllowed(socket, 'collaboration:resolve_conflict')) {
          this.handleConflictResolution(socket, data)
        }
      })

      // Handle requesting document state synchronization
      socket.on('collaboration:request_sync', (data) => {
        if (socketRateLimiters.general.isAllowed(socket, 'collaboration:request_sync')) {
          this.handleRequestSync(socket, data.documentId)
        }
      })

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnection(socket)
      })
    })
  }

  private async handleJoinSession(socket: AuthenticatedSocket, documentId: string, sessionId?: string): Promise<void> {
    try {
      // Join document room
      socket.join(`document:${documentId}`)

      // Update presence
      await this.presenceManager.updateActivity(
        socket.userId,
        ActivityType.EDITING_OKR,
        documentId
      )

      // Find or create session
      let session = sessionId ? this.activeSessions.get(sessionId) : null
      if (!session) {
        session = {
          id: sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          documentId,
          participants: new Set([socket.userId]),
          owner: socket.userId,
          created: new Date(),
          lastActivity: new Date()
        }
        this.activeSessions.set(session.id, session)
      } else {
        session.participants.add(socket.userId)
        session.lastActivity = new Date()
      }

      // Store session reference on socket
      ;(socket as any).collaborationSession = session.id

      // Notify others in the document
      socket.to(`document:${documentId}`).emit('collaboration:user_joined', {
        userId: socket.userId,
        userName: socket.user.fullName,
        documentId,
        sessionId: session.id,
        timestamp: new Date()
      })

      // Send current session state to the joining user
      const participants = Array.from(session.participants)
      const cursors = participants
        .map(userId => this.userCursors.get(`${userId}:${documentId}`))
        .filter(cursor => cursor !== undefined)

      socket.emit('collaboration:session_joined', {
        sessionId: session.id,
        documentId,
        participants: participants.length,
        cursors,
        locks: Array.from(this.documentLocks.get(documentId) || []),
        typingUsers: Array.from(this.typingUsers.get(documentId) || [])
      })

      console.log(`🤝 User ${socket.userId} joined collaboration session for document ${documentId}`)
    } catch (error) {
      console.error('Error joining collaboration session:', error)
      socket.emit('error', { message: 'Failed to join collaboration session' })
    }
  }

  private async handleLeaveSession(socket: AuthenticatedSocket, documentId: string, sessionId: string): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId)
      if (session) {
        session.participants.delete(socket.userId)
        
        // If no participants left, remove session
        if (session.participants.size === 0) {
          this.activeSessions.delete(sessionId)
        }
      }

      // Leave document room
      socket.leave(`document:${documentId}`)

      // Clean up user's cursor and locks
      this.userCursors.delete(`${socket.userId}:${documentId}`)
      this.cleanupUserLocks(socket.userId, documentId)
      this.handleTypingStop(socket, documentId)

      // Notify others
      socket.to(`document:${documentId}`).emit('collaboration:user_left', {
        userId: socket.userId,
        userName: socket.user.fullName,
        documentId,
        sessionId,
        timestamp: new Date()
      })

      console.log(`🤝 User ${socket.userId} left collaboration session for document ${documentId}`)
    } catch (error) {
      console.error('Error leaving collaboration session:', error)
    }
  }

  private async handleCreateSession(socket: AuthenticatedSocket, documentId: string, documentType: string): Promise<void> {
    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const session: CollaborativeSession = {
        id: sessionId,
        documentId,
        participants: new Set([socket.userId]),
        owner: socket.userId,
        created: new Date(),
        lastActivity: new Date()
      }

      this.activeSessions.set(sessionId, session)

      socket.emit('collaboration:session_created', {
        sessionId,
        documentId,
        documentType,
        owner: socket.userId,
        timestamp: new Date()
      })

      // Automatically join the session
      await this.handleJoinSession(socket, documentId, sessionId)

      console.log(`🤝 User ${socket.userId} created collaboration session ${sessionId} for document ${documentId}`)
    } catch (error) {
      console.error('Error creating collaboration session:', error)
      socket.emit('error', { message: 'Failed to create collaboration session' })
    }
  }

  private handleDocumentChange(socket: AuthenticatedSocket, data: any): void {
    try {
      const { documentId, operation, position, content, field } = data

      const change: DocumentChange = {
        documentId,
        userId: socket.userId,
        userName: socket.user.fullName,
        operation,
        position,
        content,
        timestamp: new Date(),
        changeId: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }

      // Broadcast change to all other users in the document
      socket.to(`document:${documentId}`).emit('collaboration:document_changed', {
        ...change,
        field
      })

      // Update session activity
      const sessionId = (socket as any).collaborationSession
      if (sessionId) {
        const session = this.activeSessions.get(sessionId)
        if (session) {
          session.lastActivity = new Date()
        }
      }

      console.log(`📝 Document ${documentId} changed by user ${socket.userId}: ${operation}`)
    } catch (error) {
      console.error('Error handling document change:', error)
    }
  }

  private handleCursorUpdate(socket: AuthenticatedSocket, data: any): void {
    try {
      const { documentId, position, field } = data

      const cursor: CursorPosition = {
        userId: socket.userId,
        userName: socket.user.fullName,
        documentId,
        position,
        field,
        timestamp: new Date()
      }

      this.userCursors.set(`${socket.userId}:${documentId}`, cursor)

      // Broadcast cursor position to others
      socket.to(`document:${documentId}`).emit('collaboration:cursor_moved', cursor)
    } catch (error) {
      console.error('Error handling cursor update:', error)
    }
  }

  private handleSelectionUpdate(socket: AuthenticatedSocket, data: any): void {
    try {
      const { documentId, selection, field } = data

      const cursorKey = `${socket.userId}:${documentId}`
      const existingCursor = this.userCursors.get(cursorKey)

      if (existingCursor) {
        existingCursor.selection = selection
        existingCursor.timestamp = new Date()
        this.userCursors.set(cursorKey, existingCursor)

        // Broadcast selection to others
        socket.to(`document:${documentId}`).emit('collaboration:selection_changed', {
          userId: socket.userId,
          userName: socket.user.fullName,
          documentId,
          selection,
          field,
          timestamp: new Date()
        })
      }
    } catch (error) {
      console.error('Error handling selection update:', error)
    }
  }

  private async handleRequestLock(socket: AuthenticatedSocket, documentId: string, section: string): Promise<void> {
    try {
      if (!this.documentLocks.has(documentId)) {
        this.documentLocks.set(documentId, new Set())
      }

      const locks = this.documentLocks.get(documentId)!
      const lockKey = `${socket.userId}:${section}`

      // Check if section is already locked by another user
      const existingLock = Array.from(locks).find(lock => 
        lock.endsWith(`:${section}`) && !lock.startsWith(`${socket.userId}:`)
      )

      if (existingLock) {
        socket.emit('collaboration:lock_denied', {
          documentId,
          section,
          lockedBy: existingLock.split(':')[0],
          reason: 'Section already locked'
        })
        return
      }

      // Grant lock
      locks.add(lockKey)

      socket.emit('collaboration:lock_granted', {
        documentId,
        section,
        timestamp: new Date()
      })

      // Notify others
      socket.to(`document:${documentId}`).emit('collaboration:section_locked', {
        documentId,
        section,
        lockedBy: socket.userId,
        lockedByName: socket.user.fullName,
        timestamp: new Date()
      })

      console.log(`🔒 User ${socket.userId} locked section ${section} in document ${documentId}`)
    } catch (error) {
      console.error('Error handling lock request:', error)
      socket.emit('error', { message: 'Failed to request lock' })
    }
  }

  private handleReleaseLock(socket: AuthenticatedSocket, documentId: string, section: string): void {
    try {
      const locks = this.documentLocks.get(documentId)
      if (locks) {
        const lockKey = `${socket.userId}:${section}`
        locks.delete(lockKey)

        socket.emit('collaboration:lock_released', {
          documentId,
          section,
          timestamp: new Date()
        })

        // Notify others
        socket.to(`document:${documentId}`).emit('collaboration:section_unlocked', {
          documentId,
          section,
          unlockedBy: socket.userId,
          unlockedByName: socket.user.fullName,
          timestamp: new Date()
        })

        console.log(`🔓 User ${socket.userId} released lock on section ${section} in document ${documentId}`)
      }
    } catch (error) {
      console.error('Error handling lock release:', error)
    }
  }

  private handleTypingStart(socket: AuthenticatedSocket, documentId: string, field?: string): void {
    try {
      if (!this.typingUsers.has(documentId)) {
        this.typingUsers.set(documentId, new Set())
      }

      this.typingUsers.get(documentId)!.add(socket.userId)

      socket.to(`document:${documentId}`).emit('collaboration:user_typing', {
        userId: socket.userId,
        userName: socket.user.fullName,
        documentId,
        field,
        timestamp: new Date()
      })
    } catch (error) {
      console.error('Error handling typing start:', error)
    }
  }

  private handleTypingStop(socket: AuthenticatedSocket, documentId: string, field?: string): void {
    try {
      const typingUsers = this.typingUsers.get(documentId)
      if (typingUsers) {
        typingUsers.delete(socket.userId)

        socket.to(`document:${documentId}`).emit('collaboration:user_stopped_typing', {
          userId: socket.userId,
          userName: socket.user.fullName,
          documentId,
          field,
          timestamp: new Date()
        })
      }
    } catch (error) {
      console.error('Error handling typing stop:', error)
    }
  }

  private handleConflictResolution(socket: AuthenticatedSocket, data: any): void {
    try {
      const { documentId, conflictId, resolution, resolvedContent } = data

      socket.to(`document:${documentId}`).emit('collaboration:conflict_resolved', {
        documentId,
        conflictId,
        resolution,
        resolvedContent,
        resolvedBy: socket.userId,
        resolvedByName: socket.user.fullName,
        timestamp: new Date()
      })

      console.log(`⚡ Conflict ${conflictId} resolved by user ${socket.userId} in document ${documentId}`)
    } catch (error) {
      console.error('Error handling conflict resolution:', error)
    }
  }

  private handleRequestSync(socket: AuthenticatedSocket, documentId: string): void {
    try {
      // Get current document state from other participants
      socket.to(`document:${documentId}`).emit('collaboration:sync_requested', {
        documentId,
        requestedBy: socket.userId,
        timestamp: new Date()
      })

      console.log(`🔄 Sync requested by user ${socket.userId} for document ${documentId}`)
    } catch (error) {
      console.error('Error handling sync request:', error)
    }
  }

  private handleDisconnection(socket: AuthenticatedSocket): void {
    try {
      const sessionId = (socket as any).collaborationSession
      if (sessionId) {
        const session = this.activeSessions.get(sessionId)
        if (session) {
          session.participants.delete(socket.userId)
          if (session.participants.size === 0) {
            this.activeSessions.delete(sessionId)
          }
        }
      }

      // Clean up user data
      this.cleanupUserData(socket.userId)

      console.log(`🤝 User ${socket.userId} disconnected from collaboration namespace`)
    } catch (error) {
      console.error('Error handling collaboration disconnection:', error)
    }
  }

  private cleanupUserLocks(userId: string, documentId?: string): void {
    if (documentId) {
      const locks = this.documentLocks.get(documentId)
      if (locks) {
        const userLocks = Array.from(locks).filter(lock => lock.startsWith(`${userId}:`))
        userLocks.forEach(lock => locks.delete(lock))
      }
    } else {
      // Clean up locks for all documents
      this.documentLocks.forEach(locks => {
        const userLocks = Array.from(locks).filter(lock => lock.startsWith(`${userId}:`))
        userLocks.forEach(lock => locks.delete(lock))
      })
    }
  }

  private cleanupUserData(userId: string): void {
    // Clean up cursors
    const cursorKeys = Array.from(this.userCursors.keys()).filter(key => key.startsWith(`${userId}:`))
    cursorKeys.forEach(key => this.userCursors.delete(key))

    // Clean up locks
    this.cleanupUserLocks(userId)

    // Clean up typing indicators
    this.typingUsers.forEach(users => users.delete(userId))
  }

  private setupCleanupTasks(): void {
    // Clean up inactive sessions every 5 minutes
    setInterval(() => {
      const now = new Date()
      const inactiveThreshold = 30 * 60 * 1000 // 30 minutes

      this.activeSessions.forEach((session, sessionId) => {
        if (now.getTime() - session.lastActivity.getTime() > inactiveThreshold) {
          this.activeSessions.delete(sessionId)
          console.log(`🧹 Cleaned up inactive collaboration session: ${sessionId}`)
        }
      })
    }, 5 * 60 * 1000)
  }
}