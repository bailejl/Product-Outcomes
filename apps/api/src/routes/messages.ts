// Messages router using functional programming patterns
import express from 'express'
import { pool } from '../db/connection'

// Type definitions
interface HelloWorldResponse {
  message: string
}

interface ErrorResponse {
  error: string
}

// Factory function for creating messages router
export const createMessagesRouter = () => {
  const router = express.Router()

  // Arrow function for getting hello world message
  const getHelloWorldMessage = async (
    req: express.Request,
    res: express.Response<HelloWorldResponse | ErrorResponse>
  ): Promise<void> => {
    try {
      // Try database first, fallback to mock data for demo
      try {
        const result = await pool.query(
          'SELECT content FROM messages WHERE key = $1',
          ['hello_world']
        )

        if (result.rows.length > 0) {
          res.json({ message: result.rows[0].content })
          return
        }
      } catch (dbError) {
        console.warn(
          'Database not available, using mock data:',
          dbError.message
        )
      }

      // Fallback to mock data for demo purposes
      const mockMessage = 'Hello World from the Database!'
      res.json({ message: mockMessage })
    } catch (error) {
      console.error('Error fetching hello world message:', error)
      res.status(500).json({ error: 'Failed to retrieve message' })
    }
  }

  // Route registration
  router.get('/hello-world', getHelloWorldMessage)

  return router
}

// Export factory function
export default createMessagesRouter
