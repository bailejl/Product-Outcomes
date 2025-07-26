// Authentication types and interfaces

export interface User {
  id: string
  email: string
  password?: string // Optional for security (excluded in responses)
  firstName: string
  lastName: string
  role: UserRole
  isActive: boolean
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator',
}

export interface JwtPayload {
  userId: string
  email: string
  role: UserRole
  iat?: number
  exp?: number
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface LoginRequest {
  email: string
  password: string
  rememberMe?: boolean
}

export interface RegisterRequest {
  email: string
  password: string
  firstName: string
  lastName: string
}

export interface AuthResponse {
  user: Omit<User, 'password'>
  tokens: AuthTokens
}

export interface PasswordResetRequest {
  email: string
}

export interface PasswordResetConfirm {
  token: string
  newPassword: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

// Express middleware types
import { Request } from 'express'

export interface AuthenticatedRequest extends Request {
  user?: Omit<User, 'password'>
  userId?: string
  userEmail?: string
  userRole?: UserRole
}
