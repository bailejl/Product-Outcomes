import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { useServer } from 'graphql-ws/lib/use/ws'
import { makeExecutableSchema } from '@graphql-tools/schema'
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import depthLimit from 'graphql-depth-limit'
import costAnalysis from 'graphql-cost-analysis'

import { typeDefs } from './schema'
import { resolvers } from './resolvers'
import { subscriptionResolvers } from './resolvers/subscription.resolvers'
import { pubsub, cleanupPubSub } from './pubsub'
import { AppDataSource } from '@product-outcomes/database'
import {
  validationRules,
  graphqlSecurityMonitor,
  requireAuth,
  requireRole,
  requirePermission,
  complexityAnalysisRule,
  depthLimitRule
} from '../middleware/graphqlSecurity'

// Merge all resolvers
const allResolvers = {
  ...resolvers,
  ...subscriptionResolvers,
}

// Create executable schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers: allResolvers,
})

// GraphQL context type
export interface GraphQLContext {
  user?: any
  req: express.Request
  res: express.Response
  dataSources?: any
}

// Authentication for WebSocket connections
const getUser = async (token: string) => {
  try {
    if (!token) return null
    
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace('Bearer ', '')
    
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET || 'your-secret-key') as any
    
    // Fetch user from database
    const userRepository = AppDataSource.getRepository('User')
    const user = await userRepository.findOne({
      where: { id: decoded.userId },
      relations: ['roles'],
    })
    
    return user
  } catch (error) {
    console.error('Authentication error:', error)
    return null
  }
}

// WebSocket authentication
const wsAuthHandler = async (ctx: any) => {
  const { connectionParams } = ctx
  const token = connectionParams?.authorization || connectionParams?.Authorization
  
  if (token) {
    const user = await getUser(token)
    return { user }
  }
  
  return {}
}

// Rate limiting for subscriptions
const subscriptionRateLimit = new Map<string, { count: number; resetTime: number }>()

const checkSubscriptionRateLimit = (userId: string, maxSubscriptions = 50) => {
  const now = Date.now()
  const resetInterval = 60000 // 1 minute
  
  const userLimit = subscriptionRateLimit.get(userId)
  
  if (!userLimit || now > userLimit.resetTime) {
    subscriptionRateLimit.set(userId, {
      count: 1,
      resetTime: now + resetInterval,
    })
    return true
  }
  
  if (userLimit.count >= maxSubscriptions) {
    return false
  }
  
  userLimit.count++
  return true
}

// Setup GraphQL server with subscriptions
export const setupGraphQLServer = async (app: express.Application) => {
  // Create HTTP server
  const httpServer = createServer(app)
  
  // Create WebSocket server
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  })
  
  // Setup GraphQL WebSocket server
  const serverCleanup = useServer(
    {
      schema,
      context: async (ctx) => {
        const authContext = await wsAuthHandler(ctx)
        
        // Rate limiting for subscriptions
        if (authContext.user) {
          const canSubscribe = checkSubscriptionRateLimit(authContext.user.id)
          if (!canSubscribe) {
            throw new Error('Subscription rate limit exceeded')
          }
        }
        
        return authContext
      },
      onConnect: async (ctx) => {
        console.log('🔌 WebSocket client connected')
        const authContext = await wsAuthHandler(ctx)
        
        if (authContext.user) {
          console.log(`👤 Authenticated user: ${authContext.user.email}`)
        }
        
        return true
      },
      onDisconnect: () => {
        console.log('🔌 WebSocket client disconnected')
      },
      onSubscribe: async (ctx, msg) => {
        const authContext = await wsAuthHandler(ctx)
        
        // Log subscription activity
        console.log(`📡 New subscription: ${msg.payload.operationName || 'anonymous'}`)
        
        if (authContext.user) {
          console.log(`👤 Subscriber: ${authContext.user.email}`)
        }
      },
      onError: (ctx, msg, errors) => {
        console.error('❌ WebSocket subscription error:', errors)
      },
    },
    wsServer
  )
  
  // Create Apollo Server
  const server = new ApolloServer<GraphQLContext>({
    schema,
    plugins: [
      // Proper shutdown for the HTTP server
      ApolloServerPluginDrainHttpServer({ httpServer }),
      
      // Proper shutdown for the WebSocket server
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose()
            },
          }
        },
      },
      
      // Enhanced security and monitoring
      {
        requestDidStart() {
          return {
            didResolveOperation({ request, document, context }) {
              graphqlSecurityMonitor.onQueryStart(context, request.query || '')
            },
            didEncounterErrors({ errors, context }) {
              graphqlSecurityMonitor.onQueryEnd(context, { errors })
            },
            willSendResponse({ response, context }) {
              if (!response.errors) {
                graphqlSecurityMonitor.onQueryEnd(context, { data: response.data })
              }
            }
          }
        },
      },
    ],
    validationRules: validationRules,
    formatError: (error) => {
      console.error('❌ GraphQL Error:', error)
      
      // Don't expose internal errors in production
      if (process.env.NODE_ENV === 'production') {
        if (error.message.startsWith('Database') || 
            error.message.startsWith('Redis') ||
            error.message.includes('ECONNREFUSED')) {
          return new Error('Internal server error')
        }
      }
      
      return error
    },
  })
  
  // Start Apollo Server
  await server.start()
  
  // Setup CORS for GraphQL endpoint
  const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    credentials: true,
  }
  
  // Enhanced GraphQL rate limiting with user-based limits
  const graphqlRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req: any) => {
      // Higher limits for authenticated users
      const user = req.session?.user || req.user
      return user ? 1000 : 100 // 1000 for auth users, 100 for anonymous
    },
    message: {
      error: 'GraphQL rate limit exceeded',
      message: 'Too many GraphQL requests, please try again later',
      retryAfter: 900 // 15 minutes
    },
    keyGenerator: (req: any) => {
      const user = req.session?.user || req.user
      return user ? `graphql:user:${user.id}` : `graphql:ip:${req.ip}`
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
  })
  
  // Apply GraphQL middleware
  app.use(
    '/graphql',
    cors(corsOptions),
    graphqlRateLimit,
    express.json({ limit: '10mb' }), // Increase limit for file uploads
    expressMiddleware(server, {
      context: async ({ req, res }): Promise<GraphQLContext> => {
        // Get user from session or JWT token
        let user = null
        
        // Try session first
        if (req.session?.user) {
          user = req.session.user
        } else {
          // Try JWT token
          const token = req.headers.authorization
          if (token) {
            user = await getUser(token)
          }
        }
        
        return {
          user,
          req,
          res,
        }
      },
    })
  )
  
  console.log('🚀 GraphQL server setup complete')
  console.log(`📡 GraphQL endpoint: http://localhost:${process.env.API_PORT || 3333}/graphql`)
  console.log(`🔌 WebSocket subscriptions: ws://localhost:${process.env.API_PORT || 3333}/graphql`)
  
  return { server, httpServer, wsServer, serverCleanup }
}

// Graceful shutdown handler
export const shutdownGraphQLServer = async (serverCleanup: any) => {
  try {
    console.log('🔄 Shutting down GraphQL server...')
    
    // Close WebSocket server
    await serverCleanup.dispose()
    
    // Close PubSub connections
    await cleanupPubSub()
    
    console.log('✅ GraphQL server shutdown complete')
  } catch (error) {
    console.error('❌ Error during GraphQL server shutdown:', error)
  }
}

// Performance monitoring
export const setupGraphQLMonitoring = () => {
  // Track subscription counts
  let activeSubscriptions = 0
  
  const originalAsyncIterator = pubsub.asyncIterator
  pubsub.asyncIterator = function(triggers: string | string[]) {
    const iterator = originalAsyncIterator.call(this, triggers)
    
    // Wrap the iterator to count active subscriptions
    const wrappedIterator = {
      [Symbol.asyncIterator]: () => {
        const innerIterator = iterator[Symbol.asyncIterator]()
        activeSubscriptions++
        
        return {
          async next() {
            return innerIterator.next()
          },
          async return() {
            activeSubscriptions--
            return innerIterator.return?.() || { done: true }
          },
          async throw(error: any) {
            activeSubscriptions--
            return innerIterator.throw?.(error) || { done: true }
          },
        }
      },
    }
    
    return wrappedIterator
  }
  
  // Log subscription metrics every minute
  setInterval(() => {
    console.log(`📊 Active subscriptions: ${activeSubscriptions}`)
    console.log(`📊 Rate limit cache size: ${subscriptionRateLimit.size}`)
  }, 60000)
  
  // Cleanup rate limit cache every 5 minutes
  setInterval(() => {
    const now = Date.now()
    for (const [userId, limit] of subscriptionRateLimit.entries()) {
      if (now > limit.resetTime) {
        subscriptionRateLimit.delete(userId)
      }
    }
  }, 300000)
}