import { Field, ObjectType, InputType, ID, registerEnumType } from 'type-graphql'

@ObjectType()
export class PaginationInfo {
  @Field()
  hasNextPage: boolean

  @Field()
  hasPreviousPage: boolean

  @Field({ nullable: true })
  startCursor?: string

  @Field({ nullable: true })
  endCursor?: string

  @Field()
  totalCount: number
}

@InputType()
export class PaginationInput {
  @Field({ nullable: true })
  first?: number

  @Field({ nullable: true })
  after?: string

  @Field({ nullable: true })
  last?: number

  @Field({ nullable: true })
  before?: string
}

@InputType()
export class FilterInput {
  @Field({ nullable: true })
  search?: string

  @Field(() => [String], { nullable: true })
  tags?: string[]

  @Field({ nullable: true })
  isActive?: boolean
}

export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

registerEnumType(SortDirection, {
  name: 'SortDirection',
  description: 'Sort direction for queries',
})

@InputType()
export class SortInput {
  @Field()
  field: string

  @Field(() => SortDirection, { defaultValue: SortDirection.ASC })
  direction: SortDirection
}

@ObjectType()
export class DeleteResult {
  @Field()
  success: boolean

  @Field({ nullable: true })
  message?: string

  @Field(() => ID, { nullable: true })
  deletedId?: string
}