import { useState, useEffect, useCallback } from 'react'
import { useSocket } from './useSocket'
import { useToast } from './useToast'

export interface OkrUpdate {
  okrId: string
  updates: Record<string, any>
  updatedBy: {
    id: string
    name: string
  }
  timestamp: Date
}

export interface OkrComment {
  id: string
  content: string
  okrId: string
  authorId: string
  author: {
    id: string
    fullName: string
  }
  parentCommentId?: string
  isEdited: boolean
  editedAt?: Date
  createdAt: Date
}

export interface CollaborationState {
  currentViewers: Record<string, any[]> // okrId -> viewers
  typingUsers: Record<string, string[]> // okrId -> userIds
  cursors: Record<string, any[]> // okrId -> cursor positions
  comments: Record<string, OkrComment[]> // okrId -> comments
  loading: boolean
  error: string | null
}

export function useOkrCollaboration() {
  const { socket, connected, emit, on, off } = useSocket({ namespace: '/okr' })
  const { showToast } = useToast()
  
  const [state, setState] = useState<CollaborationState>({
    currentViewers: {},
    typingUsers: {},
    cursors: {},
    comments: {},
    loading: false,
    error: null
  })

  // Handle OKR viewing
  const viewOkr = useCallback((okrId: string) => {
    if (connected) {
      emit('okr:view', { okrId })
    }
  }, [connected, emit])

  // Handle starting OKR editing
  const startEditingOkr = useCallback((okrId: string) => {
    if (connected) {
      emit('okr:edit_start', { okrId })
    }
  }, [connected, emit])

  // Handle stopping OKR editing
  const stopEditingOkr = useCallback((okrId: string) => {
    if (connected) {
      emit('okr:edit_stop', { okrId })
    }
  }, [connected, emit])

  // Update OKR
  const updateOkr = useCallback((okrId: string, updates: Record<string, any>) => {
    if (connected) {
      emit('okr:update', { okrId, updates })
    }
  }, [connected, emit])

  // Update progress
  const updateProgress = useCallback((okrId: string, currentValue: number, note?: string) => {
    if (connected) {
      emit('okr:progress_update', { okrId, currentValue, note })
    }
  }, [connected, emit])

  // Add comment
  const addComment = useCallback((okrId: string, content: string, parentCommentId?: string) => {
    if (connected) {
      emit('okr:comment_add', { okrId, content, parentCommentId })
    }
  }, [connected, emit])

  // Update comment
  const updateComment = useCallback((commentId: string, content: string) => {
    if (connected) {
      emit('okr:comment_update', { commentId, content })
    }
  }, [connected, emit])

  // Delete comment
  const deleteComment = useCallback((commentId: string) => {
    if (connected) {
      emit('okr:comment_delete', { commentId })
    }
  }, [connected, emit])

  // Typing indicators
  const startTyping = useCallback((okrId: string) => {
    if (connected) {
      emit('okr:typing_start', { okrId })
    }
  }, [connected, emit])

  const stopTyping = useCallback((okrId: string) => {
    if (connected) {
      emit('okr:typing_stop', { okrId })
    }
  }, [connected, emit])

  // Cursor updates
  const updateCursor = useCallback((okrId: string, position: any, field: string) => {
    if (connected) {
      emit('okr:cursor_update', { okrId, position, field })
    }
  }, [connected, emit])

  // Event handlers
  const handleUserJoined = useCallback((data: any) => {
    setState(prev => {
      const viewers = prev.currentViewers[data.okrId] || []
      const isAlreadyViewing = viewers.some(v => v.userId === data.userId)
      
      if (!isAlreadyViewing) {
        return {
          ...prev,
          currentViewers: {
            ...prev.currentViewers,
            [data.okrId]: [...viewers, data]
          }
        }
      }
      return prev
    })
  }, [])

  const handleUserLeft = useCallback((data: any) => {
    setState(prev => ({
      ...prev,
      currentViewers: {
        ...prev.currentViewers,
        [data.okrId]: (prev.currentViewers[data.okrId] || []).filter(v => v.userId !== data.userId)
      },
      typingUsers: {
        ...prev.typingUsers,
        [data.okrId]: (prev.typingUsers[data.okrId] || []).filter(id => id !== data.userId)
      }
    }))
  }, [])

  const handleCurrentViewers = useCallback((data: { okrId: string; viewers: any[] }) => {
    setState(prev => ({
      ...prev,
      currentViewers: {
        ...prev.currentViewers,
        [data.okrId]: data.viewers
      }
    }))
  }, [])

  const handleOkrUpdated = useCallback((data: OkrUpdate) => {
    showToast({
      title: 'OKR Updated',
      description: `${data.updatedBy.name} updated the OKR`,
      status: 'info',
      duration: 3000
    })
  }, [showToast])

  const handleProgressUpdated = useCallback((data: any) => {
    showToast({
      title: 'Progress Updated',
      description: `${data.updatedBy.name} updated progress to ${data.progress}%`,
      status: 'success',
      duration: 3000
    })
  }, [showToast])

  const handleCommentAdded = useCallback((data: { comment: OkrComment }) => {
    setState(prev => ({
      ...prev,
      comments: {
        ...prev.comments,
        [data.comment.okrId]: [...(prev.comments[data.comment.okrId] || []), data.comment]
      }
    }))

    showToast({
      title: 'New Comment',
      description: `${data.comment.author.fullName} added a comment`,
      status: 'info',
      duration: 3000
    })
  }, [showToast])

  const handleCommentUpdated = useCallback((data: any) => {
    setState(prev => {
      const okrComments = prev.comments[data.okrId] || []
      return {
        ...prev,
        comments: {
          ...prev.comments,
          [data.okrId]: okrComments.map(comment =>
            comment.id === data.commentId
              ? { ...comment, content: data.content, isEdited: true, editedAt: data.editedAt }
              : comment
          )
        }
      }
    })
  }, [])

  const handleCommentDeleted = useCallback((data: any) => {
    setState(prev => {
      const okrComments = prev.comments[data.okrId] || []
      return {
        ...prev,
        comments: {
          ...prev.comments,
          [data.okrId]: okrComments.filter(comment => comment.id !== data.commentId)
        }
      }
    })
  }, [])

  const handleUserTyping = useCallback((data: { userId: string; okrId: string }) => {
    setState(prev => {
      const typingInOkr = prev.typingUsers[data.okrId] || []
      if (!typingInOkr.includes(data.userId)) {
        return {
          ...prev,
          typingUsers: {
            ...prev.typingUsers,
            [data.okrId]: [...typingInOkr, data.userId]
          }
        }
      }
      return prev
    })
  }, [])

  const handleUserStoppedTyping = useCallback((data: { userId: string; okrId: string }) => {
    setState(prev => ({
      ...prev,
      typingUsers: {
        ...prev.typingUsers,
        [data.okrId]: (prev.typingUsers[data.okrId] || []).filter(id => id !== data.userId)
      }
    }))
  }, [])

  const handleCursorPosition = useCallback((data: any) => {
    setState(prev => {
      const cursorsInOkr = prev.cursors[data.okrId] || []
      const existingIndex = cursorsInOkr.findIndex(c => c.userId === data.userId)
      
      let updatedCursors
      if (existingIndex >= 0) {
        updatedCursors = cursorsInOkr.map((c, i) => i === existingIndex ? data : c)
      } else {
        updatedCursors = [...cursorsInOkr, data]
      }

      return {
        ...prev,
        cursors: {
          ...prev.cursors,
          [data.okrId]: updatedCursors
        }
      }
    })
  }, [])

  // Setup event listeners
  useEffect(() => {
    if (!connected) return

    const cleanup = [
      on('okr:user_joined', handleUserJoined),
      on('okr:user_left', handleUserLeft),
      on('okr:current_viewers', handleCurrentViewers),
      on('okr:updated', handleOkrUpdated),
      on('okr:progress_updated', handleProgressUpdated),
      on('okr:comment_added', handleCommentAdded),
      on('okr:comment_updated', handleCommentUpdated),
      on('okr:comment_deleted', handleCommentDeleted),
      on('okr:user_typing', handleUserTyping),
      on('okr:user_stopped_typing', handleUserStoppedTyping),
      on('okr:cursor_position', handleCursorPosition)
    ]

    return () => {
      cleanup.forEach(fn => fn())
    }
  }, [
    connected,
    on,
    handleUserJoined,
    handleUserLeft,
    handleCurrentViewers,
    handleOkrUpdated,
    handleProgressUpdated,
    handleCommentAdded,
    handleCommentUpdated,
    handleCommentDeleted,
    handleUserTyping,
    handleUserStoppedTyping,
    handleCursorPosition
  ])

  return {
    ...state,
    connected,
    viewOkr,
    startEditingOkr,
    stopEditingOkr,
    updateOkr,
    updateProgress,
    addComment,
    updateComment,
    deleteComment,
    startTyping,
    stopTyping,
    updateCursor
  }
}