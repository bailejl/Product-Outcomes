import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default'
import { json } from 'express'
import cors from 'cors'
import { Server } from 'http'
import { GraphQLSchema } from 'graphql'
import { buildSchema } from './schema'
import { createGraphQLContext, GraphQLContext } from './context'

export interface GraphQLServerConfig {
  introspection?: boolean
  playground?: boolean
  cors?: cors.CorsOptions
  httpServer?: Server
}

export class GraphQLServerManager {
  private apolloServer: ApolloServer<GraphQLContext> | null = null
  private schema: GraphQLSchema | null = null

  constructor(private config: GraphQLServerConfig = {}) {}

  async initialize(): Promise<void> {
    console.log('🔄 Initializing GraphQL schema...')
    this.schema = await buildSchema()

    console.log('🔄 Creating Apollo Server...')
    this.apolloServer = new ApolloServer<GraphQLContext>({
      schema: this.schema,
      introspection: this.config.introspection ?? true,
      plugins: [
        // Proper shutdown for HTTP server
        ...(this.config.httpServer ? [ApolloServerPluginDrainHttpServer({ httpServer: this.config.httpServer })] : []),
        
        // Landing page for local development
        ApolloServerPluginLandingPageLocalDefault({ 
          embed: true,
          footer: false 
        }),
      ],
      formatError: (error) => {
        console.error('GraphQL Error:', error)
        
        // Don't expose internal errors in production
        if (process.env.NODE_ENV === 'production') {
          return new Error('Internal server error')
        }
        
        return error
      },
    })

    await this.apolloServer.start()
    console.log('✅ Apollo Server initialized')
  }

  getMiddleware() {
    if (!this.apolloServer) {
      throw new Error('Apollo Server not initialized. Call initialize() first.')
    }

    return expressMiddleware(this.apolloServer, {
      context: createGraphQLContext,
    })
  }

  getCorsMiddleware() {
    const defaultCorsOptions: cors.CorsOptions = {
      origin: process.env.FRONTEND_URL || 'http://localhost:4200',
      credentials: true,
    }

    return cors(this.config.cors || defaultCorsOptions)
  }

  getJsonMiddleware() {
    return json()
  }

  async stop(): Promise<void> {
    if (this.apolloServer) {
      await this.apolloServer.stop()
      console.log('🛑 Apollo Server stopped')
    }
  }

  getSchema(): GraphQLSchema | null {
    return this.schema
  }

  getServer(): ApolloServer<GraphQLContext> | null {
    return this.apolloServer
  }
}

// Export a default instance
export const graphqlServer = new GraphQLServerManager()