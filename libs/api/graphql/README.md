# GraphQL API Library

A comprehensive GraphQL API implementation for the Product Outcomes platform using Apollo Server v4 and TypeGraphQL.

## Features

- **Modern Apollo Server v4** - Latest version with improved performance and developer experience
- **Type-Safe Schema** - Generated using TypeGraphQL with full TypeScript support
- **Authentication & Authorization** - JWT-based auth with role-based access control (RBAC)
- **DataLoader Integration** - Efficient data loading with automatic batching and caching
- **Comprehensive Error Handling** - Custom error types and proper GraphQL error formatting
- **Real-time Subscriptions** - WebSocket support for live updates (ready for implementation)

## Architecture

### Schema Definition
- **Type-first approach** using TypeGraphQL decorators
- **Modular types** organized by domain (User, Organization, OKR)
- **Input validation** with class-validator integration
- **Computed fields** and field resolvers for complex data

### Authentication & Authorization
- **JWT token validation** integrated with existing auth system
- **Session-based authentication** compatible with Express sessions
- **Role-based decorators** (`@AdminOnly`, `@RequireRole`, `@RequirePermission`)
- **Resource-based authorization** for fine-grained access control

### Data Loading
- **DataLoader pattern** implemented for N+1 query prevention
- **Batch loading** for users, organizations, and relationships
- **Automatic caching** per request with cache invalidation

## Usage

### Setup
```typescript
import { GraphQLServerManager } from '@product-outcomes/api-graphql'

const graphqlServer = new GraphQLServerManager({
  introspection: true,
  playground: true,
})

await graphqlServer.initialize()
app.use('/graphql', graphqlServer.getMiddleware())
```

### Available Operations

#### Authentication
```graphql
# Login
mutation {
  login(input: { email: "user@example.com", password: "password" }) {
    success
    auth {
      user { id email firstName lastName }
      token
      expiresAt
    }
  }
}

# Register
mutation {
  register(input: {
    email: "new@example.com"
    password: "password"
    firstName: "John"
    lastName: "Doe"
  }) {
    success
    auth {
      user { id email }
      token
    }
  }
}

# Current user
query {
  currentUser {
    id
    email
    fullName
    roles { name permissions }
    isAdmin
  }
}
```

#### User Management
```graphql
# Get users with pagination and filtering
query {
  users(
    pagination: { first: 10 }
    filter: { search: "john", isActive: true }
    sort: { field: "createdAt", direction: DESC }
  ) {
    edges {
      node {
        id
        fullName
        email
        roles { name }
      }
    }
    pageInfo {
      hasNextPage
      totalCount
    }
  }
}

# Update user
mutation {
  updateUser(input: {
    id: "user-id"
    firstName: "Updated"
    lastName: "Name"
  }) {
    id
    fullName
  }
}
```

#### OKR Management
```graphql
# Create OKR
mutation {
  createOKR(input: {
    title: "Increase Product Adoption"
    description: "Grow user base and engagement"
    period: QUARTERLY
    startDate: "2024-01-01"
    endDate: "2024-03-31"
    keyResults: [
      {
        title: "Acquire 1000 new users"
        target: 1000
        unit: "users"
      }
    ]
  }) {
    id
    title
    keyResults {
      id
      title
      progress
    }
  }
}

# Get OKRs with filtering
query {
  okrs(
    filter: { status: ACTIVE, ownerId: "user-id" }
    sort: { field: "startDate", direction: DESC }
  ) {
    edges {
      node {
        id
        title
        progress
        keyResults {
          title
          current
          target
          progress
        }
      }
    }
  }
}
```

## Error Handling

The GraphQL API provides comprehensive error handling:

- **Authentication errors** - Thrown when user is not authenticated
- **Authorization errors** - Thrown when user lacks required permissions
- **Validation errors** - Input validation with detailed field-level errors
- **Business logic errors** - Domain-specific errors with meaningful messages

Example error response:
```json
{
  "errors": [
    {
      "message": "Access denied. Required permission: user:update",
      "extensions": {
        "code": "FORBIDDEN",
        "path": ["updateUser"]
      }
    }
  ]
}
```

## Development

### GraphQL Playground
When running in development mode, GraphQL Playground is available at `/graphql` for interactive schema exploration and query testing.

### Schema Generation
The schema is automatically built from TypeGraphQL decorators. In development mode, a `schema.graphql` file is generated for reference.

### Testing
```bash
npm run test libs/api/graphql
```

## Integration

### With Existing Auth System
The GraphQL API integrates seamlessly with the existing authentication system:
- Uses the same JWT tokens and session management
- Leverages existing user entities and RBAC system
- Compatible with current password reset and email verification flows

### With DataLoaders
Automatic prevention of N+1 queries:
```typescript
// Instead of multiple database queries
const users = await Promise.all(
  organizationIds.map(id => loadUsersByOrganization(id))
)

// DataLoader batches these into a single query
const users = await dataloaders.usersByOrganizationId.loadMany(organizationIds)
```

## Performance

- **Query batching** - Multiple operations in a single request
- **Automatic caching** - DataLoader caching per request
- **Efficient pagination** - Cursor-based pagination for large datasets
- **Field selection** - Only requested fields are resolved

## Security

- **Query complexity analysis** - Prevents overly complex queries
- **Rate limiting** - Integrated with existing rate limiting middleware
- **Input sanitization** - Automatic escaping and validation
- **Permission checks** - Every operation checks user permissions

## Future Enhancements

- **Subscriptions** - Real-time updates for OKRs and notifications
- **File uploads** - GraphQL file upload for user avatars and documents
- **Query optimization** - Advanced query analysis and optimization
- **Caching layer** - Redis-based caching for frequently accessed data