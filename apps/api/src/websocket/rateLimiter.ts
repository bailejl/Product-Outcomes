import { Socket } from 'socket.io'

interface SocketRateLimitInfo {
  count: number
  resetTime: number
  windowStart: number
}

interface RateLimitOptions {
  windowMs: number // Time window in milliseconds
  maxEvents: number // Maximum events per window
  keyGenerator?: (socket: Socket, eventName: string) => string
  onLimitReached?: (socket: Socket, eventName: string) => void
}

// In-memory store for socket rate limiting
const socketRateLimitStore = new Map<string, SocketRateLimitInfo>()

export class SocketRateLimiter {
  private options: RateLimitOptions

  constructor(options: RateLimitOptions) {
    this.options = {
      keyGenerator: (socket: Socket, eventName: string) => `${socket.id}:${eventName}`,
      onLimitReached: (socket: Socket, eventName: string) => {
        socket.emit('rate_limit_exceeded', {
          event: eventName,
          message: 'Rate limit exceeded for this event',
          retryAfter: Math.ceil((this.getResetTime(socket, eventName) - Date.now()) / 1000)
        })
      },
      ...options
    }

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000)
  }

  /**
   * Check if event is rate limited
   */
  isAllowed(socket: Socket, eventName: string): boolean {
    const key = this.options.keyGenerator!(socket, eventName)
    const now = Date.now()
    const windowStart = now - this.options.windowMs

    // Get or create rate limit info
    let info = socketRateLimitStore.get(key)
    
    // Reset if window has passed
    if (!info || info.windowStart < windowStart) {
      info = {
        count: 0,
        resetTime: now + this.options.windowMs,
        windowStart: now
      }
      socketRateLimitStore.set(key, info)
    }

    // Check if limit exceeded
    if (info.count >= this.options.maxEvents) {
      this.options.onLimitReached!(socket, eventName)
      return false
    }

    // Increment counter
    info.count++
    socketRateLimitStore.set(key, info)
    
    return true
  }

  /**
   * Get reset time for a specific socket and event
   */
  private getResetTime(socket: Socket, eventName: string): number {
    const key = this.options.keyGenerator!(socket, eventName)
    const info = socketRateLimitStore.get(key)
    return info?.resetTime || Date.now()
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    for (const [key, info] of socketRateLimitStore.entries()) {
      if (info.resetTime <= now) {
        socketRateLimitStore.delete(key)
      }
    }
  }

  /**
   * Create middleware function for socket events
   */
  middleware() {
    return (socket: Socket, eventName: string, next: Function) => {
      if (this.isAllowed(socket, eventName)) {
        next()
      }
      // If not allowed, onLimitReached callback handles the response
    }
  }
}

/**
 * Pre-configured rate limiters for different event types
 */
export const socketRateLimiters = {
  // General events (message sending, commenting, etc.)
  general: new SocketRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxEvents: 60, // 60 events per minute
  }),

  // High-frequency events (typing indicators, presence updates)
  highFrequency: new SocketRateLimiter({
    windowMs: 10 * 1000, // 10 seconds
    maxEvents: 20, // 20 events per 10 seconds
  }),

  // Critical events (OKR updates, admin actions)
  critical: new SocketRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxEvents: 10, // 10 events per minute
  }),

  // Broadcast events (announcements, system messages)
  broadcast: new SocketRateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxEvents: 5, // 5 broadcasts per 5 minutes
    keyGenerator: (socket: Socket) => `broadcast:${socket.id}`, // Per socket
  }),

  // File/data operations
  fileOperations: new SocketRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxEvents: 10, // 10 file operations per minute
  }),
}

/**
 * Apply rate limiting to socket event handler
 */
export function withRateLimit(
  rateLimiter: SocketRateLimiter,
  handler: Function
) {
  return function(this: Socket, ...args: any[]) {
    const eventName = args[args.length - 1]?.constructor?.name === 'Function' 
      ? 'unknown' 
      : 'event'
    
    if (rateLimiter.isAllowed(this, eventName)) {
      return handler.apply(this, args)
    }
  }
}