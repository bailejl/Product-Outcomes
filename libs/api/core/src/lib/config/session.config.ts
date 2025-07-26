import session, { SessionOptions } from 'express-session'
import { createClient, RedisClientType } from 'redis'
import RedisStore from 'connect-redis'

export interface SessionConfig {
  secret: string
  redis: {
    host: string
    port: number
    password?: string
    db?: number
    prefix?: string
  }
  session: {
    name: string
    maxAge: number
    secure: boolean
    httpOnly: boolean
    sameSite: 'strict' | 'lax' | 'none'
    rolling: boolean
    resave: boolean
    saveUninitialized: boolean
  }
  concurrentSessions: {
    enabled: boolean
    maxSessions: number
  }
}

export class SessionManager {
  private redisClient: RedisClientType | null = null
  private store: RedisStore | null = null
  private config: SessionConfig

  constructor(config: SessionConfig) {
    this.config = config
  }

  /**
   * Initialize Redis connection and session store
   */
  async initialize(): Promise<void> {
    try {
      // Create Redis client
      this.redisClient = createClient({
        socket: {
          host: this.config.redis.host,
          port: this.config.redis.port,
        },
        password: this.config.redis.password,
        database: this.config.redis.db || 0,
      })

      // Handle Redis connection events
      this.redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err)
      })

      this.redisClient.on('connect', () => {
        console.log('✅ Redis client connected for sessions')
      })

      this.redisClient.on('ready', () => {
        console.log('🚀 Redis client ready for sessions')
      })

      this.redisClient.on('end', () => {
        console.log('🔌 Redis client disconnected for sessions')
      })

      // Connect to Redis
      await this.redisClient.connect()

      // Create Redis store
      this.store = new RedisStore({
        client: this.redisClient,
        prefix: this.config.redis.prefix || 'sess:',
        ttl: Math.floor(this.config.session.maxAge / 1000), // Convert to seconds
        disableTouch: false,
        disableTTL: false,
        serializer: JSON,
      })

      console.log('✅ Redis session store initialized')
    } catch (error) {
      console.error('❌ Failed to initialize Redis session store:', error)
      throw error
    }
  }

  /**
   * Get Express session middleware
   */
  getSessionMiddleware(): session.RequestHandler {
    if (!this.store) {
      throw new Error('Session store not initialized. Call initialize() first.')
    }

    const sessionOptions: SessionOptions = {
      store: this.store,
      secret: this.config.secret,
      name: this.config.session.name,
      resave: this.config.session.resave,
      saveUninitialized: this.config.session.saveUninitialized,
      rolling: this.config.session.rolling,
      cookie: {
        secure: this.config.session.secure,
        httpOnly: this.config.session.httpOnly,
        maxAge: this.config.session.maxAge,
        sameSite: this.config.session.sameSite,
      },
      genid: () => {
        // Generate a secure random session ID
        const crypto = require('crypto')
        return crypto.randomBytes(32).toString('hex')
      },
    }

    return session(sessionOptions)
  }

  /**
   * Invalidate user session by user ID
   */
  async invalidateUserSessions(userId: string): Promise<void> {
    if (!this.redisClient) {
      throw new Error('Redis client not initialized')
    }

    try {
      const prefix = this.config.redis.prefix || 'sess:'
      const pattern = `${prefix}*`
      
      // Get all session keys
      const keys = await this.redisClient.keys(pattern)
      
      for (const key of keys) {
        try {
          const sessionData = await this.redisClient.get(key)
          if (sessionData) {
            const session = JSON.parse(sessionData)
            // Check if this session belongs to the user
            if (session.userId === userId || session.user?.id === userId) {
              await this.redisClient.del(key)
              console.log(`🗑️ Invalidated session: ${key}`)
            }
          }
        } catch (parseError) {
          console.warn(`⚠️ Could not parse session data for key: ${key}`)
        }
      }
    } catch (error) {
      console.error('❌ Error invalidating user sessions:', error)
      throw error
    }
  }

  /**
   * Get active session count for a user
   */
  async getUserSessionCount(userId: string): Promise<number> {
    if (!this.redisClient) {
      throw new Error('Redis client not initialized')
    }

    try {
      const prefix = this.config.redis.prefix || 'sess:'
      const pattern = `${prefix}*`
      const keys = await this.redisClient.keys(pattern)
      
      let sessionCount = 0
      
      for (const key of keys) {
        try {
          const sessionData = await this.redisClient.get(key)
          if (sessionData) {
            const session = JSON.parse(sessionData)
            if (session.userId === userId || session.user?.id === userId) {
              sessionCount++
            }
          }
        } catch (parseError) {
          // Skip invalid session data
        }
      }
      
      return sessionCount
    } catch (error) {
      console.error('❌ Error getting user session count:', error)
      return 0
    }
  }

  /**
   * Enforce concurrent session limits
   */
  async enforceConcurrentSessionLimit(userId: string): Promise<void> {
    if (!this.config.concurrentSessions.enabled) {
      return
    }

    const sessionCount = await this.getUserSessionCount(userId)
    if (sessionCount >= this.config.concurrentSessions.maxSessions) {
      // Remove oldest sessions to make room for new one
      await this.removeOldestUserSessions(userId, sessionCount - this.config.concurrentSessions.maxSessions + 1)
    }
  }

  /**
   * Remove oldest user sessions
   */
  private async removeOldestUserSessions(userId: string, countToRemove: number): Promise<void> {
    if (!this.redisClient) {
      throw new Error('Redis client not initialized')
    }

    try {
      const prefix = this.config.redis.prefix || 'sess:'
      const pattern = `${prefix}*`
      const keys = await this.redisClient.keys(pattern)
      
      const userSessions: Array<{ key: string; lastAccess: number }> = []
      
      for (const key of keys) {
        try {
          const sessionData = await this.redisClient.get(key)
          if (sessionData) {
            const session = JSON.parse(sessionData)
            if (session.userId === userId || session.user?.id === userId) {
              userSessions.push({
                key,
                lastAccess: session.lastAccess || Date.now(),
              })
            }
          }
        } catch (parseError) {
          // Skip invalid session data
        }
      }
      
      // Sort by last access time (oldest first)
      userSessions.sort((a, b) => a.lastAccess - b.lastAccess)
      
      // Remove oldest sessions
      for (let i = 0; i < countToRemove && i < userSessions.length; i++) {
        await this.redisClient.del(userSessions[i].key)
        console.log(`🗑️ Removed old session: ${userSessions[i].key}`)
      }
    } catch (error) {
      console.error('❌ Error removing oldest user sessions:', error)
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalSessions: number
    activeSessions: number
    expiredSessions: number
  }> {
    if (!this.redisClient) {
      throw new Error('Redis client not initialized')
    }

    try {
      const prefix = this.config.redis.prefix || 'sess:'
      const pattern = `${prefix}*`
      const keys = await this.redisClient.keys(pattern)
      
      let activeSessions = 0
      let expiredSessions = 0
      const now = Date.now()
      
      for (const key of keys) {
        try {
          const sessionData = await this.redisClient.get(key)
          if (sessionData) {
            const session = JSON.parse(sessionData)
            const maxAge = this.config.session.maxAge
            const lastAccess = session.lastAccess || session.createdAt || now
            
            if (now - lastAccess > maxAge) {
              expiredSessions++
            } else {
              activeSessions++
            }
          }
        } catch (parseError) {
          expiredSessions++
        }
      }
      
      return {
        totalSessions: keys.length,
        activeSessions,
        expiredSessions,
      }
    } catch (error) {
      console.error('❌ Error getting session stats:', error)
      return {
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0,
      }
    }
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    if (!this.redisClient) {
      throw new Error('Redis client not initialized')
    }

    try {
      const prefix = this.config.redis.prefix || 'sess:'
      const pattern = `${prefix}*`
      const keys = await this.redisClient.keys(pattern)
      
      let cleanedCount = 0
      const now = Date.now()
      
      for (const key of keys) {
        try {
          const sessionData = await this.redisClient.get(key)
          if (sessionData) {
            const session = JSON.parse(sessionData)
            const maxAge = this.config.session.maxAge
            const lastAccess = session.lastAccess || session.createdAt || now
            
            if (now - lastAccess > maxAge) {
              await this.redisClient.del(key)
              cleanedCount++
            }
          }
        } catch (parseError) {
          // Remove invalid session data
          await this.redisClient.del(key)
          cleanedCount++
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`)
      }
      
      return cleanedCount
    } catch (error) {
      console.error('❌ Error cleaning expired sessions:', error)
      return 0
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit()
      this.redisClient = null
      this.store = null
      console.log('🔌 Redis session manager closed')
    }
  }
}

/**
 * Create default session configuration
 */
export function createDefaultSessionConfig(): SessionConfig {
  return {
    secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-me-in-production',
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_SESSION_DB || '0'),
      prefix: process.env.REDIS_SESSION_PREFIX || 'sess:',
    },
    session: {
      name: process.env.SESSION_NAME || 'product-outcomes.sid',
      maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000'), // 24 hours
      secure: process.env.NODE_ENV === 'production' && process.env.SESSION_SECURE === 'true',
      httpOnly: true,
      sameSite: (process.env.SESSION_SAME_SITE as 'strict' | 'lax' | 'none') || 'strict',
      rolling: process.env.SESSION_ROLLING === 'true',
      resave: false,
      saveUninitialized: false,
    },
    concurrentSessions: {
      enabled: process.env.CONCURRENT_SESSIONS_ENABLED === 'true',
      maxSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '3'),
    },
  }
}