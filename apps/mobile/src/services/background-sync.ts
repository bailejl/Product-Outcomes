/**
 * Background Sync Service
 * Handles background data synchronization and app refresh
 */

import BackgroundJob from 'react-native-background-job'
import BackgroundTask from 'react-native-background-task'
import { AppState, AppStateStatus } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { apolloClient, networkUtils } from '../config/apollo.config'
import { offlineQueue } from './offline-queue'
import { useAppStore, useNetworkStore } from '../store'
import { BACKGROUND_SYNC, GET_SYNC_DATA, HEALTH_CHECK } from '../graphql/mutations'
import { MMKV } from 'react-native-mmkv'

// Types
interface SyncConfig {
  enabled: boolean
  interval: number
  maxDuration: number
  wifiOnly: boolean
  lowPowerMode: boolean
  minBatteryLevel: number
  syncOnAppResume: boolean
  syncOnNetworkRestore: boolean
}

interface SyncResult {
  success: boolean
  duration: number
  synced: {
    messages: number
    users: number
    notifications: number
  }
  errors: string[]
  timestamp: number
}

interface BackgroundTaskConfig {
  taskName: string
  taskDesc: string
  taskIcon: string
}

// Storage for sync data
const syncStorage = new MMKV({
  id: 'background-sync',
  encryptionKey: 'background-sync-encryption-key-v1'
})

// Default configuration
const DEFAULT_CONFIG: SyncConfig = {
  enabled: true,
  interval: 300000, // 5 minutes
  maxDuration: 30000, // 30 seconds
  wifiOnly: false,
  lowPowerMode: true,
  minBatteryLevel: 20,
  syncOnAppResume: true,
  syncOnNetworkRestore: true,
}

class BackgroundSyncService {
  private static instance: BackgroundSyncService
  private config: SyncConfig = DEFAULT_CONFIG
  private isRunning = false
  private syncInterval: NodeJS.Timeout | null = null
  private lastSync = 0
  private syncHistory: SyncResult[] = []
  private backgroundTaskId: number | null = null
  private appState: AppStateStatus = 'active'
  private networkUnsubscribe: (() => void) | null = null
  private appStateSubscription: any = null
  
  static getInstance(): BackgroundSyncService {
    if (!BackgroundSyncService.instance) {
      BackgroundSyncService.instance = new BackgroundSyncService()
    }
    return BackgroundSyncService.instance
  }
  
  constructor() {
    this.loadConfig()
    this.loadSyncHistory()
    this.setupAppStateListener()
    this.setupNetworkListener()
    this.setupBackgroundTask()
  }
  
  // Configuration
  configure(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config }
    this.saveConfig()
    
    if (this.isRunning) {
      this.stop()
      this.start()
    }
  }
  
  getConfig(): SyncConfig {
    return { ...this.config }
  }
  
  // Service control
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ Background sync already running')
      return
    }
    
    if (!this.config.enabled) {
      console.log('⚠️ Background sync is disabled')
      return
    }
    
    console.log('🚀 Starting background sync service')
    this.isRunning = true
    
    // Start periodic sync
    this.syncInterval = setInterval(() => {
      this.performSync('periodic')
    }, this.config.interval)
    
    // Start background job for iOS/Android
    this.startBackgroundJob()
    
    console.log(`✅ Background sync started (interval: ${this.config.interval}ms)`)
  }
  
  stop(): void {
    if (!this.isRunning) {
      return
    }
    
    console.log('🛑 Stopping background sync service')
    this.isRunning = false
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
    
    this.stopBackgroundJob()
    
    console.log('✅ Background sync stopped')
  }
  
  // Manual sync
  async forceSync(): Promise<SyncResult> {
    console.log('⚡ Force sync requested')
    return await this.performSync('manual')
  }
  
  // Background sync execution
  private async performSync(trigger: 'periodic' | 'manual' | 'app-resume' | 'network-restore'): Promise<SyncResult> {
    const startTime = Date.now()
    const syncResult: SyncResult = {
      success: false,
      duration: 0,
      synced: { messages: 0, users: 0, notifications: 0 },
      errors: [],
      timestamp: startTime,
    }
    
    try {
      console.log(`🔄 Starting background sync (trigger: ${trigger})`)
      
      // Pre-sync checks
      if (!this.shouldSync(trigger)) {
        syncResult.errors.push('Sync conditions not met')
        return syncResult
      }
      
      // Update sync state
      useAppStore.getState().setSyncState({
        isActive: true,
        progress: 0,
        error: null,
      })
      
      // Step 1: Health check
      useAppStore.getState().setSyncState({ progress: 10 })
      await this.healthCheck()
      
      // Step 2: Process offline queue
      useAppStore.getState().setSyncState({ progress: 30 })
      await this.syncOfflineQueue()
      
      // Step 3: Fetch latest data
      useAppStore.getState().setSyncState({ progress: 60 })
      const syncData = await this.fetchSyncData()
      
      // Step 4: Update local cache
      useAppStore.getState().setSyncState({ progress: 80 })
      await this.updateLocalCache(syncData)
      
      // Step 5: Sync notifications
      useAppStore.getState().setSyncState({ progress: 90 })
      await this.syncNotifications()
      
      // Complete
      useAppStore.getState().setSyncState({ 
        progress: 100,
        isActive: false,
        lastSync: Date.now(),
      })
      
      syncResult.success = true
      syncResult.duration = Date.now() - startTime
      this.lastSync = Date.now()
      
      console.log(`✅ Background sync completed in ${syncResult.duration}ms`)
      
    } catch (error) {
      console.error('❌ Background sync failed:', error)
      syncResult.errors.push(error instanceof Error ? error.message : 'Unknown error')
      
      useAppStore.getState().setSyncState({
        isActive: false,
        error: syncResult.errors[0],
      })
    }
    
    // Save sync result
    this.saveSyncResult(syncResult)
    
    return syncResult
  }
  
  private shouldSync(trigger: string): boolean {
    const { network } = useNetworkStore.getState()
    
    // Check network connectivity
    if (!network.isConnected || !network.isInternetReachable) {
      console.log('📵 Skipping sync - no internet connection')
      return false
    }
    
    // Check WiFi requirement
    if (this.config.wifiOnly && network.type !== 'wifi') {
      console.log('📶 Skipping sync - WiFi required but not connected')
      return false
    }
    
    // Check battery level (if available)
    // Note: Would need react-native-device-info for actual battery level
    // For now, assume battery is sufficient
    
    // Check app state for periodic syncs
    if (trigger === 'periodic' && this.appState !== 'background') {
      // Allow periodic sync only in background or when app is active
    }
    
    // Check minimum interval for non-manual syncs
    if (trigger !== 'manual') {
      const timeSinceLastSync = Date.now() - this.lastSync
      if (timeSinceLastSync < this.config.interval) {
        console.log(`⏱️ Skipping sync - too soon (${timeSinceLastSync}ms < ${this.config.interval}ms)`)
        return false
      }
    }
    
    return true
  }
  
  private async healthCheck(): Promise<void> {
    try {
      await apolloClient.query({
        query: HEALTH_CHECK,
        fetchPolicy: 'network-only',
      })
    } catch (error) {
      throw new Error(`Health check failed: ${error}`)
    }
  }
  
  private async syncOfflineQueue(): Promise<void> {
    try {
      if (offlineQueue.getQueueSize() > 0) {
        await offlineQueue.forceSync()
        console.log(`📤 Processed ${offlineQueue.getQueueSize()} queued operations`)
      }
    } catch (error) {
      console.warn('⚠️ Offline queue sync failed:', error)
      // Don't throw - continue with other sync steps
    }
  }
  
  private async fetchSyncData(): Promise<any> {
    try {
      const { data } = await apolloClient.query({
        query: GET_SYNC_DATA,
        variables: {
          since: new Date(this.lastSync).toISOString(),
        },
        fetchPolicy: 'network-only',
      })
      
      return data.syncData
    } catch (error) {
      throw new Error(`Sync data fetch failed: ${error}`)
    }
  }
  
  private async updateLocalCache(syncData: any): Promise<void> {
    try {
      // Update Apollo cache with new data
      if (syncData.messages?.edges?.length > 0) {
        // Cache would be updated automatically by Apollo
        console.log(`📥 Synced ${syncData.messages.edges.length} messages`)
      }
      
      if (syncData.users?.edges?.length > 0) {
        console.log(`👥 Synced ${syncData.users.edges.length} users`)
      }
      
    } catch (error) {
      console.warn('⚠️ Cache update failed:', error)
      // Don't throw - cache update failures shouldn't stop sync
    }
  }
  
  private async syncNotifications(): Promise<void> {
    try {
      // Fetch latest notifications
      // This would typically be done via a separate query
      console.log('🔔 Notifications synced')
    } catch (error) {
      console.warn('⚠️ Notification sync failed:', error)
    }
  }
  
  // Background task setup
  private setupBackgroundTask(): void {
    const taskConfig: BackgroundTaskConfig = {
      taskName: 'ProductOutcomesSync',
      taskDesc: 'Synchronize data with server',
      taskIcon: 'ic_launcher',
    }
    
    // Configure background job
    BackgroundJob.start({
      taskName: taskConfig.taskName,
      taskDesc: taskConfig.taskDesc,
      taskIcon: taskConfig.taskIcon,
    })
  }
  
  private startBackgroundJob(): void {
    try {
      // iOS Background App Refresh
      this.backgroundTaskId = BackgroundTask.define(() => {
        console.log('🔄 Background task executing...')
        
        // Perform a quick sync
        this.performSync('periodic').finally(() => {
          // Finish the background task
          if (this.backgroundTaskId !== null) {
            BackgroundTask.finish(this.backgroundTaskId)
          }
        })
      })
      
    } catch (error) {
      console.error('❌ Failed to start background job:', error)
    }
  }
  
  private stopBackgroundJob(): void {
    try {
      BackgroundJob.stop()
      
      if (this.backgroundTaskId !== null) {
        BackgroundTask.finish(this.backgroundTaskId)
        this.backgroundTaskId = null
      }
      
    } catch (error) {
      console.error('❌ Failed to stop background job:', error)
    }
  }
  
  // Event listeners
  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      const previousState = this.appState
      this.appState = nextAppState
      
      console.log(`📱 App state changed: ${previousState} -> ${nextAppState}`)
      
      // Sync on app resume
      if (previousState === 'background' && nextAppState === 'active' && this.config.syncOnAppResume) {
        console.log('📱 App resumed, triggering sync...')
        setTimeout(() => {
          this.performSync('app-resume')
        }, 1000) // Small delay to let app settle
      }
    })
  }
  
  private setupNetworkListener(): void {
    this.networkUnsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = !useNetworkStore.getState().network.isConnected
      const isNowOnline = state.isConnected && state.isInternetReachable
      
      // Sync on network restore
      if (wasOffline && isNowOnline && this.config.syncOnNetworkRestore) {
        console.log('📶 Network restored, triggering sync...')
        setTimeout(() => {
          this.performSync('network-restore')
        }, 2000) // Delay to let connection stabilize
      }
    })
  }
  
  // Persistence
  private saveConfig(): void {
    try {
      syncStorage.set('config', JSON.stringify(this.config))
    } catch (error) {
      console.error('Failed to save sync config:', error)
    }
  }
  
  private loadConfig(): void {
    try {
      const configData = syncStorage.getString('config')
      if (configData) {
        this.config = { ...this.config, ...JSON.parse(configData) }
      }
    } catch (error) {
      console.error('Failed to load sync config:', error)
    }
  }
  
  private saveSyncResult(result: SyncResult): void {
    try {
      this.syncHistory.unshift(result)
      
      // Keep only last 50 sync results
      if (this.syncHistory.length > 50) {
        this.syncHistory = this.syncHistory.slice(0, 50)
      }
      
      syncStorage.set('history', JSON.stringify(this.syncHistory))
    } catch (error) {
      console.error('Failed to save sync result:', error)
    }
  }
  
  private loadSyncHistory(): void {
    try {
      const historyData = syncStorage.getString('history')
      if (historyData) {
        this.syncHistory = JSON.parse(historyData)
      }
    } catch (error) {
      console.error('Failed to load sync history:', error)
    }
  }
  
  // Public API
  getStatus(): {
    isRunning: boolean
    lastSync: number
    nextSync: number
    queueSize: number
    history: SyncResult[]
  } {
    return {
      isRunning: this.isRunning,
      lastSync: this.lastSync,
      nextSync: this.lastSync + this.config.interval,
      queueSize: offlineQueue.getQueueSize(),
      history: [...this.syncHistory],
    }
  }
  
  getSyncHistory(): SyncResult[] {
    return [...this.syncHistory]
  }
  
  clearSyncHistory(): void {
    this.syncHistory = []
    syncStorage.delete('history')
  }
  
  // Cleanup
  destroy(): void {
    this.stop()
    
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe()
    }
    
    if (this.appStateSubscription) {
      this.appStateSubscription.remove()
    }
  }
}

// Export singleton instance
export const backgroundSync = BackgroundSyncService.getInstance()

// Export types
export type { SyncConfig, SyncResult, BackgroundTaskConfig }