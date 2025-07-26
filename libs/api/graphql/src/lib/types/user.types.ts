import { Field, ObjectType, InputType, ID, registerEnumType } from 'type-graphql'
import { PaginationInfo, PaginationInput, FilterInput, SortInput } from './common.types'

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator',
}

registerEnumType(UserRole, {
  name: 'UserRole',
  description: 'User roles in the system',
})

@ObjectType()
export class User {
  @Field(() => ID)
  id: string

  @Field()
  email: string

  @Field()
  firstName: string

  @Field()
  lastName: string

  @Field()
  fullName: string

  @Field(() => UserRole, { nullable: true })
  legacyRole?: UserRole

  @Field(() => [Role])
  roles: Role[]

  @Field()
  isActive: boolean

  @Field()
  emailVerified: boolean

  @Field({ nullable: true })
  lastLoginAt?: Date

  @Field()
  loginAttempts: number

  @Field()
  isLocked: boolean

  @Field()
  canAttemptLogin: boolean

  @Field()
  createdAt: Date

  @Field()
  updatedAt: Date

  // Computed fields
  @Field()
  isAdmin: boolean

  @Field()
  isModerator: boolean

  @Field(() => [String])
  permissions: string[]
}

@ObjectType()
export class Role {
  @Field(() => ID)
  id: string

  @Field()
  name: string

  @Field({ nullable: true })
  description?: string

  @Field()
  isActive: boolean

  @Field(() => [String])
  permissions: string[]

  @Field()
  createdAt: Date

  @Field()
  updatedAt: Date
}

@ObjectType()
export class UserConnection {
  @Field(() => [UserEdge])
  edges: UserEdge[]

  @Field()
  pageInfo: PaginationInfo

  @Field()
  totalCount: number
}

@ObjectType()
export class UserEdge {
  @Field()
  cursor: string

  @Field(() => User)
  node: User
}

@InputType()
export class CreateUserInput {
  @Field()
  email: string

  @Field()
  password: string

  @Field()
  firstName: string

  @Field()
  lastName: string

  @Field(() => [String], { nullable: true })
  roleIds?: string[]
}

@InputType()
export class UpdateUserInput {
  @Field(() => ID)
  id: string

  @Field({ nullable: true })
  email?: string

  @Field({ nullable: true })
  firstName?: string

  @Field({ nullable: true })
  lastName?: string

  @Field({ nullable: true })
  isActive?: boolean

  @Field(() => [String], { nullable: true })
  roleIds?: string[]
}

@InputType()
export class ChangePasswordInput {
  @Field()
  currentPassword: string

  @Field()
  newPassword: string
}

@InputType()
export class UserFilterInput extends FilterInput {
  @Field(() => UserRole, { nullable: true })
  role?: UserRole

  @Field({ nullable: true })
  emailVerified?: boolean

  @Field({ nullable: true })
  isLocked?: boolean
}

@InputType()
export class UserSortInput extends SortInput {
  @Field({ defaultValue: 'createdAt' })
  field: string
}