import { Namespace } from 'socket.io'
import { AuthenticatedSocket } from '../socketAuth'
import { PresenceManager } from '../presenceManager'
import { socketRateLimiters } from '../rateLimiter'
import { AppDataSource } from '@product-outcomes/database'
import { Okr, OkrComment, ActivityType } from '@product-outcomes/database'

export class OkrNamespaceHandler {
  private namespace: Namespace
  private presenceManager: PresenceManager
  private okrRepository = AppDataSource.getRepository(Okr)
  private commentRepository = AppDataSource.getRepository(OkrComment)

  constructor(namespace: Namespace, presenceManager: PresenceManager) {
    this.namespace = namespace
    this.presenceManager = presenceManager
    this.setupEventHandlers()
    console.log('🎯 OKR namespace handler initialized')
  }

  private setupEventHandlers(): void {
    this.namespace.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`👤 User ${socket.userId} connected to OKR namespace`)

      // Join user to their personal room
      socket.join(`user:${socket.userId}`)

      // Handle OKR viewing
      socket.on('okr:view', async (data) => {
        if (socketRateLimiters.general.isAllowed(socket, 'okr:view')) {
          await this.handleOkrView(socket, data.okrId)
        }
      })

      // Handle OKR editing
      socket.on('okr:edit_start', async (data) => {
        if (socketRateLimiters.general.isAllowed(socket, 'okr:edit_start')) {
          await this.handleOkrEditStart(socket, data.okrId)
        }
      })

      socket.on('okr:edit_stop', async (data) => {
        if (socketRateLimiters.general.isAllowed(socket, 'okr:edit_stop')) {
          await this.handleOkrEditStop(socket, data.okrId)
        }
      })

      // Handle OKR updates
      socket.on('okr:update', async (data) => {
        if (socketRateLimiters.critical.isAllowed(socket, 'okr:update')) {
          await this.handleOkrUpdate(socket, data)
        }
      })

      // Handle progress updates
      socket.on('okr:progress_update', async (data) => {
        if (socketRateLimiters.critical.isAllowed(socket, 'okr:progress_update')) {
          await this.handleProgressUpdate(socket, data)
        }
      })

      // Handle commenting
      socket.on('okr:comment_add', async (data) => {
        if (socketRateLimiters.general.isAllowed(socket, 'okr:comment_add')) {
          await this.handleAddComment(socket, data)
        }
      })

      socket.on('okr:comment_update', async (data) => {
        if (socketRateLimiters.general.isAllowed(socket, 'okr:comment_update')) {
          await this.handleUpdateComment(socket, data)
        }
      })

      socket.on('okr:comment_delete', async (data) => {
        if (socketRateLimiters.general.isAllowed(socket, 'okr:comment_delete')) {
          await this.handleDeleteComment(socket, data)
        }
      })

      // Handle typing indicators for comments
      socket.on('okr:typing_start', (data) => {
        if (socketRateLimiters.highFrequency.isAllowed(socket, 'okr:typing_start')) {
          socket.to(`okr:${data.okrId}`).emit('okr:user_typing', {
            userId: socket.userId,
            userName: socket.user.fullName,
            okrId: data.okrId,
            timestamp: new Date()
          })
        }
      })

      socket.on('okr:typing_stop', (data) => {
        if (socketRateLimiters.highFrequency.isAllowed(socket, 'okr:typing_stop')) {
          socket.to(`okr:${data.okrId}`).emit('okr:user_stopped_typing', {
            userId: socket.userId,
            okrId: data.okrId,
            timestamp: new Date()
          })
        }
      })

      // Handle collaborative editing cursors
      socket.on('okr:cursor_update', (data) => {
        if (socketRateLimiters.highFrequency.isAllowed(socket, 'okr:cursor_update')) {
          socket.to(`okr:${data.okrId}`).emit('okr:cursor_position', {
            userId: socket.userId,
            userName: socket.user.fullName,
            okrId: data.okrId,
            position: data.position,
            field: data.field,
            timestamp: new Date()
          })
        }
      })

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`👤 User ${socket.userId} disconnected from OKR namespace`)
      })
    })
  }

  private async handleOkrView(socket: AuthenticatedSocket, okrId: string): Promise<void> {
    try {
      // Join OKR room
      socket.join(`okr:${okrId}`)

      // Update presence
      await this.presenceManager.updateActivity(
        socket.userId, 
        ActivityType.VIEWING_OKR, 
        okrId
      )

      // Get OKR viewers
      const viewers = await this.presenceManager.getOkrViewers(okrId)

      // Notify others in the room
      socket.to(`okr:${okrId}`).emit('okr:user_joined', {
        userId: socket.userId,
        userName: socket.user.fullName,
        okrId,
        activity: 'viewing',
        timestamp: new Date()
      })

      // Send current viewers to the user
      socket.emit('okr:current_viewers', {
        okrId,
        viewers: viewers.map(v => ({
          userId: v.userId,
          activity: v.activity,
          lastSeen: v.lastSeen
        }))
      })

      console.log(`📖 User ${socket.userId} started viewing OKR ${okrId}`)
    } catch (error) {
      console.error('Error handling OKR view:', error)
      socket.emit('error', { message: 'Failed to join OKR view' })
    }
  }

  private async handleOkrEditStart(socket: AuthenticatedSocket, okrId: string): Promise<void> {
    try {
      // Join OKR room if not already
      socket.join(`okr:${okrId}`)

      // Update presence to editing
      await this.presenceManager.updateActivity(
        socket.userId, 
        ActivityType.EDITING_OKR, 
        okrId
      )

      // Notify others
      socket.to(`okr:${okrId}`).emit('okr:user_started_editing', {
        userId: socket.userId,
        userName: socket.user.fullName,
        okrId,
        timestamp: new Date()
      })

      console.log(`✏️ User ${socket.userId} started editing OKR ${okrId}`)
    } catch (error) {
      console.error('Error handling OKR edit start:', error)
      socket.emit('error', { message: 'Failed to start editing' })
    }
  }

  private async handleOkrEditStop(socket: AuthenticatedSocket, okrId: string): Promise<void> {
    try {
      // Update presence back to viewing
      await this.presenceManager.updateActivity(
        socket.userId, 
        ActivityType.VIEWING_OKR, 
        okrId
      )

      // Notify others
      socket.to(`okr:${okrId}`).emit('okr:user_stopped_editing', {
        userId: socket.userId,
        userName: socket.user.fullName,
        okrId,
        timestamp: new Date()
      })

      console.log(`📖 User ${socket.userId} stopped editing OKR ${okrId}`)
    } catch (error) {
      console.error('Error handling OKR edit stop:', error)
    }
  }

  private async handleOkrUpdate(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const { okrId, updates } = data

      // Validate user has permission to update this OKR
      const okr = await this.okrRepository.findOne({
        where: { id: okrId },
        relations: ['owner']
      })

      if (!okr) {
        socket.emit('error', { message: 'OKR not found' })
        return
      }

      // Check if user owns the OKR or has admin permissions
      if (okr.ownerId !== socket.userId && !socket.user.isAdmin()) {
        socket.emit('error', { message: 'Insufficient permissions' })
        return
      }

      // Update OKR
      await this.okrRepository.update(okrId, {
        ...updates,
        lastUpdatedBy: socket.userId
      })

      // Get updated OKR
      const updatedOkr = await this.okrRepository.findOne({
        where: { id: okrId },
        relations: ['owner', 'lastUpdatedByUser']
      })

      // Broadcast update to all users in OKR room
      this.namespace.to(`okr:${okrId}`).emit('okr:updated', {
        okrId,
        updates,
        updatedBy: {
          id: socket.userId,
          name: socket.user.fullName
        },
        okr: updatedOkr,
        timestamp: new Date()
      })

      console.log(`🔄 OKR ${okrId} updated by user ${socket.userId}`)
    } catch (error) {
      console.error('Error handling OKR update:', error)
      socket.emit('error', { message: 'Failed to update OKR' })
    }
  }

  private async handleProgressUpdate(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const { okrId, currentValue, note } = data

      const okr = await this.okrRepository.findOne({
        where: { id: okrId },
        relations: ['owner']
      })

      if (!okr) {
        socket.emit('error', { message: 'OKR not found' })
        return
      }

      // Update progress
      okr.updateProgress(currentValue, socket.userId)
      await this.okrRepository.save(okr)

      // Broadcast progress update
      this.namespace.to(`okr:${okrId}`).emit('okr:progress_updated', {
        okrId,
        currentValue,
        progress: okr.progress,
        status: okr.status,
        updatedBy: {
          id: socket.userId,
          name: socket.user.fullName
        },
        note,
        timestamp: new Date()
      })

      console.log(`📊 OKR ${okrId} progress updated: ${okr.progress}%`)
    } catch (error) {
      console.error('Error handling progress update:', error)
      socket.emit('error', { message: 'Failed to update progress' })
    }
  }

  private async handleAddComment(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const { okrId, content, parentCommentId } = data

      // Create comment
      const comment = this.commentRepository.create({
        content,
        okrId,
        authorId: socket.userId,
        parentCommentId
      })

      await this.commentRepository.save(comment)

      // Load comment with relations
      const savedComment = await this.commentRepository.findOne({
        where: { id: comment.id },
        relations: ['author', 'okr']
      })

      // Broadcast new comment
      this.namespace.to(`okr:${okrId}`).emit('okr:comment_added', {
        comment: savedComment,
        timestamp: new Date()
      })

      console.log(`💬 Comment added to OKR ${okrId} by user ${socket.userId}`)
    } catch (error) {
      console.error('Error handling add comment:', error)
      socket.emit('error', { message: 'Failed to add comment' })
    }
  }

  private async handleUpdateComment(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const { commentId, content } = data

      const comment = await this.commentRepository.findOne({
        where: { id: commentId },
        relations: ['author']
      })

      if (!comment) {
        socket.emit('error', { message: 'Comment not found' })
        return
      }

      if (comment.authorId !== socket.userId) {
        socket.emit('error', { message: 'Can only edit your own comments' })
        return
      }

      // Update comment
      comment.content = content
      comment.markAsEdited()
      await this.commentRepository.save(comment)

      // Broadcast update
      this.namespace.to(`okr:${comment.okrId}`).emit('okr:comment_updated', {
        commentId,
        content,
        editedAt: comment.editedAt,
        timestamp: new Date()
      })

      console.log(`✏️ Comment ${commentId} updated by user ${socket.userId}`)
    } catch (error) {
      console.error('Error handling update comment:', error)
      socket.emit('error', { message: 'Failed to update comment' })
    }
  }

  private async handleDeleteComment(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const { commentId } = data

      const comment = await this.commentRepository.findOne({
        where: { id: commentId },
        relations: ['author']
      })

      if (!comment) {
        socket.emit('error', { message: 'Comment not found' })
        return
      }

      if (comment.authorId !== socket.userId && !socket.user.isAdmin()) {
        socket.emit('error', { message: 'Insufficient permissions' })
        return
      }

      const okrId = comment.okrId
      await this.commentRepository.remove(comment)

      // Broadcast deletion
      this.namespace.to(`okr:${okrId}`).emit('okr:comment_deleted', {
        commentId,
        deletedBy: {
          id: socket.userId,
          name: socket.user.fullName
        },
        timestamp: new Date()
      })

      console.log(`🗑️ Comment ${commentId} deleted by user ${socket.userId}`)
    } catch (error) {
      console.error('Error handling delete comment:', error)
      socket.emit('error', { message: 'Failed to delete comment' })
    }
  }
}