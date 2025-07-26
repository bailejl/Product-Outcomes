import { AuthenticationError } from '@apollo/server'
import { createMethodDecorator } from 'type-graphql'
import { GraphQLContext } from '../context'

export function Authenticated() {
  return createMethodDecorator<GraphQLContext>(async ({ context }, next) => {
    if (!context.user) {
      throw new AuthenticationError('Authentication required')
    }
    return next()
  })
}

export function OptionalAuth() {
  return createMethodDecorator<GraphQLContext>(async ({ context }, next) => {
    // This decorator allows both authenticated and unauthenticated users
    // The resolver can check context.user to determine if user is authenticated
    return next()
  })
}