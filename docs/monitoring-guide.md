# Monitoring and Error Tracking Guide

This guide covers the comprehensive logging and error tracking implementation for the Product Outcomes application.

## Overview

The monitoring system includes:

- **Winston** for structured logging with multiple transports
- **Sentry** for error tracking across backend, frontend, and mobile
- **Request/Response logging** with correlation IDs
- **GraphQL performance monitoring**
- **Error boundaries** with recovery mechanisms
- **Log aggregation** with rotation policies

## Configuration

### Environment Variables

```bash
# Logging
LOG_LEVEL=info

# Sentry Error Tracking
SENTRY_DSN=your_sentry_dsn_here
SENTRY_RELEASE=1.0.0
SENTRY_SAMPLE_RATE=1.0
SENTRY_PROFILES_SAMPLE_RATE=0.1
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### Winston Logger Configuration

The logger is configured with multiple transports:

- **Console**: For development with colorized output
- **Combined logs**: All log levels with daily rotation (7 days)
- **Error logs**: Error level only with daily rotation (14 days)
- **HTTP logs**: Request/response logs with daily rotation (3 days)
- **GraphQL logs**: GraphQL operation logs with daily rotation (3 days)

#### Log Levels

- `error`: Application errors that need immediate attention
- `warn`: Warning conditions that should be monitored
- `info`: General operational messages
- `http`: HTTP request/response logs
- `debug`: Detailed debug information

### Sentry Integration

Sentry is configured for comprehensive error tracking:

#### Backend (Node.js)
- Automatic error capture with context
- Performance monitoring for GraphQL operations
- Custom breadcrumbs for request flow
- User context tracking

#### Frontend (React)
- Error boundaries with retry mechanisms
- User-friendly error messages
- Source map support for better debugging
- Performance tracking

#### Mobile (React Native)
- Native crash reporting
- JavaScript error capture
- Gluestack UI error boundaries
- Context-aware error display

## Features

### Request Logging

Every HTTP request is logged with:

- Correlation ID for request tracing
- User context (if authenticated)
- Request/response timing
- Request body (sanitized)
- Response status codes
- Error details

### GraphQL Monitoring

GraphQL operations are monitored for:

- Query/mutation performance
- Operation complexity
- Field-level resolver timing
- Error tracking with context
- Slow query detection

### Error Boundaries

React and React Native error boundaries provide:

- Automatic error capture
- Retry mechanisms with exponential backoff
- User-friendly error messages
- Error details in development
- Graceful degradation

### Log Rotation

Logs are automatically rotated with:

- Daily rotation by default
- Configurable retention periods
- Automatic compression of old logs
- Size-based rotation as backup

## Usage

### Backend Logging

```typescript
import { logger, createRequestLogger } from './config/logger'

// Basic logging
logger.info('Operation completed', { userId: '123', operation: 'createOKR' })
logger.error('Database connection failed', error)

// Request-specific logging
const requestLogger = createRequestLogger(req)
requestLogger.info('Processing request', { additionalData: 'value' })
```

### Frontend Error Boundaries

```tsx
import { ErrorBoundary, PageErrorBoundary } from './components/ErrorBoundary'

// Page-level error boundary
<PageErrorBoundary>
  <MyPage />
</PageErrorBoundary>

// Component-level error boundary
<ErrorBoundary level="component" showErrorDetails={false}>
  <MyComponent />
</ErrorBoundary>
```

### Mobile Error Boundaries

```tsx
import { ScreenErrorBoundary, ComponentErrorBoundary } from './components/ErrorBoundary'

// Screen-level error boundary
<ScreenErrorBoundary>
  <MyScreen />
</ScreenErrorBoundary>

// Component-level error boundary  
<ComponentErrorBoundary>
  <MyComponent />
</ComponentErrorBoundary>
```

### GraphQL Error Handling

```typescript
import { formatGraphQLErrorWithLogging, enhanceGraphQLContext } from './middleware/graphqlLogger'

// In GraphQL server setup
const server = new ApolloServer({
  formatError: formatGraphQLErrorWithLogging,
  context: ({ req }) => enhanceGraphQLContext({ req }),
})
```

## Monitoring Dashboards

### Log Analysis

Logs are structured in JSON format for easy analysis:

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "info",
  "message": "User login successful",
  "service": "product-outcomes-api",
  "correlationId": "uuid-here",
  "userId": "user123",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "responseTime": 150
}
```

### Sentry Dashboard

Access your Sentry dashboard to view:

- Error trends and frequency
- Performance metrics
- User impact analysis
- Release tracking
- Alert configuration

## Troubleshooting

### Common Issues

1. **High log volume**: Adjust `LOG_LEVEL` to `warn` or `error` in production
2. **Missing correlation IDs**: Ensure `correlationIdMiddleware` is applied early
3. **Sentry quota exceeded**: Adjust sample rates in environment variables
4. **Large log files**: Check rotation configuration and retention policies

### Performance Considerations

- Log sampling in high-traffic environments
- Async logging to prevent blocking
- Efficient serialization of large objects
- Regular log cleanup and archival

## Development vs Production

### Development
- Enhanced error details in error boundaries
- Full request/response logging
- Console output with colors
- Detailed stack traces

### Production
- Sanitized error messages
- Reduced log levels
- File-only logging
- Error aggregation and alerting

## Security

- Sensitive fields are automatically redacted
- Request bodies are sanitized
- Error messages don't expose internal details
- Correlation IDs for secure debugging

## Alerting

Configure alerts in Sentry for:
- High error rates
- Performance degradation
- New error types
- User impact thresholds