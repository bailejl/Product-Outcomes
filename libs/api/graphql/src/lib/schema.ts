import { buildSchema as buildTypeGraphQLSchema } from 'type-graphql'
import { GraphQLSchema } from 'graphql'
import { Container } from 'typedi'

// Import all resolvers
import { AuthResolver } from './resolvers/auth.resolver'
import { UserResolver } from './resolvers/user.resolver'
import { OrganizationResolver } from './resolvers/organization.resolver'
import { OKRResolver } from './resolvers/okr.resolver'

export async function buildSchema(): Promise<GraphQLSchema> {
  try {
    console.log('🔄 Building GraphQL schema...')
    
    const schema = await buildTypeGraphQLSchema({
      resolvers: [
        AuthResolver,
        UserResolver,
        OrganizationResolver,
        OKRResolver,
      ],
      container: Container,
      // Enable GraphQL subscriptions if needed
      // pubSub: new PubSub(),
      
      // Validation options
      validate: {
        forbidUnknownValues: false,
      },
      
      // Date scalar configuration
      dateScalarMode: 'isoDate',
      
      // Error handling
      emitSchemaFile: process.env.NODE_ENV === 'development' ? {
        path: './schema.graphql',
        commentDescriptions: true,
      } : false,
    })

    console.log('✅ GraphQL schema built successfully')
    return schema
  } catch (error) {
    console.error('❌ Failed to build GraphQL schema:', error)
    throw error
  }
}