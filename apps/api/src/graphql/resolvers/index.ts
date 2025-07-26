import { DateResolver, JSONResolver } from 'graphql-scalars'
import { GraphQLContext } from '../server'
import { AuthenticationError, ForbiddenError, UserInputError } from 'apollo-server-express'
import { AppDataSource, User, Organization, OKR, KeyResult, OKRComment } from '@product-outcomes/database'
import { SubscriptionPublisher } from '../pubsub'

// Helper to require authentication
const requireAuth = (context: GraphQLContext) => {
  if (!context.user) {
    throw new AuthenticationError('Authentication required')
  }
  return context.user
}

// Helper to get user's organization IDs
const getUserOrganizationIds = async (userId: string): Promise<string[]> => {
  const orgRepository = AppDataSource.getRepository(Organization)
  const organizations = await orgRepository
    .createQueryBuilder('org')
    .leftJoin('org.members', 'member')
    .where('member.id = :userId', { userId })
    .getMany()
  
  return organizations.map(org => org.id)
}

// Helper to check organization membership
const requireOrganizationMember = async (organizationId: string, userId: string) => {
  const orgRepository = AppDataSource.getRepository(Organization)
  const organization = await orgRepository.findOne({
    where: { id: organizationId },
    relations: ['members'],
  })
  
  if (!organization) {
    throw new UserInputError('Organization not found')
  }
  
  const members = await organization.members
  const isMember = members.some(member => member.id === userId)
  
  if (!isMember) {
    throw new ForbiddenError('You are not a member of this organization')
  }
  
  return organization
}

export const resolvers = {
  // Scalar resolvers
  Date: DateResolver,
  JSON: JSONResolver,

  // Root resolvers
  Query: {
    // User queries
    me: async (_: any, __: any, context: GraphQLContext) => {
      return requireAuth(context)
    },

    user: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      requireAuth(context)
      const userRepository = AppDataSource.getRepository(User)
      return userRepository.findOne({ where: { id }, relations: ['roles'] })
    },

    users: async (_: any, { limit = 10, offset = 0 }: { limit: number; offset: number }, context: GraphQLContext) => {
      requireAuth(context)
      const userRepository = AppDataSource.getRepository(User)
      return userRepository.find({
        relations: ['roles'],
        take: limit,
        skip: offset,
        order: { createdAt: 'DESC' }
      })
    },

    // Organization queries
    organization: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      const user = requireAuth(context)
      const orgRepository = AppDataSource.getRepository(Organization)
      const organization = await orgRepository.findOne({
        where: { id },
        relations: ['members', 'okrs']
      })
      
      if (!organization) {
        throw new UserInputError('Organization not found')
      }
      
      // Check if user has access to this organization
      const members = await organization.members
      const isMember = members.some(member => member.id === user.id)
      
      if (!isMember && organization.status !== 'ACTIVE') {
        throw new ForbiddenError('Access denied')
      }
      
      return organization
    },

    organizationBySlug: async (_: any, { slug }: { slug: string }, context: GraphQLContext) => {
      requireAuth(context)
      const orgRepository = AppDataSource.getRepository(Organization)
      return orgRepository.findOne({
        where: { slug },
        relations: ['members', 'okrs']
      })
    },

    organizations: async (_: any, { limit = 10, offset = 0 }: { limit: number; offset: number }, context: GraphQLContext) => {
      requireAuth(context)
      const orgRepository = AppDataSource.getRepository(Organization)
      return orgRepository.find({
        where: { status: 'ACTIVE' },
        relations: ['members'],
        take: limit,
        skip: offset,
        order: { createdAt: 'DESC' }
      })
    },

    myOrganizations: async (_: any, __: any, context: GraphQLContext) => {
      const user = requireAuth(context)
      const orgRepository = AppDataSource.getRepository(Organization)
      
      // Find organizations where user is a member
      const organizations = await orgRepository
        .createQueryBuilder('org')
        .leftJoinAndSelect('org.members', 'member')
        .where('member.id = :userId', { userId: user.id })
        .getMany()
      
      return organizations
    },

    // OKR queries
    okr: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      const user = requireAuth(context)
      const okrRepository = AppDataSource.getRepository(OKR)
      const okr = await okrRepository.findOne({
        where: { id },
        relations: ['owner', 'organization', 'keyResults', 'comments']
      })
      
      if (!okr) {
        throw new UserInputError('OKR not found')
      }
      
      // Check if user can view this OKR
      // Get user's organization ID from their membership
      const userOrgIds = await getUserOrganizationIds(user.id)
      const canView = userOrgIds.some(orgId => okr.canUserView(user.id, orgId))
      if (!canView) {
        throw new ForbiddenError('Access denied')
      }
      
      return okr
    },

    okrs: async (_: any, { filter, limit = 10, offset = 0 }: any, context: GraphQLContext) => {
      const user = requireAuth(context)
      const okrRepository = AppDataSource.getRepository(OKR)
      
      let query = okrRepository.createQueryBuilder('okr')
        .leftJoinAndSelect('okr.owner', 'owner')
        .leftJoinAndSelect('okr.organization', 'organization')
        .leftJoinAndSelect('okr.keyResults', 'keyResults')
      
      // Apply filters
      if (filter?.status) {
        query = query.andWhere('okr.status IN (:...statuses)', { statuses: filter.status })
      }
      
      if (filter?.organizationId) {
        await requireOrganizationMember(filter.organizationId, user.id)
        query = query.andWhere('okr.organizationId = :orgId', { orgId: filter.organizationId })
      }
      
      if (filter?.ownerId) {
        query = query.andWhere('okr.ownerId = :ownerId', { ownerId: filter.ownerId })
      }
      
      if (filter?.search) {
        query = query.andWhere('(okr.title ILIKE :search OR okr.description ILIKE :search)', {
          search: `%${filter.search}%`
        })
      }
      
      return query
        .take(limit)
        .skip(offset)
        .orderBy('okr.createdAt', 'DESC')
        .getMany()
    },

    myOKRs: async (_: any, { filter, limit = 10, offset = 0 }: any, context: GraphQLContext) => {
      const user = requireAuth(context)
      const okrRepository = AppDataSource.getRepository(OKR)
      
      let query = okrRepository.createQueryBuilder('okr')
        .leftJoinAndSelect('okr.owner', 'owner')
        .leftJoinAndSelect('okr.organization', 'organization')
        .leftJoinAndSelect('okr.keyResults', 'keyResults')
        .where('okr.ownerId = :userId', { userId: user.id })
      
      // Apply additional filters
      if (filter?.status) {
        query = query.andWhere('okr.status IN (:...statuses)', { statuses: filter.status })
      }
      
      if (filter?.period) {
        query = query.andWhere('okr.period IN (:...periods)', { periods: filter.period })
      }
      
      return query
        .take(limit)
        .skip(offset)
        .orderBy('okr.createdAt', 'DESC')
        .getMany()
    },
  },

  Mutation: {
    // Organization mutations
    createOrganization: async (_: any, { input }: any, context: GraphQLContext) => {
      const user = requireAuth(context)
      const orgRepository = AppDataSource.getRepository(Organization)
      
      const organization = orgRepository.create({
        ...input,
        slug: Organization.generateSlug(input.name),
        members: [user], // Creator is automatically a member
      })
      
      const savedOrg = await orgRepository.save(organization)
      
      // Publish event
      await SubscriptionPublisher.publishNewOrganizationMember(user, savedOrg.id)
      
      return savedOrg
    },

    updateOrganization: async (_: any, { id, input }: any, context: GraphQLContext) => {
      const user = requireAuth(context)
      const organization = await requireOrganizationMember(id, user.id)
      
      // Check if user can edit organization (for now, any member can edit)
      const orgRepository = AppDataSource.getRepository(Organization)
      
      Object.assign(organization, input)
      const savedOrg = await orgRepository.save(organization)
      
      // Publish event
      await SubscriptionPublisher.publishOrganizationUpdated(savedOrg)
      
      return savedOrg
    },

    // OKR mutations
    createOKR: async (_: any, { input }: any, context: GraphQLContext) => {
      const user = requireAuth(context)
      await requireOrganizationMember(input.organizationId, user.id)
      
      const okrRepository = AppDataSource.getRepository(OKR)
      const orgRepository = AppDataSource.getRepository(Organization)
      
      const organization = await orgRepository.findOne({ where: { id: input.organizationId } })
      if (!organization) {
        throw new UserInputError('Organization not found')
      }
      
      const okr = okrRepository.create({
        ...input,
        owner: user,
        organization,
      })
      
      const savedOKR = await okrRepository.save(okr)
      
      // Publish events
      await SubscriptionPublisher.publishNewOKR(savedOKR, input.organizationId)
      await SubscriptionPublisher.publishUserActivity({
        userId: user.id,
        user,
        action: 'created_okr',
        resourceType: 'OKR',
        resourceId: savedOKR.id,
        metadata: { title: savedOKR.title },
        timestamp: new Date(),
      }, input.organizationId)
      
      return savedOKR
    },

    updateOKR: async (_: any, { id, input }: any, context: GraphQLContext) => {
      const user = requireAuth(context)
      const okrRepository = AppDataSource.getRepository(OKR)
      
      const okr = await okrRepository.findOne({
        where: { id },
        relations: ['owner', 'organization']
      })
      
      if (!okr) {
        throw new UserInputError('OKR not found')
      }
      
      if (!okr.canUserEdit(user.id)) {
        throw new ForbiddenError('You can only edit your own OKRs')
      }
      
      const oldStatus = okr.status
      const oldProgress = okr.progress
      
      Object.assign(okr, input)
      const savedOKR = await okrRepository.save(okr)
      
      // Publish appropriate events based on what changed
      if (input.status && input.status !== oldStatus) {
        await SubscriptionPublisher.publishOKRStatusChanged(savedOKR, okr.organization.id)
      }
      
      if (input.progress && input.progress !== oldProgress) {
        await SubscriptionPublisher.publishOKRProgressChanged(savedOKR, okr.organization.id)
      }
      
      await SubscriptionPublisher.publishOKRUpdated(savedOKR, okr.organization.id)
      
      return savedOKR
    },

    // Key Result mutations
    createKeyResult: async (_: any, { input }: any, context: GraphQLContext) => {
      const user = requireAuth(context)
      const keyResultRepository = AppDataSource.getRepository(KeyResult)
      const okrRepository = AppDataSource.getRepository(OKR)
      
      const okr = await okrRepository.findOne({
        where: { id: input.okrId },
        relations: ['owner', 'organization']
      })
      
      if (!okr) {
        throw new UserInputError('OKR not found')
      }
      
      if (!okr.canUserEdit(user.id)) {
        throw new ForbiddenError('You can only add key results to your own OKRs')
      }
      
      const keyResult = keyResultRepository.create({
        ...input,
        okr,
      })
      
      const savedKeyResult = await keyResultRepository.save(keyResult)
      
      // Publish event
      await SubscriptionPublisher.publishKeyResultUpdated(savedKeyResult, input.okrId)
      
      return savedKeyResult
    },

    updateKeyResultProgress: async (_: any, { id, value, note }: any, context: GraphQLContext) => {
      const user = requireAuth(context)
      const keyResultRepository = AppDataSource.getRepository(KeyResult)
      
      const keyResult = await keyResultRepository.findOne({
        where: { id },
        relations: ['okr', 'okr.owner', 'okr.organization']
      })
      
      if (!keyResult) {
        throw new UserInputError('Key result not found')
      }
      
      if (!keyResult.okr.canUserEdit(user.id)) {
        throw new ForbiddenError('You can only update key results for your own OKRs')
      }
      
      const oldStatus = keyResult.status
      keyResult.updateProgress(value, note)
      const savedKeyResult = await keyResultRepository.save(keyResult)
      
      // Update OKR progress
      await keyResult.okr.calculateProgress()
      await AppDataSource.getRepository(OKR).save(keyResult.okr)
      
      // Publish events
      await SubscriptionPublisher.publishKeyResultProgressUpdated(savedKeyResult, keyResult.okr.id)
      
      if (savedKeyResult.status !== oldStatus) {
        await SubscriptionPublisher.publishKeyResultStatusChanged(savedKeyResult, keyResult.okr.id)
      }
      
      await SubscriptionPublisher.publishOKRProgressChanged(keyResult.okr, keyResult.okr.organization.id)
      
      return savedKeyResult
    },

    // Comment mutations
    createComment: async (_: any, { input }: any, context: GraphQLContext) => {
      const user = requireAuth(context)
      const commentRepository = AppDataSource.getRepository(OKRComment)
      const okrRepository = AppDataSource.getRepository(OKR)
      
      const okr = await okrRepository.findOne({
        where: { id: input.okrId },
        relations: ['organization']
      })
      
      if (!okr) {
        throw new UserInputError('OKR not found')
      }
      
      // Check if user can view this OKR
      const userOrgIds = await getUserOrganizationIds(user.id)
      const canView = userOrgIds.some(orgId => okr.canUserView(user.id, orgId))
      if (!canView) {
        throw new ForbiddenError('You cannot comment on this OKR')
      }
      
      const comment = commentRepository.create({
        ...input,
        okr,
        author: user,
      })
      
      const savedComment = await commentRepository.save(comment)
      
      // Publish event
      await SubscriptionPublisher.publishNewComment(savedComment, input.okrId)
      
      return savedComment
    },

    addCommentReaction: async (_: any, { id, emoji }: any, context: GraphQLContext) => {
      const user = requireAuth(context)
      const commentRepository = AppDataSource.getRepository(OKRComment)
      
      const comment = await commentRepository.findOne({
        where: { id },
        relations: ['okr']
      })
      
      if (!comment) {
        throw new UserInputError('Comment not found')
      }
      
      comment.addReaction(user.id, emoji)
      const savedComment = await commentRepository.save(comment)
      
      // Publish event
      await SubscriptionPublisher.publishCommentReactionAdded(savedComment, comment.okr.id)
      
      return savedComment
    },
  },

  // Type resolvers for computed fields
  Organization: {
    memberCount: async (organization: any) => {
      return organization.getMemberCount()
    },
    okrCount: async (organization: any) => {
      return organization.getOKRCount()
    },
  },

  OKR: {
    keyResultsCount: async (okr: any) => {
      return okr.getKeyResultsCount()
    },
    completedKeyResultsCount: async (okr: any) => {
      return okr.getCompletedKeyResultsCount()
    },
    commentsCount: async (okr: any) => {
      return okr.getCommentsCount()
    },
  },

  OKRComment: {
    hasReplies: async (comment: any) => {
      return comment.hasReplies
    },
    replyCount: async (comment: any) => {
      return comment.replyCount
    },
  },
}