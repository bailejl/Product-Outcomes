/**
 * Network Monitor Service
 * Advanced network status monitoring and user feedback
 */

import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo'
import { MMKV } from 'react-native-mmkv'
import { apolloClient } from '../config/apollo.config'
import { useNetworkStore } from '../store'
import { PING } from '../graphql/mutations'

// Types
interface NetworkQuality {
  type: NetInfoStateType
  isConnected: boolean
  isInternetReachable: boolean
  strength: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'
  speed: 'fast' | 'medium' | 'slow' | 'unknown'
  latency: number // in ms
  bandwidth: number // in kbps
}

interface ConnectionTest {
  timestamp: number
  success: boolean
  latency: number
  error?: string
}

interface NetworkEvent {
  timestamp: number
  type: 'connected' | 'disconnected' | 'type_changed' | 'quality_changed'
  previousState?: NetworkQuality
  currentState: NetworkQuality
  duration?: number // for disconnect events
}

interface NetworkStats {
  totalConnectedTime: number
  totalDisconnectedTime: number
  connectionAttempts: number
  successfulConnections: number
  averageLatency: number
  connectionQuality: NetworkQuality
  events: NetworkEvent[]
}

// Storage for network data
const networkStorage = new MMKV({
  id: 'network-monitor',
  encryptionKey: 'network-monitor-encryption-key-v1'
})

class NetworkMonitorService {
  private static instance: NetworkMonitorService
  private isMonitoring = false
  private currentState: NetworkQuality | null = null
  private connectionTests: ConnectionTest[] = []
  private events: NetworkEvent[] = []
  private stats: NetworkStats = {
    totalConnectedTime: 0,
    totalDisconnectedTime: 0,
    connectionAttempts: 0,
    successfulConnections: 0,
    averageLatency: 0,
    connectionQuality: {} as NetworkQuality,
    events: [],
  }
  private listeners: Array<(quality: NetworkQuality) => void> = []
  private unsubscribeNetInfo: (() => void) | null = null
  private testInterval: NodeJS.Timeout | null = null
  private qualityTestTimer: NodeJS.Timeout | null = null
  private lastDisconnectTime = 0
  private lastConnectTime = Date.now()
  
  static getInstance(): NetworkMonitorService {
    if (!NetworkMonitorService.instance) {
      NetworkMonitorService.instance = new NetworkMonitorService()
    }
    return NetworkMonitorService.instance
  }
  
  constructor() {
    this.loadStats()
    this.loadEvents()
  }
  
  // Service control
  startMonitoring(): void {
    if (this.isMonitoring) {
      console.log('⚠️ Network monitoring already started')
      return
    }
    
    console.log('🔍 Starting network monitoring...')
    this.isMonitoring = true
    
    // Subscribe to network state changes
    this.unsubscribeNetInfo = NetInfo.addEventListener(this.handleNetworkStateChange.bind(this))
    
    // Start periodic connection quality tests
    this.startQualityTesting()
    
    // Get initial state
    NetInfo.fetch().then(this.handleNetworkStateChange.bind(this))
    
    console.log('✅ Network monitoring started')
  }
  
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return
    }
    
    console.log('🛑 Stopping network monitoring...')
    this.isMonitoring = false
    
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo()
      this.unsubscribeNetInfo = null
    }
    
    this.stopQualityTesting()
    
    console.log('✅ Network monitoring stopped')
  }
  
  // Network state handling
  private handleNetworkStateChange(state: NetInfoState): void {
    const previousState = this.currentState
    const currentState = this.mapNetInfoToQuality(state)
    
    // Update current state
    this.currentState = currentState
    
    // Update store
    useNetworkStore.getState().updateNetworkState({
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable ?? false,
      type: state.type,
    })
    
    // Track connection/disconnection timing
    this.updateConnectionTiming(previousState, currentState)
    
    // Create network event
    const event: NetworkEvent = {
      timestamp: Date.now(),
      type: this.getEventType(previousState, currentState),
      previousState: previousState || undefined,
      currentState,
    }
    
    // Add duration for disconnect events
    if (event.type === 'connected' && this.lastDisconnectTime > 0) {
      event.duration = Date.now() - this.lastDisconnectTime
    }
    
    this.addEvent(event)
    this.updateStats(event)
    
    // Notify listeners
    this.notifyListeners(currentState)
    
    // Log significant changes
    if (previousState?.isConnected !== currentState.isConnected) {
      if (currentState.isConnected) {
        console.log(`📶 Connected to ${currentState.type} network`)
        this.testConnectionQuality() // Test immediately on connect
      } else {
        console.log('📵 Network disconnected')
      }
    }
    
    // Test quality on network type changes
    if (previousState?.type !== currentState.type && currentState.isConnected) {
      console.log(`🔄 Network type changed to ${currentState.type}`)
      setTimeout(() => this.testConnectionQuality(), 2000) // Test after connection stabilizes
    }
  }
  
  private mapNetInfoToQuality(state: NetInfoState): NetworkQuality {
    return {
      type: state.type,
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable ?? false,
      strength: this.calculateSignalStrength(state),
      speed: 'unknown', // Will be determined by quality tests
      latency: 0, // Will be updated by ping tests
      bandwidth: 0, // Will be estimated by speed tests
    }
  }
  
  private calculateSignalStrength(state: NetInfoState): NetworkQuality['strength'] {
    if (state.type === 'wifi' && state.details) {
      const wifiDetails = state.details as any
      if (wifiDetails.strength !== undefined) {
        const strength = wifiDetails.strength
        if (strength >= 80) return 'excellent'
        if (strength >= 60) return 'good'
        if (strength >= 40) return 'fair'
        if (strength >= 20) return 'poor'
      }
    }
    
    if (state.type === 'cellular' && state.details) {
      const cellularDetails = state.details as any
      if (cellularDetails.cellularGeneration) {
        const generation = cellularDetails.cellularGeneration
        if (generation === '5g') return 'excellent'
        if (generation === '4g') return 'good'
        if (generation === '3g') return 'fair'
        if (generation === '2g') return 'poor'
      }
    }
    
    return 'unknown'
  }
  
  private getEventType(previous: NetworkQuality | null, current: NetworkQuality): NetworkEvent['type'] {
    if (!previous) return current.isConnected ? 'connected' : 'disconnected'
    
    if (previous.isConnected && !current.isConnected) return 'disconnected'
    if (!previous.isConnected && current.isConnected) return 'connected'
    if (previous.type !== current.type) return 'type_changed'
    if (previous.strength !== current.strength) return 'quality_changed'
    
    return 'quality_changed'
  }
  
  private updateConnectionTiming(previous: NetworkQuality | null, current: NetworkQuality): void {
    const now = Date.now()
    
    if (previous?.isConnected && !current.isConnected) {
      // Went offline
      this.lastDisconnectTime = now
      if (this.lastConnectTime > 0) {
        this.stats.totalConnectedTime += now - this.lastConnectTime
      }
    } else if (!previous?.isConnected && current.isConnected) {
      // Came online
      this.lastConnectTime = now
      if (this.lastDisconnectTime > 0) {
        this.stats.totalDisconnectedTime += now - this.lastDisconnectTime
      }
      this.stats.connectionAttempts++
      this.stats.successfulConnections++
    }
  }
  
  // Quality testing
  private startQualityTesting(): void {
    // Test connection quality every 30 seconds when connected
    this.qualityTestTimer = setInterval(() => {
      if (this.currentState?.isConnected) {
        this.testConnectionQuality()
      }
    }, 30000)
  }
  
  private stopQualityTesting(): void {
    if (this.qualityTestTimer) {
      clearInterval(this.qualityTestTimer)
      this.qualityTestTimer = null
    }
  }
  
  private async testConnectionQuality(): Promise<void> {
    if (!this.currentState?.isConnected) {
      return
    }
    
    try {
      const startTime = Date.now()
      
      // Ping GraphQL server
      await apolloClient.mutate({
        mutation: PING,
        fetchPolicy: 'network-only',
      })
      
      const latency = Date.now() - startTime
      
      // Record successful test
      const test: ConnectionTest = {
        timestamp: Date.now(),
        success: true,
        latency,
      }
      
      this.addConnectionTest(test)
      
      // Update current state with measured latency
      if (this.currentState) {
        this.currentState.latency = latency
        this.currentState.speed = this.categorizeSpeed(latency)
        
        // Update stats
        this.updateAverageLatency(latency)
        this.stats.connectionQuality = { ...this.currentState }
      }
      
      console.log(`📊 Network quality test: ${latency}ms latency`)
      
    } catch (error) {
      console.warn('⚠️ Network quality test failed:', error)
      
      // Record failed test
      const test: ConnectionTest = {
        timestamp: Date.now(),
        success: false,
        latency: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
      
      this.addConnectionTest(test)
    }
  }
  
  private categorizeSpeed(latency: number): NetworkQuality['speed'] {
    if (latency < 100) return 'fast'
    if (latency < 300) return 'medium'
    if (latency < 1000) return 'slow'
    return 'unknown'
  }
  
  private updateAverageLatency(newLatency: number): void {
    const recentTests = this.connectionTests
      .filter(test => test.success && test.timestamp > Date.now() - 300000) // Last 5 minutes
      .slice(-10) // Last 10 tests
    
    if (recentTests.length > 0) {
      const totalLatency = recentTests.reduce((sum, test) => sum + test.latency, 0)
      this.stats.averageLatency = totalLatency / recentTests.length
    }
  }
  
  // Event and test management
  private addEvent(event: NetworkEvent): void {
    this.events.unshift(event)
    
    // Keep only last 100 events
    if (this.events.length > 100) {
      this.events = this.events.slice(0, 100)
    }
    
    this.saveEvents()
  }
  
  private addConnectionTest(test: ConnectionTest): void {
    this.connectionTests.unshift(test)
    
    // Keep only last 50 tests
    if (this.connectionTests.length > 50) {
      this.connectionTests = this.connectionTests.slice(0, 50)
    }
    
    this.saveConnectionTests()
  }
  
  private updateStats(event: NetworkEvent): void {
    this.stats.events = this.events.slice(0, 10) // Keep last 10 events in stats
    this.saveStats()
  }
  
  // Manual testing
  async testConnection(): Promise<ConnectionTest> {
    console.log('🔍 Manual connection test requested')
    
    if (!this.currentState?.isConnected) {
      const test: ConnectionTest = {
        timestamp: Date.now(),
        success: false,
        latency: 0,
        error: 'No network connection',
      }
      this.addConnectionTest(test)
      return test
    }
    
    await this.testConnectionQuality()
    return this.connectionTests[0] // Return most recent test
  }
  
  // Public API
  getCurrentQuality(): NetworkQuality | null {
    return this.currentState ? { ...this.currentState } : null
  }
  
  getConnectionTests(): ConnectionTest[] {
    return [...this.connectionTests]
  }
  
  getEvents(): NetworkEvent[] {
    return [...this.events]
  }
  
  getStats(): NetworkStats {
    return { ...this.stats }
  }
  
  isConnected(): boolean {
    return this.currentState?.isConnected ?? false
  }
  
  hasInternetAccess(): boolean {
    return this.currentState?.isInternetReachable ?? false
  }
  
  getConnectionType(): NetInfoStateType {
    return this.currentState?.type ?? 'unknown'
  }
  
  getConnectionStrength(): NetworkQuality['strength'] {
    return this.currentState?.strength ?? 'unknown'
  }
  
  getLatency(): number {
    return this.currentState?.latency ?? 0
  }
  
  // Listeners
  addListener(listener: (quality: NetworkQuality) => void): () => void {
    this.listeners.push(listener)
    
    // Call immediately with current state
    if (this.currentState) {
      listener(this.currentState)
    }
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }
  
  private notifyListeners(quality: NetworkQuality): void {
    this.listeners.forEach(listener => {
      try {
        listener(quality)
      } catch (error) {
        console.error('Error in network quality listener:', error)
      }
    })
  }
  
  // Persistence
  private saveStats(): void {
    try {
      networkStorage.set('stats', JSON.stringify(this.stats))
    } catch (error) {
      console.error('Failed to save network stats:', error)
    }
  }
  
  private loadStats(): void {
    try {
      const statsData = networkStorage.getString('stats')
      if (statsData) {
        this.stats = { ...this.stats, ...JSON.parse(statsData) }
      }
    } catch (error) {
      console.error('Failed to load network stats:', error)
    }
  }
  
  private saveEvents(): void {
    try {
      networkStorage.set('events', JSON.stringify(this.events))
    } catch (error) {
      console.error('Failed to save network events:', error)
    }
  }
  
  private loadEvents(): void {
    try {
      const eventsData = networkStorage.getString('events')
      if (eventsData) {
        this.events = JSON.parse(eventsData)
      }
    } catch (error) {
      console.error('Failed to load network events:', error)
    }
  }
  
  private saveConnectionTests(): void {
    try {
      networkStorage.set('tests', JSON.stringify(this.connectionTests))
    } catch (error) {
      console.error('Failed to save connection tests:', error)
    }
  }
  
  private loadConnectionTests(): void {
    try {
      const testsData = networkStorage.getString('tests')
      if (testsData) {
        this.connectionTests = JSON.parse(testsData)
      }
    } catch (error) {
      console.error('Failed to load connection tests:', error)
    }
  }
  
  // Cleanup
  clearHistory(): void {
    this.events = []
    this.connectionTests = []
    this.stats = {
      totalConnectedTime: 0,
      totalDisconnectedTime: 0,
      connectionAttempts: 0,
      successfulConnections: 0,
      averageLatency: 0,
      connectionQuality: {} as NetworkQuality,
      events: [],
    }
    
    networkStorage.delete('events')
    networkStorage.delete('tests')
    networkStorage.delete('stats')
    
    console.log('🗑️ Network history cleared')
  }
  
  destroy(): void {
    this.stopMonitoring()
    this.listeners = []
  }
}

// Export singleton instance
export const networkMonitor = NetworkMonitorService.getInstance()

// Export types
export type { NetworkQuality, ConnectionTest, NetworkEvent, NetworkStats }