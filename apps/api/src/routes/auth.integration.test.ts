import request from 'supertest'
import express from 'express'
import session from 'express-session'
import { SessionManager, createDefaultSessionConfig } from '@product-outcomes/api-core'

// Mock the dependencies
jest.mock('@product-outcomes/database')
jest.mock('@product-outcomes/auth')

describe('Auth Routes - Session Integration', () => {
  let app: express.Application
  let sessionManager: SessionManager

  beforeAll(async () => {
    // Create test app with session middleware
    app = express()
    app.use(express.json())

    // Configure test session
    const testConfig = createDefaultSessionConfig()
    testConfig.redis.host = process.env.REDIS_HOST || 'localhost'
    testConfig.redis.port = parseInt(process.env.REDIS_PORT || '6379')
    testConfig.session.secure = false // For testing

    sessionManager = new SessionManager(testConfig)

    // Only initialize if Redis is available (skip in CI without Redis)
    try {
      await sessionManager.initialize()
      app.use(sessionManager.getSessionMiddleware())
    } catch (error) {
      console.warn('⚠️ Redis not available for integration tests, skipping session middleware')
      // Use in-memory session for tests when Redis is not available
      app.use(session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false }
      }))
    }

    // Add test routes
    app.post('/test/login', (req, res) => {
      req.session.userId = 'test-user-123'
      req.session.user = { id: 'test-user-123', email: 'test@example.com' }
      res.json({ message: 'Login successful', sessionId: req.sessionID })
    })

    app.get('/test/profile', (req, res) => {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' })
      }
      res.json({ user: req.session.user, sessionId: req.sessionID })
    })

    app.post('/test/logout', async (req, res) => {
      try {
        if (req.session.userId && sessionManager) {
          await sessionManager.invalidateUserSessions(req.session.userId)
        }
        
        req.session.destroy((err) => {
          if (err) {
            return res.status(500).json({ error: 'Logout failed' })
          }
          res.clearCookie('product-outcomes.sid')
          res.json({ message: 'Logout successful' })
        })
      } catch (error) {
        res.status(500).json({ error: 'Logout failed' })
      }
    })
  })

  afterAll(async () => {
    if (sessionManager) {
      await sessionManager.close()
    }
  })

  describe('Session Management', () => {
    it('should create a session on login', async () => {
      const response = await request(app)
        .post('/test/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(200)

      expect(response.body.message).toBe('Login successful')
      expect(response.body.sessionId).toBeDefined()
      expect(response.headers['set-cookie']).toBeDefined()
    })

    it('should maintain session across requests', async () => {
      const agent = request.agent(app)

      // Login first
      const loginResponse = await agent
        .post('/test/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(200)

      const sessionId = loginResponse.body.sessionId

      // Access protected route with same session
      const profileResponse = await agent
        .get('/test/profile')
        .expect(200)

      expect(profileResponse.body.user.email).toBe('test@example.com')
      expect(profileResponse.body.sessionId).toBe(sessionId)
    })

    it('should reject requests without session', async () => {
      await request(app)
        .get('/test/profile')
        .expect(401)
    })

    it('should destroy session on logout', async () => {
      const agent = request.agent(app)

      // Login first
      await agent
        .post('/test/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(200)

      // Verify session works
      await agent
        .get('/test/profile')
        .expect(200)

      // Logout
      await agent
        .post('/test/logout')
        .expect(200)

      // Verify session is destroyed
      await agent
        .get('/test/profile')
        .expect(401)
    })
  })

  describe('Session Security', () => {
    it('should set secure session cookies in production', () => {
      const prodConfig = createDefaultSessionConfig()
      process.env.NODE_ENV = 'production'
      process.env.SESSION_SECURE = 'true'
      
      const newConfig = createDefaultSessionConfig()
      expect(newConfig.session.secure).toBe(true)
      
      // Reset
      process.env.NODE_ENV = 'test'
      delete process.env.SESSION_SECURE
    })

    it('should use httpOnly cookies', () => {
      const config = createDefaultSessionConfig()
      expect(config.session.httpOnly).toBe(true)
    })

    it('should use strict sameSite policy', () => {
      const config = createDefaultSessionConfig()
      expect(config.session.sameSite).toBe('strict')
    })
  })

  describe('Session Configuration', () => {
    it('should respect environment variables', () => {
      const originalEnv = process.env
      process.env = {
        ...originalEnv,
        SESSION_SECRET: 'custom-test-secret',
        SESSION_MAX_AGE: '3600000',
        REDIS_HOST: 'custom-redis-host',
        REDIS_PORT: '6380',
        CONCURRENT_SESSIONS_ENABLED: 'true',
        MAX_CONCURRENT_SESSIONS: '5',
      }

      const config = createDefaultSessionConfig()

      expect(config.secret).toBe('custom-test-secret')
      expect(config.session.maxAge).toBe(3600000)
      expect(config.redis.host).toBe('custom-redis-host')
      expect(config.redis.port).toBe(6380)
      expect(config.concurrentSessions.enabled).toBe(true)
      expect(config.concurrentSessions.maxSessions).toBe(5)

      process.env = originalEnv
    })

    it('should have reasonable defaults', () => {
      const config = createDefaultSessionConfig()

      expect(config.redis.host).toBe('localhost')
      expect(config.redis.port).toBe(6379)
      expect(config.session.httpOnly).toBe(true)
      expect(config.session.resave).toBe(false)
      expect(config.session.saveUninitialized).toBe(false)
      expect(config.concurrentSessions.maxSessions).toBe(3)
    })
  })
})