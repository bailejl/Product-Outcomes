import { Socket } from 'socket.io'
import { AuthService } from '@product-outcomes/auth'
import { UserRepository } from '@product-outcomes/database'
import { sessionManager } from '../main'

export interface AuthenticatedSocket extends Socket {
  userId: string
  user: any
}

export class SocketAuthMiddleware {
  private authService: AuthService
  private userRepository: UserRepository

  constructor() {
    this.authService = new AuthService()
    this.userRepository = new UserRepository()
  }

  /**
   * Authenticate socket connection using JWT token or session
   */
  async authenticate(socket: Socket, next: (err?: Error) => void) {
    try {
      // Try to authenticate via Authorization header (JWT)
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization

      if (token) {
        const cleanToken = token.replace('Bearer ', '')
        const decoded = await this.authService.jwt.verifyToken(cleanToken)
        
        if (decoded && decoded.userId) {
          const user = await this.userRepository.findById(decoded.userId)
          if (user && user.isActive) {
            ;(socket as AuthenticatedSocket).userId = user.id
            ;(socket as AuthenticatedSocket).user = user
            return next()
          }
        }
      }

      // Try to authenticate via session cookie
      const sessionId = this.extractSessionId(socket)
      if (sessionId) {
        const sessionData = await sessionManager.getSession(sessionId)
        if (sessionData && sessionData.userId) {
          const user = await this.userRepository.findById(sessionData.userId)
          if (user && user.isActive) {
            ;(socket as AuthenticatedSocket).userId = user.id
            ;(socket as AuthenticatedSocket).user = user
            return next()
          }
        }
      }

      throw new Error('Authentication failed')
    } catch (error) {
      console.error('Socket authentication error:', error)
      next(new Error('Authentication failed'))
    }
  }

  /**
   * Extract session ID from socket cookies
   */
  private extractSessionId(socket: Socket): string | null {
    const cookies = socket.handshake.headers.cookie
    if (!cookies) return null

    const sessionCookie = cookies
      .split(';')
      .find(cookie => cookie.trim().startsWith('product-outcomes.sid='))

    if (!sessionCookie) return null

    // Extract session ID (remove cookie name and decode)
    const sessionId = sessionCookie.split('=')[1]
    return sessionId ? decodeURIComponent(sessionId) : null
  }

  /**
   * Middleware to check if user has required role/permission
   */
  requireRole(roles: string[]) {
    return (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
      try {
        const user = socket.user
        if (!user) {
          return next(new Error('User not found'))
        }

        const hasRole = roles.some(role => user.hasRole(role))
        if (!hasRole) {
          return next(new Error('Insufficient permissions'))
        }

        next()
      } catch (error) {
        next(new Error('Permission check failed'))
      }
    }
  }

  /**
   * Middleware to check if user has required permission
   */
  requirePermission(permissions: string[]) {
    return (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
      try {
        const user = socket.user
        if (!user) {
          return next(new Error('User not found'))
        }

        const hasPermission = permissions.some(permission => user.hasPermission(permission))
        if (!hasPermission) {
          return next(new Error('Insufficient permissions'))
        }

        next()
      } catch (error) {
        next(new Error('Permission check failed'))
      }
    }
  }
}