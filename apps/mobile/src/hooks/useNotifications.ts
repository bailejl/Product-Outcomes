import { useState, useCallback, useEffect } from 'react';
import { Notification, PaginatedResponse } from '../types';
import { apiService } from '../services/api';
import { notificationService } from '../services/notification';

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  refreshing: boolean;
  fetchNotifications: (page?: number) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
}

export const useNotifications = (): UseNotificationsReturn => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Load initial data
  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, []);

  const fetchNotifications = useCallback(async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.getPaginated<Notification>('/notifications', {
        page,
        limit: 20,
        sort: 'createdAt',
        order: 'desc',
      });
      
      if (page === 1) {
        setNotifications(response.data);
      } else {
        setNotifications(prev => [...prev, ...response.data]);
      }
      
      setHasMore(response.pagination.hasNext);
      setCurrentPage(page);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await apiService.get<{ count: number }>('/notifications/unread-count');
      
      if (response.success && response.data) {
        setUnreadCount(response.data.count);
        await notificationService.setBadgeCount(response.data.count);
      }
    } catch (err: any) {
      console.error('Failed to fetch unread count:', err);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    
    await fetchNotifications(currentPage + 1);
  }, [loading, hasMore, currentPage, fetchNotifications]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchNotifications(1),
      fetchUnreadCount(),
    ]);
    setRefreshing(false);
  }, [fetchNotifications, fetchUnreadCount]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      const response = await apiService.patch(`/notifications/${id}/read`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to mark notification as read');
      }

      // Update local state
      setNotifications(prev => prev.map(notification => 
        notification.id === id 
          ? { ...notification, isRead: true, readAt: new Date() }
          : notification
      ));

      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
      await notificationService.setBadgeCount(Math.max(0, unreadCount - 1));
    } catch (err: any) {
      setError(err.message || 'Failed to mark notification as read');
      throw err;
    }
  }, [unreadCount]);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await apiService.post('/notifications/mark-all-read');
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to mark all notifications as read');
      }

      // Update local state
      setNotifications(prev => prev.map(notification => ({
        ...notification,
        isRead: true,
        readAt: notification.readAt || new Date(),
      })));

      // Reset unread count
      setUnreadCount(0);
      await notificationService.setBadgeCount(0);
    } catch (err: any) {
      setError(err.message || 'Failed to mark all notifications as read');
      throw err;
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      const response = await apiService.delete(`/notifications/${id}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete notification');
      }

      // Find the notification to check if it was unread
      const notification = notifications.find(n => n.id === id);
      const wasUnread = notification && !notification.isRead;

      // Remove from local state
      setNotifications(prev => prev.filter(n => n.id !== id));

      // Update unread count if necessary
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
        await notificationService.setBadgeCount(Math.max(0, unreadCount - 1));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete notification');
      throw err;
    }
  }, [notifications, unreadCount]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    hasMore,
    refreshing,
    fetchNotifications,
    loadMore,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
};