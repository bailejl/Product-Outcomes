import { Resolver, Mutation, Arg, Ctx, Query } from 'type-graphql'
import { AuthenticationError } from '@apollo/server'
import {
  LoginInput,
  LoginResponse,
  RegisterInput,
  LogoutResponse,
  ForgotPasswordInput,
  ResetPasswordInput,
  PasswordResetResponse,
  RefreshTokenResponse,
} from '../types/auth.types'
import { User as GraphQLUser } from '../types/user.types'
import { GraphQLContext } from '../context'
import { Authenticated } from '../directives/auth.directive'

@Resolver()
export class AuthResolver {
  @Query(() => GraphQLUser, { nullable: true })
  async currentUser(@Ctx() { user }: GraphQLContext): Promise<GraphQLUser | null> {
    if (!user) {
      return null
    }

    return this.mapUserToGraphQL(user)
  }

  @Mutation(() => LoginResponse)
  async login(
    @Arg('input') input: LoginInput,
    @Ctx() { req, res }: GraphQLContext
  ): Promise<LoginResponse> {
    // Simplified implementation for demo
    return {
      success: false,
      message: 'GraphQL authentication not fully implemented yet - use REST API',
    }
  }

  @Mutation(() => LoginResponse)
  async register(@Arg('input') input: RegisterInput): Promise<LoginResponse> {
    // Simplified implementation for demo
    return {
      success: false,
      message: 'GraphQL registration not fully implemented yet - use REST API',
    }
  }

  @Mutation(() => LogoutResponse)
  @Authenticated()
  async logout(@Ctx() { req, res }: GraphQLContext): Promise<LogoutResponse> {
    try {
      // Destroy session
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            console.error('Session destruction error:', err)
          }
        })
      }

      return {
        success: true,
        message: 'Logged out successfully',
      }
    } catch (error) {
      console.error('Logout error:', error)
      return {
        success: false,
        message: 'Logout failed',
      }
    }
  }

  @Mutation(() => PasswordResetResponse)
  async forgotPassword(@Arg('input') input: ForgotPasswordInput): Promise<PasswordResetResponse> {
    return {
      success: true,
      message: 'Password reset not fully implemented yet - use REST API',
    }
  }

  @Mutation(() => PasswordResetResponse)
  async resetPassword(@Arg('input') input: ResetPasswordInput): Promise<PasswordResetResponse> {
    return {
      success: false,
      message: 'Password reset not fully implemented yet - use REST API',
    }
  }

  @Mutation(() => RefreshTokenResponse)
  async refreshToken(
    @Arg('refreshToken') refreshToken: string
  ): Promise<RefreshTokenResponse> {
    return {
      success: false,
      message: 'Token refresh not fully implemented yet - use REST API',
    }
  }

  private mapUserToGraphQL(user: any): GraphQLUser {
    return {
      id: user.id || 'unknown',
      email: user.email || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      fullName: user.fullName || `${user.firstName} ${user.lastName}`,
      legacyRole: user.legacyRole,
      roles: (user.roles || []).map((role: any) => ({
        id: role.id || 'unknown',
        name: role.name || '',
        description: role.description,
        isActive: role.isActive ?? true,
        permissions: role.permissions || [],
        createdAt: role.createdAt || new Date(),
        updatedAt: role.updatedAt || new Date(),
      })),
      isActive: user.isActive ?? true,
      emailVerified: user.emailVerified ?? false,
      lastLoginAt: user.lastLoginAt,
      loginAttempts: user.loginAttempts || 0,
      isLocked: user.isLocked ?? false,
      canAttemptLogin: user.canAttemptLogin ?? true,
      createdAt: user.createdAt || new Date(),
      updatedAt: user.updatedAt || new Date(),
      isAdmin: typeof user.isAdmin === 'function' ? user.isAdmin() : false,
      isModerator: typeof user.isModerator === 'function' ? user.isModerator() : false,
      permissions: typeof user.getAllPermissions === 'function' ? user.getAllPermissions() : [],
    }
  }
}