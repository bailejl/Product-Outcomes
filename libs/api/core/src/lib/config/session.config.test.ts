import { SessionManager, createDefaultSessionConfig, SessionConfig } from './session.config'
import { createClient } from 'redis'

// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
    keys: jest.fn(() => []),
    get: jest.fn(),
    del: jest.fn(),
  })),
}))

// Mock connect-redis
jest.mock('connect-redis', () => {
  return jest.fn().mockImplementation(() => ({
    // Mock store implementation
  }))
})

describe('SessionManager', () => {
  let sessionManager: SessionManager
  let mockRedisClient: any
  let testConfig: SessionConfig

  beforeEach(() => {
    testConfig = {
      secret: 'test-secret',
      redis: {
        host: 'localhost',
        port: 6379,
        prefix: 'test:sess:',
      },
      session: {
        name: 'test.sid',
        maxAge: 3600000, // 1 hour
        secure: false,
        httpOnly: true,
        sameSite: 'strict',
        rolling: true,
        resave: false,
        saveUninitialized: false,
      },
      concurrentSessions: {
        enabled: true,
        maxSessions: 3,
      },
    }

    mockRedisClient = {
      connect: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
      keys: jest.fn(() => []),
      get: jest.fn(),
      del: jest.fn(),
    }

    // Reset the mock
    ;(createClient as jest.Mock).mockReturnValue(mockRedisClient)

    sessionManager = new SessionManager(testConfig)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('initialization', () => {
    it('should create a SessionManager instance', () => {
      expect(sessionManager).toBeInstanceOf(SessionManager)
    })

    it('should initialize Redis connection', async () => {
      await sessionManager.initialize()

      expect(createClient).toHaveBeenCalledWith({
        socket: {
          host: 'localhost',
          port: 6379,
        },
        password: undefined,
        database: 0,
      })
      expect(mockRedisClient.connect).toHaveBeenCalled()
    })

    it('should throw error if Redis connection fails', async () => {
      mockRedisClient.connect.mockRejectedValue(new Error('Connection failed'))

      await expect(sessionManager.initialize()).rejects.toThrow('Connection failed')
    })
  })

  describe('session invalidation', () => {
    beforeEach(async () => {
      await sessionManager.initialize()
    })

    it('should invalidate user sessions', async () => {
      const mockSessions = [
        'test:sess:session1',
        'test:sess:session2',
        'test:sess:session3',
      ]

      mockRedisClient.keys.mockResolvedValue(mockSessions)
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user1' }))
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user2' }))
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user1' }))

      await sessionManager.invalidateUserSessions('user1')

      expect(mockRedisClient.del).toHaveBeenCalledTimes(2)
      expect(mockRedisClient.del).toHaveBeenCalledWith('test:sess:session1')
      expect(mockRedisClient.del).toHaveBeenCalledWith('test:sess:session3')
    })

    it('should handle Redis client not initialized', async () => {
      const uninitializedManager = new SessionManager(testConfig)
      
      await expect(
        uninitializedManager.invalidateUserSessions('user1')
      ).rejects.toThrow('Redis client not initialized')
    })
  })

  describe('session count', () => {
    beforeEach(async () => {
      await sessionManager.initialize()
    })

    it('should return correct user session count', async () => {
      const mockSessions = [
        'test:sess:session1',
        'test:sess:session2',
        'test:sess:session3',
      ]

      mockRedisClient.keys.mockResolvedValue(mockSessions)
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user1' }))
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user2' }))
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user1' }))

      const count = await sessionManager.getUserSessionCount('user1')

      expect(count).toBe(2)
    })

    it('should return 0 for user with no sessions', async () => {
      mockRedisClient.keys.mockResolvedValue([])

      const count = await sessionManager.getUserSessionCount('user1')

      expect(count).toBe(0)
    })
  })

  describe('concurrent session limits', () => {
    beforeEach(async () => {
      await sessionManager.initialize()
    })

    it('should not enforce limits when disabled', async () => {
      const configWithDisabledLimits = {
        ...testConfig,
        concurrentSessions: { enabled: false, maxSessions: 3 },
      }
      const managerWithDisabledLimits = new SessionManager(configWithDisabledLimits)
      await managerWithDisabledLimits.initialize()

      // Should not call any Redis operations
      await managerWithDisabledLimits.enforceConcurrentSessionLimit('user1')
      
      expect(mockRedisClient.keys).not.toHaveBeenCalled()
    })

    it('should remove oldest sessions when limit exceeded', async () => {
      const mockSessions = [
        'test:sess:session1',
        'test:sess:session2',
        'test:sess:session3',
        'test:sess:session4',
      ]

      mockRedisClient.keys.mockResolvedValue(mockSessions)
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user1', lastAccess: 1000 }))
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user1', lastAccess: 2000 }))
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user1', lastAccess: 3000 }))
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user1', lastAccess: 4000 }))

      await sessionManager.enforceConcurrentSessionLimit('user1')

      // Should remove the oldest session (session1 with lastAccess: 1000)
      expect(mockRedisClient.del).toHaveBeenCalledWith('test:sess:session1')
      expect(mockRedisClient.del).toHaveBeenCalledTimes(2) // Remove 2 oldest sessions
    })
  })

  describe('session statistics', () => {
    beforeEach(async () => {
      await sessionManager.initialize()
    })

    it('should return session statistics', async () => {
      const mockSessions = ['test:sess:session1', 'test:sess:session2']
      const now = Date.now()

      mockRedisClient.keys.mockResolvedValue(mockSessions)
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify({ lastAccess: now - 1000 })) // Active
        .mockResolvedValueOnce(JSON.stringify({ lastAccess: now - 7200000 })) // Expired

      const stats = await sessionManager.getSessionStats()

      expect(stats).toEqual({
        totalSessions: 2,
        activeSessions: 1,
        expiredSessions: 1,
      })
    })
  })

  describe('cleanup', () => {
    beforeEach(async () => {
      await sessionManager.initialize()
    })

    it('should cleanup expired sessions', async () => {
      const mockSessions = ['test:sess:session1', 'test:sess:session2']
      const now = Date.now()

      mockRedisClient.keys.mockResolvedValue(mockSessions)
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify({ lastAccess: now - 7200000 })) // Expired
        .mockResolvedValueOnce(JSON.stringify({ lastAccess: now - 1000 })) // Active

      const cleanedCount = await sessionManager.cleanupExpiredSessions()

      expect(cleanedCount).toBe(1)
      expect(mockRedisClient.del).toHaveBeenCalledWith('test:sess:session1')
    })
  })

  describe('configuration', () => {
    it('should create default configuration', () => {
      const config = createDefaultSessionConfig()

      expect(config).toHaveProperty('secret')
      expect(config).toHaveProperty('redis')
      expect(config).toHaveProperty('session')
      expect(config).toHaveProperty('concurrentSessions')
      expect(config.redis.host).toBe('localhost')
      expect(config.redis.port).toBe(6379)
      expect(config.session.httpOnly).toBe(true)
    })

    it('should use environment variables when available', () => {
      const originalEnv = process.env
      process.env = {
        ...originalEnv,
        SESSION_SECRET: 'custom-secret',
        REDIS_HOST: 'redis-server',
        REDIS_PORT: '6380',
        SESSION_MAX_AGE: '7200000',
        CONCURRENT_SESSIONS_ENABLED: 'true',
        MAX_CONCURRENT_SESSIONS: '5',
      }

      const config = createDefaultSessionConfig()

      expect(config.secret).toBe('custom-secret')
      expect(config.redis.host).toBe('redis-server')
      expect(config.redis.port).toBe(6380)
      expect(config.session.maxAge).toBe(7200000)
      expect(config.concurrentSessions.enabled).toBe(true)
      expect(config.concurrentSessions.maxSessions).toBe(5)

      process.env = originalEnv
    })
  })

  describe('close', () => {
    it('should close Redis connection', async () => {
      await sessionManager.initialize()
      await sessionManager.close()

      expect(mockRedisClient.quit).toHaveBeenCalled()
    })

    it('should handle close when not initialized', async () => {
      await sessionManager.close()
      
      expect(mockRedisClient.quit).not.toHaveBeenCalled()
    })
  })
})