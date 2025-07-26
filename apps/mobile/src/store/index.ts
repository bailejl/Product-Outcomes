/**
 * Zustand Store Configuration
 * Centralized state management with persistence and offline support
 */

import { create } from 'zustand'
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware'
import { subscribeWithSelector } from 'zustand/middleware'
import { MMKV } from 'react-native-mmkv'
import NetInfo from '@react-native-community/netinfo'
import { authManager } from '../config/apollo.config'
import { offlineQueue, QueueStats } from '../services/offline-queue'

// Storage setup
const storage = new MMKV({
  id: 'app-store',
  encryptionKey: 'app-store-encryption-key-v1'
})

const zustandStorage: StateStorage = {
  getItem: (name: string) => {
    const value = storage.getString(name)
    return value ? JSON.parse(value) : null
  },
  setItem: (name: string, value: string) => {
    storage.set(name, value)
  },
  removeItem: (name: string) => {
    storage.delete(name)
  },
}

// Types
interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  isActive: boolean
  fullName?: string
  displayName?: string
}

interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
}

interface NetworkState {
  isConnected: boolean
  isInternetReachable: boolean
  type: string
}

interface AppSettings {
  theme: 'light' | 'dark' | 'auto'
  language: string
  notifications: {
    push: boolean
    inApp: boolean
    email: boolean
  }
  sync: {
    autoSync: boolean
    syncInterval: number
    syncOnlyOnWifi: boolean
  }
  cache: {
    maxSize: number
    clearOnLogout: boolean
  }
}

interface SyncState {
  isActive: boolean
  lastSync: number
  nextSync: number
  progress: number
  error: string | null
}

// Store interfaces
interface AuthState {
  user: User | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  
  // Actions
  login: (tokens: AuthTokens, user: User) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
  updateTokens: (tokens: AuthTokens) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
}

interface NetworkStore {
  network: NetworkState
  isOffline: boolean
  queueStats: QueueStats
  
  // Actions
  updateNetworkState: (state: NetworkState) => void
  updateQueueStats: (stats: QueueStats) => void
}

interface AppStore {
  settings: AppSettings
  sync: SyncState
  
  // Actions
  updateSettings: (settings: Partial<AppSettings>) => void
  setSyncState: (sync: Partial<SyncState>) => void
  resetSettings: () => void
}

// Default values
const defaultSettings: AppSettings = {
  theme: 'auto',
  language: 'en',
  notifications: {
    push: true,
    inApp: true,
    email: true,
  },
  sync: {
    autoSync: true,
    syncInterval: 300000, // 5 minutes
    syncOnlyOnWifi: false,
  },
  cache: {
    maxSize: 50 * 1024 * 1024, // 50MB
    clearOnLogout: true,
  },
}

const defaultSyncState: SyncState = {
  isActive: false,
  lastSync: 0,
  nextSync: 0,
  progress: 0,
  error: null,
}

const defaultNetworkState: NetworkState = {
  isConnected: true,
  isInternetReachable: true,
  type: 'unknown',
}

const defaultQueueStats: QueueStats = {
  totalOperations: 0,
  pendingOperations: 0,
  failedOperations: 0,
  successfulOperations: 0,
  lastSync: 0,
}

// Auth Store
export const useAuthStore = create<AuthState>()(
  persist(
    subscribeWithSelector((set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      
      login: (tokens: AuthTokens, user: User) => {
        set({
          tokens,
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        })
        
        // Save tokens to secure storage
        authManager.saveTokens(tokens)
      },
      
      logout: async () => {
        const { settings } = useAppStore.getState()
        
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        })
        
        // Clear tokens from secure storage
        await authManager.clearTokens()
        
        // Clear cache if setting is enabled
        if (settings.cache.clearOnLogout) {
          // Clear Apollo cache
          const { cacheUtils } = await import('../config/apollo.config')
          await cacheUtils.clear()
          
          // Clear offline queue
          offlineQueue.clearQueue()
        }
      },
      
      updateUser: (userUpdates: Partial<User>) => {
        const { user } = get()
        if (user) {
          set({
            user: { ...user, ...userUpdates }
          })
        }
      },
      
      updateTokens: (tokens: AuthTokens) => {
        set({ tokens })
        authManager.saveTokens(tokens)
      },
      
      setLoading: (isLoading: boolean) => {
        set({ isLoading })
      },
      
      setError: (error: string | null) => {
        set({ error })
      },
      
      clearError: () => {
        set({ error: null })
      },
    })),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // Don't persist tokens (stored in secure storage)
        // Don't persist loading/error states
      }),
    }
  )
)

// Network Store
export const useNetworkStore = create<NetworkStore>()(
  subscribeWithSelector((set) => ({
    network: defaultNetworkState,
    isOffline: false,
    queueStats: defaultQueueStats,
    
    updateNetworkState: (network: NetworkState) => {
      const isOffline = !network.isConnected || !network.isInternetReachable
      set({ network, isOffline })
    },
    
    updateQueueStats: (queueStats: QueueStats) => {
      set({ queueStats })
    },
  }))
)

// App Store
export const useAppStore = create<AppStore>()(
  persist(
    subscribeWithSelector((set, get) => ({
      settings: defaultSettings,
      sync: defaultSyncState,
      
      updateSettings: (settingsUpdates: Partial<AppSettings>) => {
        const { settings } = get()
        set({
          settings: { ...settings, ...settingsUpdates }
        })
      },
      
      setSyncState: (syncUpdates: Partial<SyncState>) => {
        const { sync } = get()
        set({
          sync: { ...sync, ...syncUpdates }
        })
      },
      
      resetSettings: () => {
        set({ settings: defaultSettings })
      },
    })),
    {
      name: 'app-store',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
)

// Initialize stores
let initialized = false

export const initializeStores = async () => {
  if (initialized) return
  
  console.log('🏪 Initializing stores...')
  
  // Setup network monitoring
  const unsubscribeNetwork = NetInfo.addEventListener(state => {
    useNetworkStore.getState().updateNetworkState({
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable ?? false,
      type: state.type,
    })
  })
  
  // Setup offline queue monitoring
  const unsubscribeQueue = offlineQueue.addListener((stats) => {
    useNetworkStore.getState().updateQueueStats(stats)
  })
  
  // Load auth tokens from secure storage
  try {
    const tokens = await authManager.loadTokens()
    if (tokens) {
      const { user } = useAuthStore.getState()
      if (user) {
        useAuthStore.getState().updateTokens(tokens)
      }
    }
  } catch (error) {
    console.error('Failed to load auth tokens:', error)
  }
  
  // Setup auto-sync
  const { settings } = useAppStore.getState()
  if (settings.sync.autoSync) {
    setupAutoSync()
  }
  
  initialized = true
  console.log('✅ Stores initialized')
  
  // Return cleanup function
  return () => {
    unsubscribeNetwork()
    unsubscribeQueue()
  }
}

// Auto-sync setup
let syncInterval: NodeJS.Timeout | null = null

const setupAutoSync = () => {
  const { settings } = useAppStore.getState()
  const { network } = useNetworkStore.getState()
  
  if (syncInterval) {
    clearInterval(syncInterval)
  }
  
  syncInterval = setInterval(async () => {
    const currentSettings = useAppStore.getState().settings
    const currentNetwork = useNetworkStore.getState().network
    
    // Check if sync conditions are met
    const shouldSync = 
      currentSettings.sync.autoSync &&
      currentNetwork.isConnected &&
      currentNetwork.isInternetReachable &&
      (!currentSettings.sync.syncOnlyOnWifi || currentNetwork.type === 'wifi')
    
    if (shouldSync) {
      try {
        useAppStore.getState().setSyncState({
          isActive: true,
          progress: 0,
          error: null,
        })
        
        // Process offline queue
        await offlineQueue.forceSync()
        
        useAppStore.getState().setSyncState({
          isActive: false,
          lastSync: Date.now(),
          nextSync: Date.now() + currentSettings.sync.syncInterval,
          progress: 100,
        })
        
        console.log('✅ Auto-sync completed')
        
      } catch (error) {
        console.error('❌ Auto-sync failed:', error)
        useAppStore.getState().setSyncState({
          isActive: false,
          error: error instanceof Error ? error.message : 'Sync failed',
        })
      }
    }
  }, settings.sync.syncInterval)
}

// Selectors for common use cases
export const useAuth = () => {
  const auth = useAuthStore()
  return {
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error,
    login: auth.login,
    logout: auth.logout,
    updateUser: auth.updateUser,
    clearError: auth.clearError,
  }
}

export const useNetwork = () => {
  const network = useNetworkStore()
  return {
    isOnline: !network.isOffline,
    isOffline: network.isOffline,
    networkState: network.network,
    queueStats: network.queueStats,
  }
}

export const useSettings = () => {
  const app = useAppStore()
  return {
    settings: app.settings,
    updateSettings: app.updateSettings,
    resetSettings: app.resetSettings,
  }
}

export const useSync = () => {
  const app = useAppStore()
  const network = useNetworkStore()
  
  return {
    syncState: app.sync,
    queueStats: network.queueStats,
    setSyncState: app.setSyncState,
    
    manualSync: async () => {
      if (!network.network.isConnected) {
        throw new Error('Cannot sync while offline')
      }
      
      try {
        app.setSyncState({
          isActive: true,
          progress: 0,
          error: null,
        })
        
        await offlineQueue.forceSync()
        
        app.setSyncState({
          isActive: false,
          lastSync: Date.now(),
          progress: 100,
        })
        
      } catch (error) {
        app.setSyncState({
          isActive: false,
          error: error instanceof Error ? error.message : 'Sync failed',
        })
        throw error
      }
    },
  }
}

// Store subscriptions for React components
export const useAuthSubscription = (callback: (state: AuthState) => void) => {
  return useAuthStore.subscribe(callback)
}

export const useNetworkSubscription = (callback: (state: NetworkStore) => void) => {
  return useNetworkStore.subscribe(callback)
}

export const useAppSubscription = (callback: (state: AppStore) => void) => {
  return useAppStore.subscribe(callback)
}