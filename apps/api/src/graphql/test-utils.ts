// Test utilities for GraphQL subscriptions
import { SubscriptionPublisher } from './pubsub'

export class SubscriptionTestUtils {
  // Mock data generators
  static generateMockOKR(overrides: any = {}) {
    return {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Increase Product Adoption',
      description: 'Drive user engagement and feature adoption across our product suite',
      status: 'active',
      period: 'quarterly',
      visibility: 'organization',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-31'),
      progress: 65.5,
      targetProgress: 100,
      metadata: {
        tags: ['product', 'growth'],
        priority: 'high',
      },
      owner: {
        id: '123e4567-e89b-12d3-a456-426614174002',
        fullName: 'John Smith',
        email: 'john.smith@example.com',
      },
      organization: {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Acme Corporation',
        slug: 'acme-corp',
      },
      isActive: true,
      isCompleted: false,
      isOverdue: false,
      daysRemaining: 45,
      progressPercentage: 65.5,
      keyResultsCount: 3,
      completedKeyResultsCount: 1,
      commentsCount: 8,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date(),
      ...overrides,
    }
  }

  static generateMockKeyResult(overrides: any = {}) {
    return {
      id: '123e4567-e89b-12d3-a456-426614174003',
      title: 'Achieve 10,000 monthly active users',
      description: 'Grow our user base to reach 10,000 MAU by end of quarter',
      type: 'numeric',
      status: 'in_progress',
      startValue: 5000,
      targetValue: 10000,
      currentValue: 7500,
      unit: 'users',
      dueDate: new Date('2024-03-31'),
      metadata: {
        priority: 'high',
        tags: ['growth', 'metrics'],
      },
      okr: SubscriptionTestUtils.generateMockOKR(),
      assignee: {
        id: '123e4567-e89b-12d3-a456-426614174004',
        fullName: 'Jane Doe',
        email: 'jane.doe@example.com',
      },
      progressPercentage: 50.0,
      isCompleted: false,
      isOverdue: false,
      isAtRisk: false,
      daysRemaining: 45,
      formattedValue: '7,500 users / 10,000 users',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date(),
      ...overrides,
    }
  }

  static generateMockComment(overrides: any = {}) {
    return {
      id: '123e4567-e89b-12d3-a456-426614174005',
      content: 'Great progress on this OKR! The team is really hitting their stride.',
      type: 'progress_update',
      isResolved: false,
      isEdited: false,
      editReason: null,
      metadata: {
        mentions: [],
        reactions: [
          {
            userId: '123e4567-e89b-12d3-a456-426614174006',
            emoji: '👍',
            timestamp: new Date(),
          },
        ],
      },
      okr: SubscriptionTestUtils.generateMockOKR(),
      author: {
        id: '123e4567-e89b-12d3-a456-426614174007',
        fullName: 'Mike Johnson',
        email: 'mike.johnson@example.com',
      },
      parentComment: null,
      replies: [],
      isReply: false,
      hasReplies: false,
      replyCount: 0,
      needsAttention: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }
  }

  static generateMockUserActivity(overrides: any = {}) {
    return {
      userId: '123e4567-e89b-12d3-a456-426614174008',
      user: {
        id: '123e4567-e89b-12d3-a456-426614174008',
        fullName: 'Sarah Wilson',
        email: 'sarah.wilson@example.com',
      },
      action: 'updated_okr_progress',
      resourceType: 'OKR',
      resourceId: '123e4567-e89b-12d3-a456-426614174000',
      metadata: {
        title: 'Increase Product Adoption',
        previousProgress: 60.0,
        newProgress: 65.5,
      },
      timestamp: new Date(),
      ...overrides,
    }
  }

  static generateMockUserPresence(overrides: any = {}) {
    return {
      userId: '123e4567-e89b-12d3-a456-426614174009',
      user: {
        id: '123e4567-e89b-12d3-a456-426614174009',
        fullName: 'David Brown',
        email: 'david.brown@example.com',
      },
      status: 'online',
      lastSeen: new Date(),
      currentPage: '/okrs/dashboard',
      ...overrides,
    }
  }

  static generateMockNotification(overrides: any = {}) {
    return {
      id: '123e4567-e89b-12d3-a456-426614174010',
      type: 'okr_deadline_approaching',
      title: 'OKR Deadline Approaching',
      message: 'Your OKR "Increase Product Adoption" is due in 7 days',
      priority: 'medium',
      metadata: {
        okrId: '123e4567-e89b-12d3-a456-426614174000',
        daysRemaining: 7,
      },
      createdAt: new Date(),
      ...overrides,
    }
  }

  // Test event publishers
  static async publishTestOKRUpdate(organizationId = '123e4567-e89b-12d3-a456-426614174001') {
    const okr = SubscriptionTestUtils.generateMockOKR({
      progress: Math.random() * 100,
      updatedAt: new Date(),
    })
    
    await SubscriptionPublisher.publishOKRUpdated(okr, organizationId)
    console.log('📡 Published test OKR update:', okr.title)
    return okr
  }

  static async publishTestProgressUpdate(organizationId = '123e4567-e89b-12d3-a456-426614174001') {
    const okr = SubscriptionTestUtils.generateMockOKR({
      progress: Math.random() * 100,
      updatedAt: new Date(),
    })
    
    await SubscriptionPublisher.publishOKRProgressChanged(okr, organizationId)
    console.log('📈 Published test progress update:', okr.title, `${okr.progress}%`)
    return okr
  }

  static async publishTestNewOKR(organizationId = '123e4567-e89b-12d3-a456-426614174001') {
    const okr = SubscriptionTestUtils.generateMockOKR({
      id: `new-okr-${Date.now()}`,
      title: `New Test OKR ${new Date().toLocaleTimeString()}`,
      createdAt: new Date(),
    })
    
    await SubscriptionPublisher.publishNewOKR(okr, organizationId)
    console.log('🆕 Published new OKR:', okr.title)
    return okr
  }

  static async publishTestKeyResultUpdate(okrId = '123e4567-e89b-12d3-a456-426614174000') {
    const keyResult = SubscriptionTestUtils.generateMockKeyResult({
      currentValue: Math.floor(Math.random() * 10000) + 5000,
      updatedAt: new Date(),
    })
    
    await SubscriptionPublisher.publishKeyResultUpdated(keyResult, okrId)
    console.log('🎯 Published key result update:', keyResult.title)
    return keyResult
  }

  static async publishTestComment(okrId = '123e4567-e89b-12d3-a456-426614174000') {
    const comment = SubscriptionTestUtils.generateMockComment({
      id: `comment-${Date.now()}`,
      content: `Test comment at ${new Date().toLocaleTimeString()}`,
      createdAt: new Date(),
    })
    
    await SubscriptionPublisher.publishNewComment(comment, okrId)
    console.log('💬 Published new comment:', comment.content)
    return comment
  }

  static async publishTestUserActivity(organizationId = '123e4567-e89b-12d3-a456-426614174001') {
    const activity = SubscriptionTestUtils.generateMockUserActivity({
      timestamp: new Date(),
      action: 'viewed_okr',
      metadata: {
        title: 'Test Activity',
        timestamp: new Date().toISOString(),
      },
    })
    
    await SubscriptionPublisher.publishUserActivity(activity, organizationId)
    console.log('👤 Published user activity:', activity.action)
    return activity
  }

  static async publishTestNotification(userId = '123e4567-e89b-12d3-a456-426614174002') {
    const notification = SubscriptionTestUtils.generateMockNotification({
      id: `notification-${Date.now()}`,
      title: `Test Notification ${new Date().toLocaleTimeString()}`,
      message: 'This is a test notification for subscription testing',
      createdAt: new Date(),
    })
    
    await SubscriptionPublisher.publishSystemNotification(notification, userId)
    console.log('🔔 Published system notification:', notification.title)
    return notification
  }

  // Batch test publisher
  static async publishTestBatch(organizationId = '123e4567-e89b-12d3-a456-426614174001') {
    console.log('🚀 Publishing test batch...')
    
    const results = await Promise.all([
      SubscriptionTestUtils.publishTestOKRUpdate(organizationId),
      SubscriptionTestUtils.publishTestProgressUpdate(organizationId),
      SubscriptionTestUtils.publishTestNewOKR(organizationId),
      SubscriptionTestUtils.publishTestKeyResultUpdate(),
      SubscriptionTestUtils.publishTestComment(),
      SubscriptionTestUtils.publishTestUserActivity(organizationId),
      SubscriptionTestUtils.publishTestNotification(),
    ])
    
    console.log('✅ Test batch published successfully')
    return results
  }

  // Continuous test publisher (for stress testing)
  static startContinuousTests(intervalMs = 5000, organizationId = '123e4567-e89b-12d3-a456-426614174001') {
    console.log(`🔄 Starting continuous tests every ${intervalMs}ms`)
    
    const interval = setInterval(async () => {
      try {
        const testType = Math.floor(Math.random() * 6)
        
        switch (testType) {
          case 0:
            await SubscriptionTestUtils.publishTestOKRUpdate(organizationId)
            break
          case 1:
            await SubscriptionTestUtils.publishTestProgressUpdate(organizationId)
            break
          case 2:
            await SubscriptionTestUtils.publishTestKeyResultUpdate()
            break
          case 3:
            await SubscriptionTestUtils.publishTestComment()
            break
          case 4:
            await SubscriptionTestUtils.publishTestUserActivity(organizationId)
            break
          case 5:
            await SubscriptionTestUtils.publishTestNotification()
            break
        }
      } catch (error) {
        console.error('❌ Error in continuous test:', error)
      }
    }, intervalMs)
    
    return interval
  }

  static stopContinuousTests(interval: NodeJS.Timeout) {
    clearInterval(interval)
    console.log('⏹️ Stopped continuous tests')
  }
}

// Export for use in tests and development
export { SubscriptionTestUtils as TestUtils }