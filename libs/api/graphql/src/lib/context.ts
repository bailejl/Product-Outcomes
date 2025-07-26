import { Request, Response } from 'express'
import { DataLoaders } from './dataloaders'

// Simplified User interface for GraphQL context
interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  isActive: boolean
  isAdmin?: () => boolean
  isModerator?: () => boolean
}

export interface GraphQLContext {
  req: Request
  res: Response
  user?: User
  dataloaders: DataLoaders
}

export async function createGraphQLContext({ req, res }: { req: Request; res: Response }): Promise<GraphQLContext> {
  // Extract user from session or JWT
  const user = (req as any).session?.user || (req as any).user

  // Create DataLoaders for this request
  const dataloaders = new DataLoaders()

  return {
    req,
    res,
    user,
    dataloaders,
  }
}