import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '../contexts/AuthContext'

export interface UseSocketOptions {
  namespace?: string
  autoConnect?: boolean
  reconnectionAttempts?: number
  reconnectionDelay?: number
}

export interface SocketState {
  connected: boolean
  connecting: boolean
  error: string | null
  lastConnected: Date | null
  reconnectAttempt: number
}

export function useSocket(options: UseSocketOptions = {}) {
  const {
    namespace = '',
    autoConnect = true,
    reconnectionAttempts = 5,
    reconnectionDelay = 1000
  } = options

  const { state: authState } = useAuth()
  const socketRef = useRef<Socket | null>(null)
  const [socketState, setSocketState] = useState<SocketState>({
    connected: false,
    connecting: false,
    error: null,
    lastConnected: null,
    reconnectAttempt: 0
  })

  const connect = useCallback(() => {
    if (!authState.isAuthenticated || socketRef.current?.connected) {
      return
    }

    setSocketState(prev => ({ ...prev, connecting: true, error: null }))

    try {
      const serverUrl = process.env.REACT_APP_API_URL || 'http://localhost:3333'
      const socketUrl = `${serverUrl}${namespace}`

      socketRef.current = io(socketUrl, {
        auth: {
          token: authState.tokens?.accessToken
        },
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts,
        reconnectionDelay,
        transports: ['polling', 'websocket']
      })

      const socket = socketRef.current

      socket.on('connect', () => {
        console.log(`✅ Connected to Socket.io${namespace ? ` namespace: ${namespace}` : ''}`)
        setSocketState(prev => ({
          ...prev,
          connected: true,
          connecting: false,
          error: null,
          lastConnected: new Date(),
          reconnectAttempt: 0
        }))
      })

      socket.on('disconnect', (reason) => {
        console.log(`❌ Disconnected from Socket.io${namespace ? ` namespace: ${namespace}` : ''}: ${reason}`)
        setSocketState(prev => ({
          ...prev,
          connected: false,
          connecting: false,
          error: reason === 'io server disconnect' ? 'Server disconnected' : null
        }))
      })

      socket.on('connect_error', (error) => {
        console.error('❌ Socket.io connection error:', error)
        setSocketState(prev => ({
          ...prev,
          connected: false,
          connecting: false,
          error: error.message || 'Connection failed'
        }))
      })

      socket.on('reconnect', (attemptNumber) => {
        console.log(`🔄 Reconnected to Socket.io after ${attemptNumber} attempts`)
        setSocketState(prev => ({
          ...prev,
          connected: true,
          connecting: false,
          error: null,
          lastConnected: new Date(),
          reconnectAttempt: 0
        }))
      })

      socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 Reconnection attempt ${attemptNumber}`)
        setSocketState(prev => ({
          ...prev,
          reconnectAttempt: attemptNumber
        }))
      })

      socket.on('reconnect_failed', () => {
        console.error('❌ Socket.io reconnection failed')
        setSocketState(prev => ({
          ...prev,
          connected: false,
          connecting: false,
          error: 'Reconnection failed'
        }))
      })

      // Handle rate limiting
      socket.on('rate_limit_exceeded', (data) => {
        console.warn('⚠️ Rate limit exceeded:', data)
        setSocketState(prev => ({
          ...prev,
          error: `Rate limit exceeded for ${data.event}. Retry in ${data.retryAfter}s`
        }))
      })

      // Handle authentication errors
      socket.on('error', (error) => {
        console.error('❌ Socket.io error:', error)
        setSocketState(prev => ({
          ...prev,
          error: error.message || 'Socket error'
        }))
      })

    } catch (error) {
      console.error('❌ Failed to create socket connection:', error)
      setSocketState(prev => ({
        ...prev,
        connecting: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }))
    }
  }, [authState.isAuthenticated, authState.tokens?.accessToken, namespace, reconnectionAttempts, reconnectionDelay])

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
      setSocketState(prev => ({
        ...prev,
        connected: false,
        connecting: false
      }))
    }
  }, [])

  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data)
      return true
    }
    console.warn(`⚠️ Cannot emit ${event}: socket not connected`)
    return false
  }, [])

  const on = useCallback((event: string, listener: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, listener)
      return () => socketRef.current?.off(event, listener)
    }
    return () => {}
  }, [])

  const off = useCallback((event: string, listener?: (...args: any[]) => void) => {
    if (socketRef.current) {
      if (listener) {
        socketRef.current.off(event, listener)
      } else {
        socketRef.current.off(event)
      }
    }
  }, [])

  // Auto-connect when authenticated
  useEffect(() => {
    if (autoConnect && authState.isAuthenticated && !socketRef.current?.connected) {
      connect()
    } else if (!authState.isAuthenticated && socketRef.current) {
      disconnect()
    }
  }, [autoConnect, authState.isAuthenticated, connect, disconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    socket: socketRef.current,
    ...socketState,
    connect,
    disconnect,
    emit,
    on,
    off
  }
}