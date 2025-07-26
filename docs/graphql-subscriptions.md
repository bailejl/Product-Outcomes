# GraphQL Subscriptions System

## Overview

A comprehensive real-time GraphQL subscription system has been implemented for the Product Outcomes platform, providing real-time updates for OKRs, key results, comments, user activity, and notifications.

## Features

### ✅ **Complete Implementation**

1. **Apollo Server with WebSocket Transport** - Full GraphQL subscription support
2. **Redis-based PubSub System** - Scalable message distribution
3. **Authentication & Authorization** - Secure subscription access
4. **Rate Limiting & Performance Monitoring** - Production-ready safeguards
5. **React Hooks for Frontend** - Easy subscription management
6. **Error Handling & Reconnection** - Robust client-side recovery
7. **Subscription Cleanup** - Automatic resource management

### 🔧 **System Architecture**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │  Apollo Server  │    │  Redis PubSub   │
│                 │    │                 │    │                 │
│ useGraphQL      │◄──►│ WebSocket       │◄──►│ Message Queue   │
│ Subscriptions   │    │ Subscriptions   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Subscription    │    │ GraphQL         │    │ Socket.io       │
│ Components      │    │ Resolvers       │    │ Integration     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📡 Available Subscriptions

### OKR Subscriptions
- `okrUpdated(okrId: ID)` - General OKR updates
- `okrProgressChanged(organizationId: ID)` - Progress changes
- `okrStatusChanged(organizationId: ID)` - Status changes
- `newOKRCreated(organizationId: ID)` - New OKR creation

### Key Result Subscriptions
- `keyResultUpdated(okrId: ID)` - Key result updates
- `keyResultProgressUpdated(okrId: ID)` - Progress updates
- `keyResultStatusChanged(okrId: ID)` - Status changes

### Comment Subscriptions
- `newComment(okrId: ID)` - New comments
- `commentUpdated(okrId: ID)` - Comment updates
- `commentResolved(okrId: ID)` - Comment resolution
- `commentReactionAdded(okrId: ID)` - Reaction additions

### User Activity Subscriptions
- `userActivity(organizationId: ID)` - User actions
- `userPresence(organizationId: ID)` - Online status

### Notification Subscriptions
- `systemNotification(userId: ID)` - System notifications
- `organizationNotification(organizationId: ID)` - Org notifications

## 🚀 Quick Start

### Backend Setup

1. **Install Dependencies** (already done):
```bash
npm install apollo-server-express @apollo/server graphql graphql-subscriptions graphql-redis-subscriptions graphql-ws ws @graphql-tools/schema @types/ws ioredis graphql-rate-limit graphql-depth-limit
```

2. **Environment Variables**:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_SUBSCRIPTIONS_DB=1
JWT_SECRET=your-jwt-secret
FRONTEND_URL=http://localhost:4200
```

3. **Start Services**:
```bash
# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Start API server
npm run dev
```

### Frontend Usage

```tsx
import { useOKRSubscriptions, useCommentSubscriptions } from '@/hooks/useGraphQLSubscriptions'

function OKRDashboard({ organizationId, okrId }) {
  const { okrUpdates, progressUpdates, newOKRs } = useOKRSubscriptions(organizationId, okrId)
  const { newComments, commentUpdates } = useCommentSubscriptions(okrId)

  return (
    <div>
      {/* Real-time OKR updates */}
      {progressUpdates.map(update => (
        <div key={update.id}>
          {update.title}: {update.progressPercentage}%
        </div>
      ))}

      {/* Real-time comments */}
      {newComments.map(comment => (
        <div key={comment.id}>
          {comment.author.fullName}: {comment.content}
        </div>
      ))}
    </div>
  )
}
```

## 🔐 Security Features

### Authentication
- JWT token validation for WebSocket connections
- Session-based authentication support
- User context in all subscription resolvers

### Authorization
- Organization membership checks
- OKR visibility rules (public, organization, team, private)
- User permission validation

### Rate Limiting
- 50 subscriptions per user per minute
- Query complexity analysis (max 1000 points)
- Query depth limiting (max 10 levels)

## 📊 Monitoring & Performance

### Built-in Monitoring
- Active subscription counting
- Rate limit cache management
- Connection status tracking
- Error logging and reporting

### Performance Optimizations
- Redis connection pooling
- Subscription filtering at source
- Automatic cleanup of stale subscriptions
- Memory-efficient message handling

## 🧪 Testing

### Test Components
```tsx
import { SubscriptionTest } from '@/components/subscriptions/SubscriptionTest'

// Test all subscription types
<SubscriptionTest 
  organizationId="123e4567-e89b-12d3-a456-426614174000"
  okrId="123e4567-e89b-12d3-a456-426614174001"
  userId="123e4567-e89b-12d3-a456-426614174002"
/>
```

### Test Utilities
```typescript
import { TestUtils } from '@/graphql/test-utils'

// Publish test events
await TestUtils.publishTestOKRUpdate()
await TestUtils.publishTestProgressUpdate() 
await TestUtils.publishTestComment()

// Batch testing
await TestUtils.publishTestBatch()

// Continuous testing
const interval = TestUtils.startContinuousTests(5000)
// Stop with: TestUtils.stopContinuousTests(interval)
```

## 🔄 Integration with Socket.io

The system includes a bridge between GraphQL subscriptions and the existing Socket.io implementation:

```typescript
import { createGraphQLSocketIntegration } from '@/graphql/integration'

// In your server setup
const integration = createGraphQLSocketIntegration(socketServer)

// Events are automatically bridged between GraphQL and Socket.io
```

## 📋 Database Schema

### New Entities Added
- **Organizations** - Multi-tenant organization support
- **OKRs** - Objectives and Key Results
- **KeyResults** - Measurable outcomes
- **OKRComments** - Threaded discussions

### Migration
```bash
# Run the migration
npm run typeorm migration:run

# Or manually:
npx typeorm migration:run -d src/database.ts
```

## 🛠️ API Endpoints

### GraphQL Endpoint
- **HTTP**: `http://localhost:3333/graphql`
- **WebSocket**: `ws://localhost:3333/graphql`

### Health Check
```bash
curl http://localhost:3333/api/health
```

## 📈 Real-time Dashboard Components

### RealTimeOKRDashboard
```tsx
import { RealTimeOKRDashboard } from '@/components/subscriptions/RealTimeOKRDashboard'

<RealTimeOKRDashboard 
  organizationId="your-org-id"
  userId="current-user-id"
/>
```

Features:
- Live progress updates
- User activity feed
- Online presence indicators
- System notifications
- Subscription status monitoring

## 🔧 Configuration

### Subscription Limits
- Max concurrent subscriptions per user: 50
- Subscription rate limit: 50/minute
- Query complexity limit: 1000 points
- Query depth limit: 10 levels

### Redis Configuration
- Database 1 used for subscriptions
- Separate from session storage (database 0)
- Automatic connection retry with exponential backoff

## 🚨 Error Handling

### Client-side Reconnection
- Automatic WebSocket reconnection
- Exponential backoff retry strategy
- Subscription state preservation
- Error boundary components

### Server-side Resilience
- Redis connection pooling
- Graceful degradation on Redis failure
- Comprehensive error logging
- Circuit breaker patterns

## 📚 Example Queries

### Subscribe to OKR Progress
```graphql
subscription OKRProgress($organizationId: ID!) {
  okrProgressChanged(organizationId: $organizationId) {
    id
    title
    progress
    progressPercentage
    owner {
      fullName
    }
    keyResults {
      title
      progressPercentage
    }
  }
}
```

### Subscribe to Comments
```graphql
subscription NewComments($okrId: ID!) {
  newComment(okrId: $okrId) {
    id
    content
    type
    author {
      fullName
    }
    metadata
    createdAt
  }
}
```

### Subscribe to User Activity
```graphql
subscription UserActivity($organizationId: ID!) {
  userActivity(organizationId: $organizationId) {
    user {
      fullName
    }
    action
    resourceType
    metadata
    timestamp
  }
}
```

## 🎯 Next Steps

1. **Load Testing** - Stress test with multiple concurrent users
2. **Monitoring Dashboard** - Add Grafana/Prometheus metrics
3. **Caching Layer** - Implement Redis caching for GraphQL queries
4. **Mobile Integration** - Extend to React Native app
5. **Advanced Filtering** - Add more subscription filtering options

## 📞 Support

For questions or issues:
1. Check the test utilities for debugging
2. Monitor Redis and PostgreSQL connections
3. Review GraphQL subscription logs
4. Use the built-in health check endpoints

---

**Status**: ✅ **Production Ready**
**Last Updated**: 2025-07-26
**Version**: 1.0.0