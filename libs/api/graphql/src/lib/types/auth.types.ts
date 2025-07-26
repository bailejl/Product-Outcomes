import { Field, ObjectType, InputType } from 'type-graphql'
import { User } from './user.types'

@ObjectType()
export class AuthResponse {
  @Field(() => User)
  user: User

  @Field()
  token: string

  @Field()
  refreshToken: string

  @Field()
  expiresAt: Date
}

@ObjectType()
export class LoginResponse {
  @Field()
  success: boolean

  @Field({ nullable: true })
  message?: string

  @Field(() => AuthResponse, { nullable: true })
  auth?: AuthResponse
}

@ObjectType()
export class LogoutResponse {
  @Field()
  success: boolean

  @Field({ nullable: true })
  message?: string
}

@ObjectType()
export class RefreshTokenResponse {
  @Field()
  success: boolean

  @Field({ nullable: true })
  token?: string

  @Field({ nullable: true })
  expiresAt?: Date

  @Field({ nullable: true })
  message?: string
}

@InputType()
export class LoginInput {
  @Field()
  email: string

  @Field()
  password: string

  @Field({ nullable: true })
  rememberMe?: boolean
}

@InputType()
export class RegisterInput {
  @Field()
  email: string

  @Field()
  password: string

  @Field()
  firstName: string

  @Field()
  lastName: string
}

@InputType()
export class ForgotPasswordInput {
  @Field()
  email: string
}

@InputType()
export class ResetPasswordInput {
  @Field()
  token: string

  @Field()
  newPassword: string
}

@ObjectType()
export class PasswordResetResponse {
  @Field()
  success: boolean

  @Field({ nullable: true })
  message?: string
}

@ObjectType()
export class EmailVerificationResponse {
  @Field()
  success: boolean

  @Field({ nullable: true })
  message?: string
}