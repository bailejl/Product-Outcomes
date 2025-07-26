# Apollo Client Integration with React

This directory contains a comprehensive GraphQL integration using Apollo Client, providing type-safe, performant, and feature-rich data management for the React application.

## 🚀 Features Implemented

### Core Apollo Client Setup
- ✅ **Apollo Client Configuration** - Complete setup with authentication, error handling, and caching
- ✅ **Authentication Headers** - Automatic token management and refresh
- ✅ **Error Boundaries** - Comprehensive GraphQL error handling with user-friendly messages
- ✅ **Loading States** - Skeleton loaders and progressive loading indicators
- ✅ **Cache Policies** - Intelligent caching with optimistic updates

### GraphQL Operations
- ✅ **Type Definitions** - Complete GraphQL schema with fragments
- ✅ **Queries** - Optimized queries with pagination and filtering
- ✅ **Mutations** - CRUD operations with optimistic updates
- ✅ **Subscriptions** - Real-time updates for messages and user status

### Performance Optimizations
- ✅ **Cache Management** - Advanced caching strategies and cache warming
- ✅ **Optimistic Updates** - Immediate UI feedback for better UX
- ✅ **Query Deduplication** - Prevent duplicate network requests
- ✅ **Polling & Refetching** - Automatic data synchronization
- ✅ **Pagination Support** - Cursor-based pagination with infinite scroll

### Developer Experience
- ✅ **Apollo DevTools** - Development debugging and inspection
- ✅ **Custom Hooks** - Convenient React hooks for common operations
- ✅ **Error Categorization** - Structured error handling and reporting
- ✅ **Performance Monitoring** - Query timing and bottleneck detection

## 📁 File Structure

```
src/
├── graphql/
│   ├── index.ts              # Main exports
│   ├── types.ts              # GraphQL type definitions & fragments
│   ├── queries.ts            # Query operations
│   ├── mutations.ts          # Mutation operations
│   ├── subscriptions.ts      # Real-time subscriptions
│   └── README.md             # This file
├── lib/
│   ├── apollo-client.ts      # Apollo Client setup
│   ├── apollo-config.ts      # Configuration & performance settings
│   └── cache-strategies.ts   # Advanced caching patterns
├── hooks/
│   └── useGraphQL.ts         # Custom GraphQL hooks
├── components/
│   ├── GraphQLErrorBoundary.tsx  # Error handling
│   ├── GraphQLLoading.tsx        # Loading components
│   └── GraphQLDemo.tsx           # Demo component
└── contexts/
    └── GraphQLAuthContext.tsx    # GraphQL-based auth context
```

## 🎯 Usage Examples

### Basic Query
```tsx
import { useQuery } from '@apollo/client'
import { GET_RECENT_MESSAGES } from '../graphql/queries'

function MessagesList() {
  const { data, loading, error } = useQuery(GET_RECENT_MESSAGES, {
    variables: { limit: 20 },
    pollInterval: 30000, // Refresh every 30 seconds
  })

  if (loading) return <GraphQLLoading />
  if (error) return <ErrorMessage error={error} />

  return (
    <div>
      {data?.messages?.edges?.map(({ node: message }) => (
        <MessageCard key={message.id} message={message} />
      ))}
    </div>
  )
}
```

### Mutation with Optimistic Update
```tsx
import { useMutation } from '@apollo/client'
import { CREATE_MESSAGE } from '../graphql/mutations'

function CreateMessage() {
  const [createMessage, { loading }] = useMutation(CREATE_MESSAGE, {
    optimisticResponse: {
      createMessage: {
        id: `temp-${Date.now()}`,
        content: newMessage,
        createdAt: new Date().toISOString(),
        user: currentUser,
        __typename: 'Message',
      },
    },
    update: (cache, { data }) => {
      // Update cache with new message
      cacheStrategies.messages.addMessage(cache, data.createMessage)
    },
  })

  const handleSubmit = async (content: string) => {
    await createMessage({
      variables: { input: { content } },
    })
  }

  return <MessageForm onSubmit={handleSubmit} loading={loading} />
}
```

### Real-time Subscriptions
```tsx
import { useSubscription } from '@apollo/client'
import { MESSAGE_ADDED } from '../graphql/subscriptions'

function RealTimeMessages() {
  useSubscription(MESSAGE_ADDED, {
    onData: ({ data }) => {
      // New message automatically added to cache
      console.log('New message:', data.data.messageAdded)
    },
  })

  return <MessagesList />
}
```

### Custom Hook Usage
```tsx
import { useMessages, useCreateMessage } from '../hooks/useGraphQL'

function MessagesPage() {
  const { items: messages, loading, hasMore, loadMore } = useMessages()
  const { createMessage, loading: creating } = useCreateMessage()

  return (
    <div>
      <CreateMessageForm 
        onSubmit={createMessage} 
        loading={creating} 
      />
      <InfiniteScroll
        items={messages}
        loading={loading}
        hasMore={hasMore}
        loadMore={loadMore}
      />
    </div>
  )
}
```

## 🔧 Configuration

### Environment Variables
```bash
# GraphQL Endpoints
VITE_GRAPHQL_URI=http://localhost:3333/graphql
VITE_GRAPHQL_WS_URI=ws://localhost:3333/graphql

# Apollo DevTools (development only)
VITE_APOLLO_DEVTOOLS=true

# Performance Monitoring
VITE_LOG_SLOW_QUERIES=true
VITE_SLOW_QUERY_THRESHOLD=1000
```

### Apollo Client Setup
```tsx
import { ApolloProvider } from '@apollo/client'
import { apolloClient } from './lib/apollo-client'

function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <YourApp />
    </ApolloProvider>
  )
}
```

## 🚀 Performance Features

### Intelligent Caching
- **Normalized Cache**: Automatic entity normalization
- **Field Policies**: Custom merge functions for paginated data
- **Cache Warming**: Pre-load essential data
- **Garbage Collection**: Automatic cleanup of unused cache entries

### Optimistic Updates
- **Immediate Feedback**: UI updates before server response
- **Rollback Support**: Automatic revert on errors
- **Cache Consistency**: Maintains data integrity

### Network Optimization
- **Query Deduplication**: Prevent duplicate requests
- **Automatic Retries**: Smart retry logic for failed requests
- **Batch Queries**: Combine multiple queries when possible
- **Connection Pooling**: Efficient WebSocket management

## 📊 Monitoring & Debugging

### Apollo DevTools
- Query/Mutation inspection
- Cache explorer
- Performance metrics
- Network activity

### Custom Monitoring
```tsx
import { performanceMonitor } from './lib/apollo-config'

// Monitor query performance
const startTime = performanceMonitor.startTimer('GetMessages')
// ... query execution
performanceMonitor.endTimer(startTime, 'GetMessages')
```

### Error Handling
```tsx
import { GraphQLErrorBoundary } from './components/GraphQLErrorBoundary'

function App() {
  return (
    <GraphQLErrorBoundary
      onError={(error, errorInfo) => {
        // Custom error reporting
        console.error('GraphQL Error:', error, errorInfo)
      }}
    >
      <YourApp />
    </GraphQLErrorBoundary>
  )
}
```

## 🔐 Authentication Integration

### Token Management
- **Automatic Headers**: JWT tokens added to requests
- **Token Refresh**: Automatic token renewal
- **Logout Handling**: Cache clearing on logout
- **Session Recovery**: Restore authentication state

### Protected Queries
```tsx
const { data, loading } = useQuery(GET_USER_PROFILE, {
  skip: !isAuthenticated, // Skip if not authenticated
  errorPolicy: 'all',     // Handle auth errors gracefully
})
```

## 📱 Real-time Features

### WebSocket Subscriptions
- **Message Updates**: Live message creation/editing
- **User Status**: Real-time user presence
- **System Alerts**: Admin notifications
- **Automatic Reconnection**: Handle connection drops

### Subscription Management
```tsx
import { useMessageSubscriptions } from './hooks/useGraphQL'

function MessagesPage() {
  const { newMessage, updatedMessage, deletedMessageId } = useMessageSubscriptions()
  
  // Handle real-time updates
  useEffect(() => {
    if (newMessage) {
      // New message received
    }
  }, [newMessage])
}
```

## 🎨 UI Components

### Loading States
- `GraphQLLoading` - Basic spinner with text
- `SkeletonList` - Skeleton placeholders for lists
- `UserProfileSkeleton` - User profile skeleton
- `MessageListSkeleton` - Message list skeleton
- `ProgressiveLoading` - Multi-stage loading indicator

### Error Handling
- `GraphQLErrorBoundary` - Catches and displays GraphQL errors
- Categorized error messages
- Retry and reload options
- Development error details

## 🧪 Testing

### Query Testing
```tsx
import { MockedProvider } from '@apollo/client/testing'
import { GET_MESSAGES } from '../graphql/queries'

const mocks = [
  {
    request: {
      query: GET_MESSAGES,
      variables: { limit: 20 },
    },
    result: {
      data: {
        messages: {
          edges: [/* mock data */],
          pageInfo: { hasNextPage: false, totalCount: 1 },
        },
      },
    },
  },
]

function TestComponent() {
  return (
    <MockedProvider mocks={mocks}>
      <MessagesPage />
    </MockedProvider>
  )
}
```

## 🚀 Next Steps

### Backend Integration
1. **GraphQL Server**: Set up Apollo Server or similar
2. **Schema Definition**: Implement matching server schema
3. **Resolvers**: Create query/mutation/subscription resolvers
4. **Authentication**: JWT middleware for protected operations
5. **Subscriptions**: WebSocket server for real-time features

### Advanced Features
1. **File Uploads**: GraphQL multipart uploads
2. **Offline Support**: Apollo Client offline capabilities
3. **Data Persistence**: IndexedDB for offline cache
4. **Analytics**: Query usage analytics
5. **A/B Testing**: Feature flags with GraphQL

## 📚 Resources

- [Apollo Client Documentation](https://www.apollographql.com/docs/react/)
- [GraphQL Specification](https://graphql.org/learn/)
- [React Apollo Hooks](https://www.apollographql.com/docs/react/api/react/hooks/)
- [Apollo DevTools](https://www.apollographql.com/docs/react/development-testing/developer-tooling/)

---

This GraphQL integration provides a solid foundation for building modern, real-time, and performant React applications with excellent developer experience and user experience.