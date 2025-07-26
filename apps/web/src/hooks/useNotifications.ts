import { useState, useEffect, useCallback } from 'react'
import { useSocket } from './useSocket'
import { useToast } from './useToast'

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  actionUrl?: string
  metadata?: Record<string, any>
  senderId?: string
  createdAt: Date
  isRead?: boolean
  readAt?: Date
}

export interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  error: string | null
}

export function useNotifications() {
  const { socket, connected, emit, on, off } = useSocket({ namespace: '/notifications' })
  const { showToast } = useToast()
  
  const [state, setState] = useState<NotificationState>({
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null
  })

  // Handle new notifications
  const handleNewNotification = useCallback((notification: Notification) => {
    setState(prev => ({
      ...prev,
      notifications: [notification, ...prev.notifications],
      unreadCount: prev.unreadCount + 1
    }))

    // Show toast notification
    showToast({
      title: notification.title,
      description: notification.message,
      status: notification.priority === 'urgent' || notification.priority === 'high' ? 'error' : 'info',
      duration: notification.priority === 'urgent' ? 0 : 5000, // Urgent notifications don't auto-dismiss
      isClosable: true
    })

    console.log('🔔 New notification received:', notification)
  }, [showToast])

  // Handle unread count updates
  const handleUnreadCount = useCallback((data: { count: number }) => {
    setState(prev => ({
      ...prev,
      unreadCount: data.count
    }))
  }, [])

  // Handle notification marked as read
  const handleMarkedRead = useCallback((data: { notificationId: string; readAt: Date }) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(notif =>
        notif.id === data.notificationId
          ? { ...notif, isRead: true, readAt: data.readAt }
          : notif
      ),
      unreadCount: Math.max(0, prev.unreadCount - 1)
    }))
  }, [])

  // Handle all notifications marked as read
  const handleAllMarkedRead = useCallback((data: { markedCount: number }) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(notif => ({
        ...notif,
        isRead: true,
        readAt: new Date()
      })),
      unreadCount: 0
    }))

    showToast({
      title: 'All notifications marked as read',
      description: `${data.markedCount} notifications updated`,
      status: 'success',
      duration: 3000
    })
  }, [showToast])

  // Handle notification history
  const handleNotificationHistory = useCallback((data: { notifications: Notification[]; pagination: any }) => {
    setState(prev => ({
      ...prev,
      notifications: data.notifications,
      loading: false
    }))
  }, [])

  // Handle notification deletion
  const handleNotificationDeleted = useCallback((data: { notificationId: string }) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(notif => notif.id !== data.notificationId)
    }))
  }, [])

  // Handle system notifications
  const handleSystemNotification = useCallback((notification: any) => {
    showToast({
      title: notification.title || 'System Notification',
      description: notification.message,
      status: 'info',
      duration: 8000,
      isClosable: true
    })
  }, [showToast])

  // Mark notification as read
  const markAsRead = useCallback((notificationId: string) => {
    if (connected) {
      emit('notification:mark_read', { notificationId })
    }
  }, [connected, emit])

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    if (connected) {
      emit('notification:mark_all_read')
    }
  }, [connected, emit])

  // Delete notification
  const deleteNotification = useCallback((notificationId: string) => {
    if (connected) {
      emit('notification:delete', { notificationId })
    }
  }, [connected, emit])

  // Get notification history
  const getHistory = useCallback((options: { page?: number; limit?: number; types?: string[]; read?: boolean } = {}) => {
    if (connected) {
      setState(prev => ({ ...prev, loading: true }))
      emit('notification:get_history', options)
    }
  }, [connected, emit])

  // Subscribe to notification types
  const subscribeToTypes = useCallback((types: string[]) => {
    if (connected) {
      emit('notification:subscribe', { types })
    }
  }, [connected, emit])

  // Unsubscribe from notification types
  const unsubscribeFromTypes = useCallback((types: string[]) => {
    if (connected) {
      emit('notification:unsubscribe', { types })
    }
  }, [connected, emit])

  // Setup event listeners
  useEffect(() => {
    if (!connected) return

    const cleanup = [
      on('notification:new', handleNewNotification),
      on('notification:unread_count', handleUnreadCount),
      on('notification:marked_read', handleMarkedRead),
      on('notification:all_marked_read', handleAllMarkedRead),
      on('notification:history', handleNotificationHistory),
      on('notification:deleted', handleNotificationDeleted),
      on('notification:system', handleSystemNotification),
      on('system:announcement', handleSystemNotification),
      on('system:maintenance_mode', (data: any) => {
        showToast({
          title: data.enabled ? 'Maintenance Mode Enabled' : 'Maintenance Mode Disabled',
          description: data.message,
          status: data.enabled ? 'warning' : 'info',
          duration: data.enabled ? 0 : 5000,
          isClosable: true
        })
      }),
      on('system:shutdown', (data: any) => {
        showToast({
          title: 'Server Shutdown',
          description: data.message,
          status: 'error',
          duration: 0,
          isClosable: false
        })
      })
    ]

    return () => {
      cleanup.forEach(fn => fn())
    }
  }, [
    connected,
    on,
    handleNewNotification,
    handleUnreadCount,
    handleMarkedRead,
    handleAllMarkedRead,
    handleNotificationHistory,
    handleNotificationDeleted,
    handleSystemNotification,
    showToast
  ])

  // Get initial unread count and recent notifications on connect
  useEffect(() => {
    if (connected) {
      getHistory({ limit: 20 })
    }
  }, [connected, getHistory])

  return {
    ...state,
    connected,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    getHistory,
    subscribeToTypes,
    unsubscribeFromTypes
  }
}