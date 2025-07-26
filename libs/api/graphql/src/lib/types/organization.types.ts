import { Field, ObjectType, InputType, ID } from 'type-graphql'
import { PaginationInfo, PaginationInput, FilterInput, SortInput } from './common.types'
import { User } from './user.types'

@ObjectType()
export class Organization {
  @Field(() => ID)
  id: string

  @Field()
  name: string

  @Field({ nullable: true })
  description?: string

  @Field({ nullable: true })
  website?: string

  @Field({ nullable: true })
  logo?: string

  @Field()
  isActive: boolean

  @Field(() => [User])
  members: User[]

  @Field()
  memberCount: number

  @Field(() => User, { nullable: true })
  owner?: User

  @Field()
  createdAt: Date

  @Field()
  updatedAt: Date
}

@ObjectType()
export class OrganizationConnection {
  @Field(() => [OrganizationEdge])
  edges: OrganizationEdge[]

  @Field()
  pageInfo: PaginationInfo

  @Field()
  totalCount: number
}

@ObjectType()
export class OrganizationEdge {
  @Field()
  cursor: string

  @Field(() => Organization)
  node: Organization
}

@InputType()
export class CreateOrganizationInput {
  @Field()
  name: string

  @Field({ nullable: true })
  description?: string

  @Field({ nullable: true })
  website?: string

  @Field({ nullable: true })
  logo?: string
}

@InputType()
export class UpdateOrganizationInput {
  @Field(() => ID)
  id: string

  @Field({ nullable: true })
  name?: string

  @Field({ nullable: true })
  description?: string

  @Field({ nullable: true })
  website?: string

  @Field({ nullable: true })
  logo?: string

  @Field({ nullable: true })
  isActive?: boolean
}

@InputType()
export class OrganizationMemberInput {
  @Field(() => ID)
  organizationId: string

  @Field(() => ID)
  userId: string
}

@InputType()
export class OrganizationFilterInput extends FilterInput {
  @Field({ nullable: true })
  hasMembers?: boolean

  @Field(() => ID, { nullable: true })
  ownerId?: string
}

@InputType()
export class OrganizationSortInput extends SortInput {
  @Field({ defaultValue: 'name' })
  field: string
}