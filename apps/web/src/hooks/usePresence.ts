import { useState, useEffect, useCallback } from 'react'
import { useSocket } from './useSocket'

export interface UserPresence {
  userId: string
  status: 'online' | 'away' | 'busy' | 'offline' | 'invisible'
  activity?: 'viewing_okr' | 'editing_okr' | 'commenting' | 'browsing' | 'idle'
  context?: string
  lastSeen: Date
}

export interface PresenceState {
  onlineUsers: UserPresence[]
  currentViewers: Record<string, UserPresence[]> // documentId -> viewers
  typingUsers: Record<string, string[]> // documentId -> userIds
  loading: boolean
  error: string | null
}

export function usePresence() {
  const { socket, connected, emit, on, off } = useSocket({ namespace: '/collaboration' })
  
  const [state, setState] = useState<PresenceState>({
    onlineUsers: [],
    currentViewers: {},
    typingUsers: {},
    loading: false,
    error: null
  })

  // Handle presence updates
  const handlePresenceUpdate = useCallback((presence: UserPresence) => {
    setState(prev => ({
      ...prev,
      onlineUsers: prev.onlineUsers.map(user =>
        user.userId === presence.userId ? presence : user
      )
    }))
  }, [])

  // Handle online users list
  const handleOnlineUsers = useCallback((users: UserPresence[]) => {
    setState(prev => ({
      ...prev,
      onlineUsers: users
    }))
  }, [])

  // Handle user joining document
  const handleUserJoined = useCallback((data: { userId: string; userName: string; documentId: string; activity: string }) => {
    setState(prev => {
      const viewers = prev.currentViewers[data.documentId] || []
      const existingIndex = viewers.findIndex(v => v.userId === data.userId)
      
      const newPresence: UserPresence = {
        userId: data.userId,
        status: 'online',
        activity: data.activity as any,
        context: data.documentId,
        lastSeen: new Date()
      }

      let updatedViewers
      if (existingIndex >= 0) {
        updatedViewers = viewers.map((v, i) => i === existingIndex ? newPresence : v)
      } else {
        updatedViewers = [...viewers, newPresence]
      }

      return {
        ...prev,
        currentViewers: {
          ...prev.currentViewers,
          [data.documentId]: updatedViewers
        }
      }
    })
  }, [])

  // Handle user leaving document
  const handleUserLeft = useCallback((data: { userId: string; documentId: string }) => {
    setState(prev => ({
      ...prev,
      currentViewers: {
        ...prev.currentViewers,
        [data.documentId]: (prev.currentViewers[data.documentId] || []).filter(v => v.userId !== data.userId)
      },
      typingUsers: {
        ...prev.typingUsers,
        [data.documentId]: (prev.typingUsers[data.documentId] || []).filter(id => id !== data.userId)
      }
    }))
  }, [])

  // Handle typing indicators
  const handleUserTyping = useCallback((data: { userId: string; documentId: string; field?: string }) => {
    setState(prev => {
      const typingInDoc = prev.typingUsers[data.documentId] || []
      if (!typingInDoc.includes(data.userId)) {
        return {
          ...prev,
          typingUsers: {
            ...prev.typingUsers,
            [data.documentId]: [...typingInDoc, data.userId]
          }
        }
      }
      return prev
    })
  }, [])

  const handleUserStoppedTyping = useCallback((data: { userId: string; documentId: string; field?: string }) => {
    setState(prev => ({
      ...prev,
      typingUsers: {
        ...prev.typingUsers,
        [data.documentId]: (prev.typingUsers[data.documentId] || []).filter(id => id !== data.userId)
      }
    }))
  }, [])

  // Update user's own status
  const updateStatus = useCallback((status: UserPresence['status']) => {
    if (connected) {
      emit('presence:update_status', { status })
    }
  }, [connected, emit])

  // Update user's activity
  const updateActivity = useCallback((activity: UserPresence['activity'], context?: string) => {
    if (connected) {
      emit('presence:update_activity', { activity, context })
    }
  }, [connected, emit])

  // Join document for collaboration
  const joinDocument = useCallback((documentId: string, sessionId?: string) => {
    if (connected) {
      emit('collaboration:join_session', { documentId, sessionId })
    }
  }, [connected, emit])

  // Leave document
  const leaveDocument = useCallback((documentId: string, sessionId?: string) => {
    if (connected) {
      emit('collaboration:leave_session', { documentId, sessionId })
    }
  }, [connected, emit])

  // Start typing indicator
  const startTyping = useCallback((documentId: string, field?: string) => {
    if (connected) {
      emit('collaboration:typing_start', { documentId, field })
    }
  }, [connected, emit])

  // Stop typing indicator
  const stopTyping = useCallback((documentId: string, field?: string) => {
    if (connected) {
      emit('collaboration:typing_stop', { documentId, field })
    }
  }, [connected, emit])

  // Update cursor position
  const updateCursor = useCallback((documentId: string, position: { line: number; column: number }, field?: string) => {
    if (connected) {
      emit('collaboration:cursor_update', { documentId, position, field })
    }
  }, [connected, emit])

  // Setup event listeners
  useEffect(() => {
    if (!connected) return

    const cleanup = [
      on('presence:user_update', handlePresenceUpdate),
      on('presence:online_users', handleOnlineUsers),
      on('collaboration:user_joined', handleUserJoined),
      on('collaboration:user_left', handleUserLeft),
      on('collaboration:user_typing', handleUserTyping),
      on('collaboration:user_stopped_typing', handleUserStoppedTyping)
    ]

    return () => {
      cleanup.forEach(fn => fn())
    }
  }, [
    connected,
    on,
    handlePresenceUpdate,
    handleOnlineUsers,
    handleUserJoined,
    handleUserLeft,
    handleUserTyping,
    handleUserStoppedTyping
  ])

  return {
    ...state,
    connected,
    updateStatus,
    updateActivity,
    joinDocument,
    leaveDocument,
    startTyping,
    stopTyping,
    updateCursor
  }
}