import PushNotification, { ReceivedNotification } from 'react-native-push-notification';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import { NOTIFICATION_CONFIG } from '../config';
import { Notification, NotificationType, NotificationPriority } from '../types';
import { apiService } from './api';

interface ToastConfig {
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number;
  onPress?: () => void;
}

interface LocalNotificationConfig {
  title: string;
  message: string;
  data?: any;
  channelId?: string;
  priority?: 'high' | 'normal' | 'low';
  sound?: string;
  vibrate?: boolean;
  actions?: string[];
}

class NotificationService {
  private isInitialized: boolean = false;
  private userId: string | null = null;
  private pushToken: string | null = null;
  private notificationHandlers: Map<string, (notification: any) => void> = new Map();

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Configure push notifications
      this.configurePushNotifications();
      
      // Setup Firebase messaging
      await this.setupFirebaseMessaging();
      
      // Create notification channels (Android)
      this.createNotificationChannels();

      this.isInitialized = true;
    } catch (error) {
      console.error('Notification service initialization failed:', error);
    }
  }

  private configurePushNotifications(): void {
    PushNotification.configure({
      onRegister: (token) => {
        this.pushToken = token.token;
        this.sendTokenToServer(token.token);
      },

      onNotification: (notification: ReceivedNotification) => {
        this.handleNotificationReceived(notification);
      },

      onAction: (notification) => {
        this.handleNotificationAction(notification);
      },

      onRegistrationError: (error) => {
        console.error('Push notification registration error:', error);
      },

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });
  }

  private async setupFirebaseMessaging(): Promise<void> {
    try {
      // Request permission
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.warn('Push notification permission denied');
        return;
      }

      // Get FCM token
      const fcmToken = await messaging().getToken();
      if (fcmToken) {
        this.pushToken = fcmToken;
        await this.sendTokenToServer(fcmToken);
      }

      // Listen for token refresh
      messaging().onTokenRefresh((token) => {
        this.pushToken = token;
        this.sendTokenToServer(token);
      });

      // Handle foreground messages
      messaging().onMessage(async (remoteMessage) => {
        this.handleFirebaseMessage(remoteMessage);
      });

      // Handle background/quit state messages
      messaging().onNotificationOpenedApp((remoteMessage) => {
        this.handleNotificationOpen(remoteMessage);
      });

      // Check if app was opened from notification
      const initialNotification = await messaging().getInitialNotification();
      if (initialNotification) {
        this.handleNotificationOpen(initialNotification);
      }
    } catch (error) {
      console.error('Firebase messaging setup failed:', error);
    }
  }

  private createNotificationChannels(): void {
    if (Platform.OS !== 'android') return;

    const channels = [
      {
        channelId: NOTIFICATION_CONFIG.CHANNELS.OKR_UPDATES,
        channelName: 'OKR Updates',
        channelDescription: 'Notifications about OKR progress and changes',
        importance: 4,
      },
      {
        channelId: NOTIFICATION_CONFIG.CHANNELS.COMMENTS,
        channelName: 'Comments',
        channelDescription: 'New comments on your OKRs',
        importance: 3,
      },
      {
        channelId: NOTIFICATION_CONFIG.CHANNELS.MENTIONS,
        channelName: 'Mentions',
        channelDescription: 'When you are mentioned in discussions',
        importance: 4,
      },
      {
        channelId: NOTIFICATION_CONFIG.CHANNELS.REMINDERS,
        channelName: 'Reminders',
        channelDescription: 'OKR deadlines and milestone reminders',
        importance: 4,
      },
      {
        channelId: NOTIFICATION_CONFIG.CHANNELS.SYSTEM,
        channelName: 'System',
        channelDescription: 'System announcements and updates',
        importance: 2,
      },
    ];

    channels.forEach((channel) => {
      PushNotification.createChannel(
        {
          channelId: channel.channelId,
          channelName: channel.channelName,
          channelDescription: channel.channelDescription,
          importance: channel.importance,
          vibrate: true,
        },
        () => {}
      );
    });
  }

  private async sendTokenToServer(token: string): Promise<void> {
    try {
      if (this.userId) {
        await apiService.post('/notifications/register-device', {
          userId: this.userId,
          token,
          platform: Platform.OS,
        });
      } else {
        // Store token for later registration
        await AsyncStorage.setItem('pending_push_token', token);
      }
    } catch (error) {
      console.error('Failed to register push token:', error);
    }
  }

  private handleNotificationReceived(notification: ReceivedNotification): void {
    console.log('Notification received:', notification);

    // Update badge count
    this.updateBadgeCount();

    // Handle different notification types
    if (notification.data?.type) {
      const handler = this.notificationHandlers.get(notification.data.type);
      if (handler) {
        handler(notification);
      }
    }

    // Show in-app notification if app is in foreground
    if (notification.foreground) {
      this.showToast({
        type: 'info',
        title: notification.title || 'New Notification',
        message: notification.message,
        onPress: () => this.handleNotificationPress(notification),
      });
    }
  }

  private handleFirebaseMessage(remoteMessage: any): void {
    console.log('Firebase message received:', remoteMessage);

    const { notification, data } = remoteMessage;

    // Show local notification
    this.showLocalNotification({
      title: notification?.title || 'Notification',
      message: notification?.body || '',
      data,
      channelId: this.getChannelForType(data?.type),
    });
  }

  private handleNotificationOpen(remoteMessage: any): void {
    console.log('Notification opened app:', remoteMessage);

    // Navigate to relevant screen based on notification data
    const { data } = remoteMessage;
    if (data?.navigationTarget) {
      // This should be handled by the navigation service
      // NavigationService.navigate(data.navigationTarget, data.params);
    }
  }

  private handleNotificationAction(notification: any): void {
    console.log('Notification action:', notification);

    // Handle notification actions like reply, mark as read, etc.
    if (notification.action === 'mark_read' && notification.data?.notificationId) {
      this.markAsRead(notification.data.notificationId);
    }
  }

  private handleNotificationPress(notification: any): void {
    // Handle notification tap
    if (notification.data?.okrId) {
      // Navigate to OKR detail
      // NavigationService.navigate('OKRDetail', { okrId: notification.data.okrId });
    }
  }

  private getChannelForType(type?: string): string {
    switch (type) {
      case NotificationType.OKR_UPDATE:
      case NotificationType.OKR_ASSIGNED:
      case NotificationType.OKR_COMPLETED:
        return NOTIFICATION_CONFIG.CHANNELS.OKR_UPDATES;
      case NotificationType.OKR_COMMENT:
        return NOTIFICATION_CONFIG.CHANNELS.COMMENTS;
      case NotificationType.USER_MENTIONED:
        return NOTIFICATION_CONFIG.CHANNELS.MENTIONS;
      case NotificationType.OKR_DUE_SOON:
        return NOTIFICATION_CONFIG.CHANNELS.REMINDERS;
      case NotificationType.SYSTEM_ANNOUNCEMENT:
        return NOTIFICATION_CONFIG.CHANNELS.SYSTEM;
      default:
        return NOTIFICATION_CONFIG.CHANNELS.SYSTEM;
    }
  }

  // Public methods
  async setupPushNotifications(userId: string): Promise<void> {
    this.userId = userId;

    if (!this.isInitialized) {
      await this.initialize();
    }

    // Register pending token if available
    const pendingToken = await AsyncStorage.getItem('pending_push_token');
    if (pendingToken) {
      await this.sendTokenToServer(pendingToken);
      await AsyncStorage.removeItem('pending_push_token');
    }
  }

  async clearNotifications(): Promise<void> {
    this.userId = null;
    PushNotification.cancelAllLocalNotifications();
    await this.setBadgeCount(0);
    
    // Unregister device token
    if (this.pushToken) {
      try {
        await apiService.post('/notifications/unregister-device', {
          token: this.pushToken,
        });
      } catch (error) {
        console.error('Failed to unregister push token:', error);
      }
    }
  }

  showToast(config: ToastConfig): void {
    Toast.show({
      type: config.type,
      text1: config.title,
      text2: config.message,
      visibilityTime: config.duration || 3000,
      onPress: config.onPress,
    });
  }

  showLocalNotification(config: LocalNotificationConfig): void {
    PushNotification.localNotification({
      title: config.title,
      message: config.message,
      userInfo: config.data,
      channelId: config.channelId || NOTIFICATION_CONFIG.CHANNELS.SYSTEM,
      priority: config.priority || 'normal',
      soundName: config.sound || NOTIFICATION_CONFIG.DEFAULT_SOUND,
      vibrate: config.vibrate !== false,
      actions: config.actions,
    });
  }

  showAlert(title: string, message: string, buttons?: any[]): void {
    Alert.alert(title, message, buttons);
  }

  async setBadgeCount(count: number): Promise<void> {
    try {
      PushNotification.setApplicationIconBadgeNumber(count);
      await AsyncStorage.setItem(NOTIFICATION_CONFIG.BADGE_COUNT_KEY, count.toString());
    } catch (error) {
      console.error('Failed to set badge count:', error);
    }
  }

  async getBadgeCount(): Promise<number> {
    try {
      const count = await AsyncStorage.getItem(NOTIFICATION_CONFIG.BADGE_COUNT_KEY);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      console.error('Failed to get badge count:', error);
      return 0;
    }
  }

  async updateBadgeCount(): Promise<void> {
    try {
      const currentCount = await this.getBadgeCount();
      await this.setBadgeCount(currentCount + 1);
    } catch (error) {
      console.error('Failed to update badge count:', error);
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    try {
      await apiService.patch(`/notifications/${notificationId}/read`);
      const currentCount = await this.getBadgeCount();
      if (currentCount > 0) {
        await this.setBadgeCount(currentCount - 1);
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  async markAllAsRead(): Promise<void> {
    try {
      await apiService.post('/notifications/mark-all-read');
      await this.setBadgeCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }

  // Handler registration
  registerNotificationHandler(type: string, handler: (notification: any) => void): void {
    this.notificationHandlers.set(type, handler);
  }

  unregisterNotificationHandler(type: string): void {
    this.notificationHandlers.delete(type);
  }

  // Permission management
  async checkPermissions(): Promise<boolean> {
    return new Promise((resolve) => {
      PushNotification.checkPermissions((permissions) => {
        resolve(permissions.alert && permissions.badge && permissions.sound);
      });
    });
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      return new Promise((resolve) => {
        PushNotification.requestPermissions((permissions) => {
          resolve(permissions.alert && permissions.badge && permissions.sound);
        });
      });
    } else {
      // Android permissions are handled automatically
      return true;
    }
  }

  // Cancel notifications
  cancelNotification(id: string): void {
    PushNotification.cancelLocalNotification(id);
  }

  cancelAllNotifications(): void {
    PushNotification.cancelAllLocalNotifications();
  }

  // Schedule local notification
  scheduleNotification(config: LocalNotificationConfig & { date: Date }): void {
    PushNotification.localNotificationSchedule({
      title: config.title,
      message: config.message,
      date: config.date,
      userInfo: config.data,
      channelId: config.channelId || NOTIFICATION_CONFIG.CHANNELS.SYSTEM,
    });
  }
}

export const notificationService = new NotificationService();
export default notificationService;