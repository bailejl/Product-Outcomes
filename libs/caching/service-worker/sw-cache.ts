/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// Cache configuration
const CACHE_CONFIG = {
  version: 'v1.2.0',
  caches: {
    static: 'static-cache-v1',
    dynamic: 'dynamic-cache-v1',
    api: 'api-cache-v1',
    images: 'image-cache-v1',
    fonts: 'font-cache-v1'
  },
  maxEntries: {
    dynamic: 100,
    api: 50,
    images: 200
  },
  maxAge: {
    static: 365 * 24 * 60 * 60 * 1000,  // 1 year
    dynamic: 7 * 24 * 60 * 60 * 1000,    // 1 week
    api: 60 * 60 * 1000,                 // 1 hour
    images: 30 * 24 * 60 * 60 * 1000,    // 30 days
    fonts: 365 * 24 * 60 * 60 * 1000     // 1 year
  }
};

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-512x512.png',
  '/assets/css/main.css',
  '/assets/js/main.js'
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /\/api\/products/,
  /\/api\/categories/,
  /\/api\/user\/profile/,
  /\/api\/config/
];

// Background sync tags
const SYNC_TAGS = {
  ANALYTICS: 'analytics-sync',
  OFFLINE_ACTIONS: 'offline-actions',
  CACHE_UPDATE: 'cache-update'
};

class CacheManager {
  private static instance: CacheManager;
  private cacheMetrics: Map<string, { hits: number; misses: number }> = new Map();

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  async openCache(cacheName: string): Promise<Cache> {
    return await caches.open(cacheName);
  }

  async addToCache(cacheName: string, requests: string | string[]): Promise<void> {
    const cache = await this.openCache(cacheName);
    const requestsArray = Array.isArray(requests) ? requests : [requests];
    
    try {
      await cache.addAll(requestsArray);
      console.log(`Added ${requestsArray.length} items to ${cacheName}`);
    } catch (error) {
      console.error(`Failed to add items to cache ${cacheName}:`, error);
      
      // Try adding items one by one if batch fails
      for (const request of requestsArray) {
        try {
          await cache.add(request);
        } catch (individualError) {
          console.warn(`Failed to cache individual item ${request}:`, individualError);
        }
      }
    }
  }

  async getFromCache(cacheName: string, request: Request): Promise<Response | undefined> {
    const cache = await this.openCache(cacheName);
    const response = await cache.match(request);
    
    // Update metrics
    const cacheKey = `${cacheName}:${request.url}`;
    const metrics = this.cacheMetrics.get(cacheKey) || { hits: 0, misses: 0 };
    
    if (response) {
      metrics.hits++;
      console.log(`Cache HIT: ${request.url} from ${cacheName}`);
    } else {
      metrics.misses++;
      console.log(`Cache MISS: ${request.url} from ${cacheName}`);
    }
    
    this.cacheMetrics.set(cacheKey, metrics);
    return response;
  }

  async putInCache(
    cacheName: string, 
    request: Request | string, 
    response: Response,
    options: { maxAge?: number; maxEntries?: number } = {}
  ): Promise<void> {
    const cache = await this.openCache(cacheName);
    
    // Clone response before caching
    const responseClone = response.clone();
    
    // Add cache timestamp for TTL management
    const headers = new Headers(responseClone.headers);
    headers.set('sw-cached-at', Date.now().toString());
    
    const enhancedResponse = new Response(responseClone.body, {
      status: responseClone.status,
      statusText: responseClone.statusText,
      headers
    });
    
    await cache.put(request, enhancedResponse);
    
    // Manage cache size
    if (options.maxEntries) {
      await this.limitCacheSize(cacheName, options.maxEntries);
    }
  }

  async limitCacheSize(cacheName: string, maxEntries: number): Promise<void> {
    const cache = await this.openCache(cacheName);
    const keys = await cache.keys();
    
    if (keys.length > maxEntries) {
      // Remove oldest entries (FIFO approach)
      const entriesToRemove = keys.slice(0, keys.length - maxEntries);
      
      for (const key of entriesToRemove) {
        await cache.delete(key);
      }
      
      console.log(`Removed ${entriesToRemove.length} old entries from ${cacheName}`);
    }
  }

  async cleanupExpiredCache(cacheName: string, maxAge: number): Promise<number> {
    const cache = await this.openCache(cacheName);
    const keys = await cache.keys();
    const now = Date.now();
    let removedCount = 0;
    
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const cachedAt = response.headers.get('sw-cached-at');
        if (cachedAt) {
          const age = now - parseInt(cachedAt);
          if (age > maxAge) {
            await cache.delete(request);
            removedCount++;
          }
        }
      }
    }
    
    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} expired entries from ${cacheName}`);
    }
    
    return removedCount;
  }

  async deleteCache(cacheName: string): Promise<boolean> {
    const deleted = await caches.delete(cacheName);
    if (deleted) {
      console.log(`Deleted cache: ${cacheName}`);
    }
    return deleted;
  }

  getCacheMetrics(): Record<string, { hits: number; misses: number; hitRate: number }> {
    const metrics: Record<string, any> = {};
    
    this.cacheMetrics.forEach((value, key) => {
      const total = value.hits + value.misses;
      metrics[key] = {
        ...value,
        hitRate: total > 0 ? (value.hits / total) * 100 : 0
      };
    });
    
    return metrics;
  }
}

class NetworkStrategy {
  private cacheManager = CacheManager.getInstance();

  async cacheFirst(request: Request, cacheName: string): Promise<Response> {
    // Try cache first
    const cachedResponse = await this.cacheManager.getFromCache(cacheName, request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fall back to network
    try {
      const networkResponse = await fetch(request);
      
      if (networkResponse.ok) {
        await this.cacheManager.putInCache(
          cacheName, 
          request, 
          networkResponse,
          { maxEntries: CACHE_CONFIG.maxEntries.dynamic }
        );
      }
      
      return networkResponse;
    } catch (error) {
      // Return offline page if available
      return await this.getOfflinePage();
    }
  }

  async networkFirst(request: Request, cacheName: string): Promise<Response> {
    try {
      const networkResponse = await fetch(request);
      
      if (networkResponse.ok) {
        await this.cacheManager.putInCache(
          cacheName, 
          request, 
          networkResponse,
          { maxEntries: CACHE_CONFIG.maxEntries.api }
        );
      }
      
      return networkResponse;
    } catch (error) {
      // Fall back to cache
      const cachedResponse = await this.cacheManager.getFromCache(cacheName, request);
      if (cachedResponse) {
        return cachedResponse;
      }
      
      throw error;
    }
  }

  async staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
    const cachedResponse = await this.cacheManager.getFromCache(cacheName, request);
    
    // Always try to update cache in background
    const networkUpdate = fetch(request).then(async (networkResponse) => {
      if (networkResponse.ok) {
        await this.cacheManager.putInCache(
          cacheName, 
          request, 
          networkResponse.clone(),
          { maxEntries: CACHE_CONFIG.maxEntries.dynamic }
        );
      }
      return networkResponse;
    }).catch(error => {
      console.warn('Background update failed:', error);
    });

    // Return cached version immediately if available
    if (cachedResponse) {
      return cachedResponse;
    }

    // Wait for network if no cache
    return await networkUpdate || this.getOfflinePage();
  }

  private async getOfflinePage(): Promise<Response> {
    const cache = await caches.open(CACHE_CONFIG.caches.static);
    const offlinePage = await cache.match('/offline.html');
    
    return offlinePage || new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

class BackgroundSync {
  private syncQueue: Array<{ tag: string; data: any }> = [];

  async queueSync(tag: string, data: any): Promise<void> {
    this.syncQueue.push({ tag, data });
    
    try {
      await self.registration.sync.register(tag);
      console.log(`Queued background sync: ${tag}`);
    } catch (error) {
      console.error('Background sync registration failed:', error);
      // Handle sync immediately if registration fails
      await this.handleSync(tag, data);
    }
  }

  async handleSync(tag: string, data?: any): Promise<void> {
    console.log(`Handling background sync: ${tag}`);
    
    switch (tag) {
      case SYNC_TAGS.ANALYTICS:
        await this.syncAnalytics();
        break;
      case SYNC_TAGS.OFFLINE_ACTIONS:
        await this.syncOfflineActions();
        break;
      case SYNC_TAGS.CACHE_UPDATE:
        await this.updateCaches();
        break;
      default:
        console.warn(`Unknown sync tag: ${tag}`);
    }
  }

  private async syncAnalytics(): Promise<void> {
    // Send queued analytics data
    const analyticsData = await this.getStoredData('analytics-queue');
    
    if (analyticsData.length > 0) {
      try {
        await fetch('/api/analytics/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(analyticsData)
        });
        
        await this.clearStoredData('analytics-queue');
        console.log('Synced analytics data');
      } catch (error) {
        console.error('Failed to sync analytics:', error);
      }
    }
  }

  private async syncOfflineActions(): Promise<void> {
    // Sync actions performed while offline
    const offlineActions = await this.getStoredData('offline-actions');
    
    for (const action of offlineActions) {
      try {
        await fetch(action.url, action.options);
        console.log(`Synced offline action: ${action.type}`);
      } catch (error) {
        console.error(`Failed to sync action ${action.type}:`, error);
        // Re-queue failed actions
      }
    }
    
    await this.clearStoredData('offline-actions');
  }

  private async updateCaches(): Promise<void> {
    const cacheManager = CacheManager.getInstance();
    
    // Clean up expired caches
    for (const [name, maxAge] of Object.entries(CACHE_CONFIG.maxAge)) {
      const cacheName = CACHE_CONFIG.caches[name as keyof typeof CACHE_CONFIG.caches];
      if (cacheName) {
        await cacheManager.cleanupExpiredCache(cacheName, maxAge);
      }
    }
  }

  private async getStoredData(key: string): Promise<any[]> {
    // Implementation would use IndexedDB or another persistent storage
    return [];
  }

  private async clearStoredData(key: string): Promise<void> {
    // Implementation would clear data from persistent storage
  }
}

// Service Worker Event Handlers
const cacheManager = CacheManager.getInstance();
const networkStrategy = new NetworkStrategy();
const backgroundSync = new BackgroundSync();

// Install event
self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    cacheManager.addToCache(CACHE_CONFIG.caches.static, STATIC_ASSETS)
      .then(() => {
        console.log('Static assets cached');
        return self.skipWaiting();
      })
  );
});

// Activate event
self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        const validCaches = Object.values(CACHE_CONFIG.caches);
        return Promise.all(
          cacheNames.map(cacheName => {
            if (!validCaches.includes(cacheName)) {
              console.log(`Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

// Fetch event
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests for caching
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  event.respondWith(handleFetch(request));
});

async function handleFetch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  
  // Static assets - cache first
  if (url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/)) {
    return await networkStrategy.cacheFirst(request, getCacheNameForAsset(url.pathname));
  }
  
  // API requests - network first with cache fallback
  if (API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return await networkStrategy.networkFirst(request, CACHE_CONFIG.caches.api);
  }
  
  // HTML pages - stale while revalidate
  if (request.headers.get('accept')?.includes('text/html')) {
    return await networkStrategy.staleWhileRevalidate(request, CACHE_CONFIG.caches.dynamic);
  }
  
  // Default: network only
  return await fetch(request);
}

function getCacheNameForAsset(pathname: string): string {
  if (pathname.match(/\.(png|jpg|jpeg|gif|svg|ico)$/)) {
    return CACHE_CONFIG.caches.images;
  }
  if (pathname.match(/\.(woff|woff2|ttf)$/)) {
    return CACHE_CONFIG.caches.fonts;
  }
  return CACHE_CONFIG.caches.static;
}

// Background sync event
self.addEventListener('sync', (event: any) => {
  console.log('Background sync triggered:', event.tag);
  
  event.waitUntil(
    backgroundSync.handleSync(event.tag)
  );
});

// Push notification event
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;
  
  const data = event.data.json();
  
  const options: NotificationOptions = {
    body: data.body,
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/badge-72x72.png',
    tag: data.tag || 'default',
    data: data.data,
    actions: data.actions || []
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Notification', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        // Check if there's already a window open with the target URL
        for (const client of clients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window
        return self.clients.openWindow(urlToOpen);
      })
  );
});

// Message event for communication with main thread
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'GET_CACHE_METRICS':
      event.ports[0].postMessage({
        type: 'CACHE_METRICS',
        payload: cacheManager.getCacheMetrics()
      });
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(
        cacheManager.deleteCache(payload.cacheName)
          .then(success => {
            event.ports[0].postMessage({
              type: 'CACHE_CLEARED',
              payload: { success, cacheName: payload.cacheName }
            });
          })
      );
      break;
      
    case 'FORCE_UPDATE':
      event.waitUntil(
        backgroundSync.handleSync(SYNC_TAGS.CACHE_UPDATE)
          .then(() => {
            event.ports[0].postMessage({
              type: 'UPDATE_COMPLETE',
              payload: { success: true }
            });
          })
      );
      break;
      
    case 'QUEUE_OFFLINE_ACTION':
      event.waitUntil(
        backgroundSync.queueSync(SYNC_TAGS.OFFLINE_ACTIONS, payload)
      );
      break;
      
    default:
      console.warn('Unknown message type:', type);
  }
});

// Periodic background sync (if supported)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event: any) => {
    if (event.tag === 'cache-cleanup') {
      event.waitUntil(
        backgroundSync.handleSync(SYNC_TAGS.CACHE_UPDATE)
      );
    }
  });
}

// Export types for TypeScript (if using in a module context)
export type {
  ExtendableEvent,
  FetchEvent,
  PushEvent,
  NotificationEvent,
  ExtendableMessageEvent
};