import { Express } from 'express'
import { Server } from 'http'
import { GraphQLServerManager } from '@product-outcomes/api-graphql'

export async function integrateGraphQL(app: Express, httpServer?: Server): Promise<void> {
  console.log('🔄 Setting up GraphQL server...')

  // Initialize GraphQL server
  const graphqlServer = new GraphQLServerManager({
    introspection: process.env.NODE_ENV !== 'production',
    playground: process.env.NODE_ENV !== 'production',
    httpServer,
  })

  await graphqlServer.initialize()

  // Add GraphQL middleware
  app.use('/graphql', 
    graphqlServer.getCorsMiddleware(),
    graphqlServer.getJsonMiddleware(),
    graphqlServer.getMiddleware()
  )

  console.log('✅ GraphQL server integrated at /graphql')
  
  if (process.env.NODE_ENV !== 'production') {
    const port = process.env.API_PORT || 3333
    console.log(`🎮 GraphQL Playground: http://localhost:${port}/graphql`)
  }

  return Promise.resolve()
}