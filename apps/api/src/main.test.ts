import express from 'express'
import request from 'supertest'

// Mock the database module
jest.mock('./database', () => ({
  query: jest.fn(),
}))

describe('API Server', () => {
  let app: express.Application

  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express()
    app.use(express.json())

    // Basic health check endpoint
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() })
    })

    // Messages endpoint
    app.get('/api/messages/:name', (req, res) => {
      const { name } = req.params
      if (name === 'hello-world') {
        res.json({ message: 'Hello World!' })
      } else {
        res.json({ message: `Hello ${name}!` })
      }
    })
  })

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/api/health')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('status', 'ok')
      expect(response.body).toHaveProperty('timestamp')
    })
  })

  describe('GET /api/messages/:name', () => {
    it('should return Hello World for hello-world', async () => {
      const response = await request(app).get('/api/messages/hello-world')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ message: 'Hello World!' })
    })

    it('should return personalized message for other names', async () => {
      const response = await request(app).get('/api/messages/John')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ message: 'Hello John!' })
    })
  })
})
