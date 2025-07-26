import { Injectable, Logger } from '@nestjs/common';

export interface ServiceWorkerConfig {
  enabled: boolean;
  swPath: string;
  scope: string;
  updateCheckInterval: number;
  maxRetries: number;
  enableNotifications: boolean;
  enableBackgroundSync: boolean;
}

export interface CacheMetrics {
  [cacheKey: string]: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

export interface ServiceWorkerStatus {
  isSupported: boolean;
  isRegistered: boolean;
  isControlling: boolean;
  state: ServiceWorkerState | null;
  updateAvailable: boolean;
}

@Injectable()
export class ServiceWorkerManager {
  private readonly logger = new Logger(ServiceWorkerManager.name);
  private registration: ServiceWorkerRegistration | null = null;
  private config: ServiceWorkerConfig;
  private updateCheckTimer?: number;
  private messageChannel?: MessageChannel;

  constructor(config: Partial<ServiceWorkerConfig> = {}) {
    this.config = {
      enabled: true,
      swPath: '/sw.js',
      scope: '/',
      updateCheckInterval: 60000, // 1 minute
      maxRetries: 3,
      enableNotifications: true,
      enableBackgroundSync: true,
      ...config
    };
  }

  async initialize(): Promise<boolean> {
    if (!this.isServiceWorkerSupported()) {
      this.logger.warn('Service Workers not supported in this browser');
      return false;
    }

    if (!this.config.enabled) {
      this.logger.log('Service Worker disabled in configuration');
      return false;
    }

    try {
      await this.registerServiceWorker();
      this.setupEventListeners();
      this.startUpdateChecking();
      
      this.logger.log('Service Worker Manager initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Service Worker Manager:', error);
      return false;
    }
  }

  private isServiceWorkerSupported(): boolean {
    return (
      'serviceWorker' in navigator &&
      'caches' in window &&
      'fetch' in window
    );
  }

  private async registerServiceWorker(): Promise<void> {
    try {
      this.registration = await navigator.serviceWorker.register(
        this.config.swPath,
        { 
          scope: this.config.scope,
          updateViaCache: 'none' // Always check for updates
        }
      );

      this.logger.log(`Service Worker registered with scope: ${this.registration.scope}`);

      // Check for updates immediately
      await this.checkForUpdates();
    } catch (error) {
      this.logger.error('Service Worker registration failed:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.registration) return;

    // Listen for service worker state changes
    this.registration.addEventListener('updatefound', () => {
      this.logger.log('Service Worker update found');
      const newWorker = this.registration!.installing;
      
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          this.logger.log(`Service Worker state changed to: ${newWorker.state}`);
          
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            this.logger.log('New Service Worker available');
            this.notifyUpdateAvailable();
          }
        });
      }
    });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      this.handleServiceWorkerMessage(event);
    });

    // Listen for controller changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      this.logger.log('Service Worker controller changed');
      // Optionally reload the page
      if (this.shouldReloadOnControllerChange()) {
        window.location.reload();
      }
    });
  }

  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, payload } = event.data;

    switch (type) {
      case 'CACHE_METRICS':
        this.logger.debug('Received cache metrics:', payload);
        // Emit event or update UI
        this.emitEvent('cacheMetrics', payload);
        break;

      case 'CACHE_CLEARED':
        this.logger.log(`Cache cleared: ${payload.cacheName}`);
        this.emitEvent('cacheCleared', payload);
        break;

      case 'UPDATE_COMPLETE':
        this.logger.log('Service Worker update complete');
        this.emitEvent('updateComplete', payload);
        break;

      case 'SYNC_COMPLETED':
        this.logger.log('Background sync completed');
        this.emitEvent('syncCompleted', payload);
        break;

      default:
        this.logger.debug('Unknown message from Service Worker:', type, payload);
    }
  }

  async checkForUpdates(): Promise<boolean> {
    if (!this.registration) return false;

    try {
      await this.registration.update();
      
      const hasUpdate = this.registration.waiting !== null;
      if (hasUpdate) {
        this.logger.log('Service Worker update available');
      }
      
      return hasUpdate;
    } catch (error) {
      this.logger.error('Failed to check for Service Worker updates:', error);
      return false;
    }
  }

  async activateUpdate(): Promise<void> {
    if (!this.registration?.waiting) {
      throw new Error('No Service Worker update available');
    }

    // Send skip waiting message to the waiting service worker
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Wait for the new service worker to become active
    return new Promise((resolve) => {
      const handleStateChange = () => {
        if (this.registration?.active?.state === 'activated') {
          this.registration.active.removeEventListener('statechange', handleStateChange);
          resolve();
        }
      };

      this.registration.active?.addEventListener('statechange', handleStateChange);
    });
  }

  async getCacheMetrics(): Promise<CacheMetrics> {
    return new Promise((resolve, reject) => {
      if (!navigator.serviceWorker.controller) {
        reject(new Error('No active Service Worker'));
        return;
      }

      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        if (event.data.type === 'CACHE_METRICS') {
          resolve(event.data.payload);
        } else {
          reject(new Error('Unexpected response from Service Worker'));
        }
      };

      navigator.serviceWorker.controller.postMessage(
        { type: 'GET_CACHE_METRICS' },
        [channel.port2]
      );

      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Timeout waiting for cache metrics'));
      }, 5000);
    });
  }

  async clearCache(cacheName?: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!navigator.serviceWorker.controller) {
        reject(new Error('No active Service Worker'));
        return;
      }

      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        if (event.data.type === 'CACHE_CLEARED') {
          resolve(event.data.payload.success);
        } else {
          reject(new Error('Unexpected response from Service Worker'));
        }
      };

      navigator.serviceWorker.controller.postMessage(
        { 
          type: 'CLEAR_CACHE', 
          payload: { cacheName } 
        },
        [channel.port2]
      );

      setTimeout(() => {
        reject(new Error('Timeout waiting for cache clear'));
      }, 5000);
    });
  }

  async forceUpdate(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!navigator.serviceWorker.controller) {
        reject(new Error('No active Service Worker'));
        return;
      }

      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        if (event.data.type === 'UPDATE_COMPLETE') {
          resolve();
        } else {
          reject(new Error('Unexpected response from Service Worker'));
        }
      };

      navigator.serviceWorker.controller.postMessage(
        { type: 'FORCE_UPDATE' },
        [channel.port2]
      );

      setTimeout(() => {
        reject(new Error('Timeout waiting for force update'));
      }, 10000);
    });
  }

  async queueOfflineAction(action: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: any;
    type: string;
  }): Promise<void> {
    if (!navigator.serviceWorker.controller) {
      throw new Error('No active Service Worker');
    }

    navigator.serviceWorker.controller.postMessage({
      type: 'QUEUE_OFFLINE_ACTION',
      payload: action
    });
  }

  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported');
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    this.logger.log(`Notification permission: ${permission}`);
    
    return permission;
  }

  async subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
    if (!this.registration) {
      throw new Error('Service Worker not registered');
    }

    if (!this.config.enableNotifications) {
      this.logger.warn('Notifications disabled in configuration');
      return null;
    }

    try {
      const permission = await this.requestNotificationPermission();
      if (permission !== 'granted') {
        this.logger.warn('Notification permission not granted');
        return null;
      }

      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
      });

      this.logger.log('Push subscription created');
      return subscription;
    } catch (error) {
      this.logger.error('Failed to create push subscription:', error);
      return null;
    }
  }

  async unsubscribeFromPush(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        const success = await subscription.unsubscribe();
        this.logger.log('Push subscription removed');
        return success;
      }
      return true;
    } catch (error) {
      this.logger.error('Failed to unsubscribe from push:', error);
      return false;
    }
  }

  getStatus(): ServiceWorkerStatus {
    const isSupported = this.isServiceWorkerSupported();
    const isRegistered = this.registration !== null;
    const isControlling = navigator.serviceWorker.controller !== null;
    const state = navigator.serviceWorker.controller?.state || null;
    const updateAvailable = this.registration?.waiting !== null;

    return {
      isSupported,
      isRegistered,
      isControlling,
      state,
      updateAvailable
    };
  }

  private startUpdateChecking(): void {
    if (this.config.updateCheckInterval <= 0) return;

    this.updateCheckTimer = window.setInterval(async () => {
      try {
        await this.checkForUpdates();
      } catch (error) {
        this.logger.error('Error during scheduled update check:', error);
      }
    }, this.config.updateCheckInterval);
  }

  private stopUpdateChecking(): void {
    if (this.updateCheckTimer) {
      clearInterval(this.updateCheckTimer);
      this.updateCheckTimer = undefined;
    }
  }

  private notifyUpdateAvailable(): void {
    this.emitEvent('updateAvailable', {
      message: 'A new version of the app is available',
      action: 'refresh'
    });
  }

  private shouldReloadOnControllerChange(): boolean {
    // You might want to show a prompt to the user instead
    return false;
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private emitEvent(type: string, payload: any): void {
    // Emit custom events for the application to listen to
    const event = new CustomEvent(`sw:${type}`, { detail: payload });
    window.dispatchEvent(event);
  }

  destroy(): void {
    this.stopUpdateChecking();
    
    if (this.messageChannel) {
      this.messageChannel.port1.close();
      this.messageChannel.port2.close();
    }
    
    this.logger.log('Service Worker Manager destroyed');
  }
}

// React hook for Service Worker integration
export function useServiceWorker(config?: Partial<ServiceWorkerConfig>) {
  const [swManager] = useState(() => new ServiceWorkerManager(config));
  const [status, setStatus] = useState<ServiceWorkerStatus>(swManager.getStatus());
  const [cacheMetrics, setCacheMetrics] = useState<CacheMetrics>({});

  useEffect(() => {
    swManager.initialize().then((success) => {
      if (success) {
        setStatus(swManager.getStatus());
        
        // Load initial cache metrics
        swManager.getCacheMetrics()
          .then(setCacheMetrics)
          .catch(console.error);
      }
    });

    // Listen for service worker events
    const handleUpdateAvailable = () => setStatus(swManager.getStatus());
    const handleCacheMetrics = (event: CustomEvent) => setCacheMetrics(event.detail);

    window.addEventListener('sw:updateAvailable', handleUpdateAvailable);
    window.addEventListener('sw:cacheMetrics', handleCacheMetrics);

    return () => {
      window.removeEventListener('sw:updateAvailable', handleUpdateAvailable);
      window.removeEventListener('sw:cacheMetrics', handleCacheMetrics);
      swManager.destroy();
    };
  }, [swManager]);

  return {
    status,
    cacheMetrics,
    checkForUpdates: () => swManager.checkForUpdates(),
    activateUpdate: () => swManager.activateUpdate(),
    clearCache: (cacheName?: string) => swManager.clearCache(cacheName),
    forceUpdate: () => swManager.forceUpdate(),
    getCacheMetrics: () => swManager.getCacheMetrics(),
    subscribeToPush: (vapidKey: string) => swManager.subscribeToPush(vapidKey),
    unsubscribeFromPush: () => swManager.unsubscribeFromPush()
  };
}

// Helper functions for React components
function useState<T>(initialState: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void] {
  // Placeholder - replace with actual React useState in React environment
  throw new Error('useState hook requires React environment');
}

function useEffect(effect: () => void | (() => void), deps?: any[]): void {
  // Placeholder - replace with actual React useEffect in React environment
  throw new Error('useEffect hook requires React environment');
}