import { Resolver, Query, Mutation, Arg, Ctx, FieldResolver, Root } from 'type-graphql'
import { ForbiddenError } from '@apollo/server'
import {
  User,
  UserConnection,
  CreateUserInput,
  UpdateUserInput,
  ChangePasswordInput,
  UserFilterInput,
  UserSortInput,
} from '../types/user.types'
import { PaginationInput, DeleteResult } from '../types/common.types'
import { GraphQLContext } from '../context'
import { Authenticated } from '../directives/auth.directive'
import { AdminOnly, RequireRole, RequirePermission } from '../directives/role.directive'

@Resolver(() => User)
export class UserResolver {
  @Query(() => UserConnection)
  @RequirePermission(['user:read', 'admin:users'])
  async users(
    @Arg('pagination', { nullable: true }) pagination?: PaginationInput,
    @Arg('filter', { nullable: true }) filter?: UserFilterInput,
    @Arg('sort', { nullable: true }) sort?: UserSortInput,
    @Ctx() { user, dataloaders }: GraphQLContext
  ): Promise<UserConnection> {
    // Simplified implementation for demo
    const mockUsers: User[] = []

    const edges = mockUsers.map((user, index) => ({
      cursor: Buffer.from(`${user.id}:${index}`).toString('base64'),
      node: user,
    }))

    return {
      edges,
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor,
        totalCount: mockUsers.length,
      },
      totalCount: mockUsers.length,
    }
  }

  @Query(() => User, { nullable: true })
  @Authenticated()
  async user(
    @Arg('id') id: string,
    @Ctx() { user, dataloaders }: GraphQLContext
  ): Promise<User | null> {
    // Users can view their own profile, admins can view any profile
    if (user!.id !== id && !user!.isAdmin()) {
      throw new ForbiddenError('Not authorized to view this user')
    }

    const targetUser = await dataloaders.userById.load(id)
    return targetUser ? this.mapUserToGraphQL(targetUser) : null
  }

  @Mutation(() => User)
  @RequirePermission(['user:create', 'admin:users'])
  async createUser(@Arg('input') input: CreateUserInput): Promise<User> {
    throw new Error('User creation not fully implemented yet - use REST API')
  }

  @Mutation(() => User)
  @Authenticated()
  async updateUser(
    @Arg('input') input: UpdateUserInput,
    @Ctx() { user }: GraphQLContext
  ): Promise<User> {
    throw new Error('User update not fully implemented yet - use REST API')
  }

  @Mutation(() => User)
  @Authenticated()
  async changePassword(
    @Arg('input') input: ChangePasswordInput,
    @Ctx() { user }: GraphQLContext
  ): Promise<User> {
    throw new Error('Password change not fully implemented yet - use REST API')
  }

  @Mutation(() => DeleteResult)
  @AdminOnly()
  async deleteUser(@Arg('id') id: string): Promise<DeleteResult> {
    return {
      success: false,
      message: 'User deletion not fully implemented yet - use REST API',
    }
  }

  private mapUserToGraphQL(user: any): User {
    return {
      id: user.id || 'unknown',
      email: user.email || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      fullName: user.fullName || `${user.firstName} ${user.lastName}`,
      legacyRole: user.legacyRole,
      roles: [],
      isActive: user.isActive ?? true,
      emailVerified: user.emailVerified ?? false,
      lastLoginAt: user.lastLoginAt,
      loginAttempts: user.loginAttempts || 0,
      isLocked: user.isLocked ?? false,
      canAttemptLogin: user.canAttemptLogin ?? true,
      createdAt: user.createdAt || new Date(),
      updatedAt: user.updatedAt || new Date(),
      isAdmin: false,
      isModerator: false,
      permissions: [],
    }
  }
}