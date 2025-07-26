/**
 * Offline Queue Service
 * Handles queueing mutations when offline and executing them when back online
 */

import { DocumentNode } from 'graphql'
import { MMKV } from 'react-native-mmkv'
import NetInfo from '@react-native-community/netinfo'
import { apolloClient, networkUtils } from '../config/apollo.config'
import { v4 as uuidv4 } from 'react-native-uuid'

// Types
interface QueuedOperation {
  id: string
  mutation: DocumentNode
  variables: any
  optimisticResponse?: any
  update?: any
  context?: any
  timestamp: number
  retryCount: number
  maxRetries: number
  priority: 'high' | 'medium' | 'low'
  category: string
}

interface QueueConfig {
  maxSize: number
  maxRetries: number
  retryDelay: number
  batchSize: number
  enableBatching: boolean
}

interface QueueStats {
  totalOperations: number
  pendingOperations: number
  failedOperations: number
  successfulOperations: number
  lastSync: number
}

// Default configuration
const DEFAULT_CONFIG: QueueConfig = {
  maxSize: 1000,
  maxRetries: 3,
  retryDelay: 1000,
  batchSize: 10,
  enableBatching: true,
}

// Storage for offline queue
const queueStorage = new MMKV({
  id: 'offline-queue',
  encryptionKey: 'offline-queue-encryption-key-v1'
})

class OfflineQueueService {
  private static instance: OfflineQueueService
  private queue: QueuedOperation[] = []
  private isProcessing = false
  private config: QueueConfig = DEFAULT_CONFIG
  private stats: QueueStats = {
    totalOperations: 0,
    pendingOperations: 0,
    failedOperations: 0,
    successfulOperations: 0,
    lastSync: 0,
  }
  private listeners: Array<(stats: QueueStats) => void> = []
  
  static getInstance(): OfflineQueueService {
    if (!OfflineQueueService.instance) {
      OfflineQueueService.instance = new OfflineQueueService()
    }
    return OfflineQueueService.instance
  }
  
  constructor() {
    this.loadQueue()
    this.loadStats()
    this.setupNetworkListener()
  }
  
  // Configuration
  configure(config: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...config }
    this.saveConfig()
  }
  
  // Queue management
  async enqueue(
    mutation: DocumentNode,
    variables: any,
    options: {
      optimisticResponse?: any
      update?: any
      context?: any
      priority?: 'high' | 'medium' | 'low'
      category?: string
      maxRetries?: number
    } = {}
  ): Promise<string> {
    const operation: QueuedOperation = {
      id: uuidv4(),
      mutation,
      variables,
      optimisticResponse: options.optimisticResponse,
      update: options.update,
      context: options.context,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: options.maxRetries || this.config.maxRetries,
      priority: options.priority || 'medium',
      category: options.category || 'default',
    }
    
    // Check queue size limit
    if (this.queue.length >= this.config.maxSize) {
      // Remove oldest low-priority operation
      const oldestLowPriority = this.queue.find(op => op.priority === 'low')
      if (oldestLowPriority) {
        this.queue = this.queue.filter(op => op.id !== oldestLowPriority.id)
      } else {
        throw new Error('Queue is full and no low-priority operations to remove')
      }
    }
    
    // Add to queue based on priority
    if (operation.priority === 'high') {
      this.queue.unshift(operation)
    } else {
      this.queue.push(operation)
    }
    
    this.updateStats({ pendingOperations: this.queue.length })
    this.saveQueue()
    this.notifyListeners()
    
    // Try to process immediately if online
    if (networkUtils.isOnline()) {
      this.processQueue()
    }
    
    return operation.id
  }
  
  async dequeue(operationId: string): Promise<boolean> {
    const index = this.queue.findIndex(op => op.id === operationId)
    if (index === -1) {
      return false
    }
    
    this.queue.splice(index, 1)
    this.updateStats({ pendingOperations: this.queue.length })
    this.saveQueue()
    this.notifyListeners()
    
    return true
  }
  
  // Queue processing
  async processQueue(): Promise<void> {
    if (this.isProcessing || !networkUtils.isOnline() || this.queue.length === 0) {
      return
    }
    
    this.isProcessing = true
    console.log(`🔄 Processing offline queue: ${this.queue.length} operations`)
    
    try {
      // Sort by priority and timestamp
      const sortedQueue = [...this.queue].sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 }
        const aPriority = priorityOrder[a.priority]
        const bPriority = priorityOrder[b.priority]
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority // Higher priority first
        }
        
        return a.timestamp - b.timestamp // Older first for same priority
      })
      
      // Process in batches
      const batchSize = this.config.enableBatching ? this.config.batchSize : 1
      
      for (let i = 0; i < sortedQueue.length; i += batchSize) {
        const batch = sortedQueue.slice(i, i + batchSize)
        
        if (this.config.enableBatching && batch.length > 1) {
          await this.processBatch(batch)
        } else {
          for (const operation of batch) {
            await this.processOperation(operation)
          }
        }
        
        // Check if still online between batches
        if (!networkUtils.isOnline()) {
          console.log('📱 Device went offline during queue processing')
          break
        }
      }
      
      this.updateStats({ lastSync: Date.now() })
      this.notifyListeners()
      
    } catch (error) {
      console.error('❌ Error processing offline queue:', error)
    } finally {
      this.isProcessing = false
    }
  }
  
  private async processOperation(operation: QueuedOperation): Promise<void> {
    try {
      console.log(`📤 Executing queued operation: ${operation.category}`)
      
      const result = await apolloClient.mutate({
        mutation: operation.mutation,
        variables: operation.variables,
        context: operation.context,
        update: operation.update,
      })
      
      // Operation successful
      this.removeFromQueue(operation.id)
      this.updateStats({ 
        successfulOperations: this.stats.successfulOperations + 1,
        pendingOperations: this.queue.length,
      })
      
      console.log(`✅ Queued operation completed: ${operation.category}`)
      
    } catch (error) {
      console.error(`❌ Queued operation failed: ${operation.category}`, error)
      
      operation.retryCount++
      
      if (operation.retryCount >= operation.maxRetries) {
        // Max retries reached, remove from queue
        this.removeFromQueue(operation.id)
        this.updateStats({ 
          failedOperations: this.stats.failedOperations + 1,
          pendingOperations: this.queue.length,
        })
        
        console.error(`🚫 Queued operation permanently failed: ${operation.category}`)
      } else {
        // Schedule retry with exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, operation.retryCount - 1)
        console.log(`⏱️ Retrying operation in ${delay}ms (attempt ${operation.retryCount}/${operation.maxRetries})`)
        
        setTimeout(() => {
          if (networkUtils.isOnline()) {
            this.processOperation(operation)
          }
        }, delay)
      }
    }
  }
  
  private async processBatch(operations: QueuedOperation[]): Promise<void> {
    // Group operations by category for better batching
    const categories = new Map<string, QueuedOperation[]>()
    
    operations.forEach(op => {
      if (!categories.has(op.category)) {
        categories.set(op.category, [])
      }
      categories.get(op.category)!.push(op)
    })
    
    // Process each category batch
    for (const [category, ops] of categories) {
      console.log(`📦 Processing batch for category: ${category} (${ops.length} operations)`)
      
      try {
        // Execute operations in parallel for same category
        await Promise.all(ops.map(op => this.processOperation(op)))
      } catch (error) {
        console.error(`❌ Batch processing failed for category: ${category}`, error)
        // Individual operations will handle their own retries
      }
    }
  }
  
  private removeFromQueue(operationId: string): void {
    this.queue = this.queue.filter(op => op.id !== operationId)
    this.saveQueue()
  }
  
  // Network monitoring
  private setupNetworkListener(): void {
    NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        console.log('📶 Network connection restored, processing offline queue')
        
        // Wait a moment for connection to stabilize
        setTimeout(() => {
          this.processQueue()
        }, 1000)
      }
    })
  }
  
  // Persistence
  private saveQueue(): void {
    try {
      const queueData = JSON.stringify(this.queue)
      queueStorage.set('queue', queueData)
    } catch (error) {
      console.error('Failed to save offline queue:', error)
    }
  }
  
  private loadQueue(): void {
    try {
      const queueData = queueStorage.getString('queue')
      if (queueData) {
        this.queue = JSON.parse(queueData)
        console.log(`📂 Loaded ${this.queue.length} operations from offline queue`)
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error)
      this.queue = []
    }
  }
  
  private saveConfig(): void {
    try {
      queueStorage.set('config', JSON.stringify(this.config))
    } catch (error) {
      console.error('Failed to save queue config:', error)
    }
  }
  
  private loadConfig(): void {
    try {
      const configData = queueStorage.getString('config')
      if (configData) {
        this.config = { ...this.config, ...JSON.parse(configData) }
      }
    } catch (error) {
      console.error('Failed to load queue config:', error)
    }
  }
  
  private saveStats(): void {
    try {
      queueStorage.set('stats', JSON.stringify(this.stats))
    } catch (error) {
      console.error('Failed to save queue stats:', error)
    }
  }
  
  private loadStats(): void {
    try {
      const statsData = queueStorage.getString('stats')
      if (statsData) {
        this.stats = { ...this.stats, ...JSON.parse(statsData) }
      }
    } catch (error) {
      console.error('Failed to load queue stats:', error)
    }
  }
  
  private updateStats(updates: Partial<QueueStats>): void {
    this.stats = { ...this.stats, ...updates }
    this.saveStats()
  }
  
  // Public API
  getStats(): QueueStats {
    return { ...this.stats }
  }
  
  getQueueSize(): number {
    return this.queue.length
  }
  
  getOperations(): QueuedOperation[] {
    return [...this.queue]
  }
  
  clearQueue(): void {
    this.queue = []
    this.updateStats({ 
      pendingOperations: 0,
      failedOperations: 0,
      successfulOperations: 0,
    })
    this.saveQueue()
    this.notifyListeners()
    console.log('🗑️ Offline queue cleared')
  }
  
  clearFailedOperations(): void {
    this.updateStats({ failedOperations: 0 })
    this.saveStats()
    this.notifyListeners()
  }
  
  // Force process queue (for testing or manual sync)
  async forceSync(): Promise<void> {
    if (networkUtils.isOnline()) {
      await this.processQueue()
    } else {
      throw new Error('Cannot sync while offline')
    }
  }
  
  // Listeners for UI updates
  addListener(listener: (stats: QueueStats) => void): () => void {
    this.listeners.push(listener)
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }
  
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.stats)
      } catch (error) {
        console.error('Error in queue listener:', error)
      }
    })
  }
  
  // Utility methods
  hasOperationsForCategory(category: string): boolean {
    return this.queue.some(op => op.category === category)
  }
  
  getOperationsByCategory(category: string): QueuedOperation[] {
    return this.queue.filter(op => op.category === category)
  }
  
  getOperationsByPriority(priority: 'high' | 'medium' | 'low'): QueuedOperation[] {
    return this.queue.filter(op => op.priority === priority)
  }
}

// Export singleton instance
export const offlineQueue = OfflineQueueService.getInstance()

// Export helper functions for common operations
export const queueMutation = (
  mutation: DocumentNode,
  variables: any,
  options?: {
    optimisticResponse?: any
    update?: any
    context?: any
    priority?: 'high' | 'medium' | 'low'
    category?: string
  }
): Promise<string> => {
  return offlineQueue.enqueue(mutation, variables, options)
}

export const isOfflineQueueEmpty = (): boolean => {
  return offlineQueue.getQueueSize() === 0
}

export const getOfflineQueueStats = (): QueueStats => {
  return offlineQueue.getStats()
}

// Export types
export type {
  QueuedOperation,
  QueueConfig,
  QueueStats,
}