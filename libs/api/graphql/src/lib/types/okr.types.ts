import { Field, ObjectType, InputType, ID, Float, registerEnumType } from 'type-graphql'
import { PaginationInfo, PaginationInput, FilterInput, SortInput } from './common.types'
import { User } from './user.types'
import { Organization } from './organization.types'

export enum OKRStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

registerEnumType(OKRStatus, {
  name: 'OKRStatus',
  description: 'Status of an OKR',
})

export enum OKRPeriod {
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM',
}

registerEnumType(OKRPeriod, {
  name: 'OKRPeriod',
  description: 'Time period for an OKR',
})

@ObjectType()
export class OKR {
  @Field(() => ID)
  id: string

  @Field()
  title: string

  @Field({ nullable: true })
  description?: string

  @Field(() => OKRStatus)
  status: OKRStatus

  @Field(() => OKRPeriod)
  period: OKRPeriod

  @Field()
  startDate: Date

  @Field()
  endDate: Date

  @Field(() => Float, { defaultValue: 0 })
  progress: number

  @Field(() => [KeyResult])
  keyResults: KeyResult[]

  @Field(() => User, { nullable: true })
  owner?: User

  @Field(() => Organization, { nullable: true })
  organization?: Organization

  @Field(() => [User])
  collaborators: User[]

  @Field()
  createdAt: Date

  @Field()
  updatedAt: Date
}

@ObjectType()
export class KeyResult {
  @Field(() => ID)
  id: string

  @Field()
  title: string

  @Field({ nullable: true })
  description?: string

  @Field(() => Float)
  target: number

  @Field(() => Float, { defaultValue: 0 })
  current: number

  @Field()
  unit: string

  @Field(() => Float)
  progress: number

  @Field(() => OKR)
  okr: OKR

  @Field()
  createdAt: Date

  @Field()
  updatedAt: Date
}

@ObjectType()
export class OKRConnection {
  @Field(() => [OKREdge])
  edges: OKREdge[]

  @Field()
  pageInfo: PaginationInfo

  @Field()
  totalCount: number
}

@ObjectType()
export class OKREdge {
  @Field()
  cursor: string

  @Field(() => OKR)
  node: OKR
}

@InputType()
export class CreateOKRInput {
  @Field()
  title: string

  @Field({ nullable: true })
  description?: string

  @Field(() => OKRPeriod, { defaultValue: OKRPeriod.QUARTERLY })
  period: OKRPeriod

  @Field()
  startDate: Date

  @Field()
  endDate: Date

  @Field(() => ID, { nullable: true })
  organizationId?: string

  @Field(() => [CreateKeyResultInput])
  keyResults: CreateKeyResultInput[]
}

@InputType()
export class CreateKeyResultInput {
  @Field()
  title: string

  @Field({ nullable: true })
  description?: string

  @Field(() => Float)
  target: number

  @Field()
  unit: string
}

@InputType()
export class UpdateOKRInput {
  @Field(() => ID)
  id: string

  @Field({ nullable: true })
  title?: string

  @Field({ nullable: true })
  description?: string

  @Field(() => OKRStatus, { nullable: true })
  status?: OKRStatus

  @Field({ nullable: true })
  startDate?: Date

  @Field({ nullable: true })
  endDate?: Date
}

@InputType()
export class UpdateKeyResultInput {
  @Field(() => ID)
  id: string

  @Field({ nullable: true })
  title?: string

  @Field({ nullable: true })
  description?: string

  @Field(() => Float, { nullable: true })
  target?: number

  @Field(() => Float, { nullable: true })
  current?: number

  @Field({ nullable: true })
  unit?: string
}

@InputType()
export class OKRFilterInput extends FilterInput {
  @Field(() => OKRStatus, { nullable: true })
  status?: OKRStatus

  @Field(() => OKRPeriod, { nullable: true })
  period?: OKRPeriod

  @Field(() => ID, { nullable: true })
  ownerId?: string

  @Field(() => ID, { nullable: true })
  organizationId?: string

  @Field({ nullable: true })
  startDate?: Date

  @Field({ nullable: true })
  endDate?: Date
}

@InputType()
export class OKRSortInput extends SortInput {
  @Field({ defaultValue: 'createdAt' })
  field: string
}