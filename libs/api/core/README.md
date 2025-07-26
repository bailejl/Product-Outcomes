# API Core Library

This library provides core API functionality including Redis-based session management and monitoring.

## Features

- **Redis Session Management**: Secure, scalable session storage with Redis
- **Concurrent Session Control**: Limit and manage multiple user sessions
- **Session Monitoring**: Real-time monitoring and alerting for session health
- **Automatic Cleanup**: Scheduled cleanup of expired sessions
- **Security Features**: Secure cookie configuration, session invalidation
- **TypeScript Support**: Full TypeScript definitions and type safety

## Installation

```bash
npm install express-session connect-redis redis @types/express-session
```

## Quick Start

### 1. Basic Setup

```typescript
import { SessionManager, createDefaultSessionConfig } from '@product-outcomes/api-core'
import express from 'express'

const app = express()

// Create session manager
const sessionConfig = createDefaultSessionConfig()
const sessionManager = new SessionManager(sessionConfig)

// Initialize and add middleware
async function setupSessions() {
  await sessionManager.initialize()
  app.use(sessionManager.getSessionMiddleware())
}

setupSessions()
```

### 2. With Monitoring

```typescript
import { 
  SessionManager, 
  createDefaultSessionConfig, 
  createSessionMonitor 
} from '@product-outcomes/api-core'

const sessionManager = new SessionManager(createDefaultSessionConfig())
const sessionMonitor = createSessionMonitor(sessionManager)

// Initialize both
await sessionManager.initialize()
sessionMonitor.start()

// Listen for alerts
sessionMonitor.on('alert', (alert) => {
  console.warn(`Session Alert: ${alert.message}`)
})
```

## Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_SESSION_DB=0
REDIS_SESSION_PREFIX=sess:

# Session Configuration
SESSION_SECRET=your-super-secret-session-key
SESSION_NAME=your-app.sid
SESSION_MAX_AGE=86400000
SESSION_SECURE=false
SESSION_SAME_SITE=strict
SESSION_ROLLING=true

# Concurrent Sessions
CONCURRENT_SESSIONS_ENABLED=true
MAX_CONCURRENT_SESSIONS=3
```

### Manual Configuration

```typescript
import { SessionConfig } from '@product-outcomes/api-core'

const config: SessionConfig = {
  secret: 'your-session-secret',
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'redis-password',
    db: 0,
    prefix: 'sess:',
  },
  session: {
    name: 'your-app.sid',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    rolling: true,
    resave: false,
    saveUninitialized: false,
  },
  concurrentSessions: {
    enabled: true,
    maxSessions: 3,
  },
}
```

## Usage Examples

### Session Management in Routes

```typescript
import { Request, Response } from 'express'

// Extend session type
declare module 'express-session' {
  interface SessionData {
    userId?: string
    user?: any
    lastAccess?: number
  }
}

// Login endpoint
app.post('/login', async (req: Request, res: Response) => {
  // Authenticate user...
  const user = await authenticateUser(req.body.email, req.body.password)
  
  // Check concurrent session limits
  await sessionManager.enforceConcurrentSessionLimit(user.id)
  
  // Store in session
  req.session.userId = user.id
  req.session.user = user
  req.session.lastAccess = Date.now()
  
  // Save session
  await new Promise<void>((resolve, reject) => {
    req.session.save((err) => err ? reject(err) : resolve())
  })
  
  res.json({ message: 'Login successful', user })
})

// Logout endpoint
app.post('/logout', async (req: Request, res: Response) => {
  if (req.session.userId) {
    // Invalidate all user sessions
    await sessionManager.invalidateUserSessions(req.session.userId)
  }
  
  // Destroy current session
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' })
    }
    res.clearCookie('your-app.sid')
    res.json({ message: 'Logout successful' })
  })
})
```

### Session Information

```typescript
// Get user's active sessions
app.get('/sessions', async (req: Request, res: Response) => {
  const sessionCount = await sessionManager.getUserSessionCount(req.session.userId)
  
  res.json({
    activeSessions: sessionCount,
    currentSession: {
      id: req.sessionID,
      lastAccess: req.session.lastAccess,
    },
  })
})

// Invalidate all other sessions
app.delete('/sessions', async (req: Request, res: Response) => {
  await sessionManager.invalidateUserSessions(req.session.userId)
  
  // Recreate current session
  req.session.regenerate((err) => {
    if (err) throw err
    req.session.userId = userId
    req.session.save(() => {
      res.json({ message: 'Other sessions invalidated' })
    })
  })
})
```

## Monitoring

### Basic Monitoring

```typescript
import { createSessionMonitor } from '@product-outcomes/api-core'

const monitor = createSessionMonitor(sessionManager, {
  maxTotalSessions: 10000,
  cleanupInterval: 300000, // 5 minutes
  metricsInterval: 60000,  // 1 minute
  alertCooldown: 300000,   // 5 minutes
})

monitor.start()

// Get metrics
const metrics = monitor.getMetrics()
console.log('Session metrics:', metrics)

// Get detailed report
const report = monitor.generateReport()
console.log(report.summary)
```

### Monitoring Events

```typescript
// Alert handling
monitor.on('alert', (alert) => {
  switch (alert.severity) {
    case 'CRITICAL':
      notifyOncall(alert)
      break
    case 'HIGH':
      sendSlackAlert(alert)
      break
    case 'MEDIUM':
      logWarning(alert)
      break
  }
})

// Cleanup events
monitor.on('cleanup:completed', ({ cleanedCount }) => {
  console.log(`Cleaned ${cleanedCount} expired sessions`)
})

// Metrics updates
monitor.on('metrics:updated', (metrics) => {
  updateDashboard(metrics)
})
```

### Manual Operations

```typescript
// Manual cleanup
const cleanedCount = await monitor.triggerCleanup()
console.log(`Manually cleaned ${cleanedCount} sessions`)

// Check for anomalies
const alerts = await monitor.checkSessionAnomalies()
alerts.forEach(alert => console.warn(alert.message))

// Get detailed statistics
const stats = await monitor.getDetailedStats()
console.log('Detailed stats:', stats)
```

## API Reference

### SessionManager

#### Methods

- `initialize()`: Initialize Redis connection
- `getSessionMiddleware()`: Get Express session middleware
- `invalidateUserSessions(userId)`: Invalidate all sessions for a user
- `getUserSessionCount(userId)`: Get active session count for user
- `enforceConcurrentSessionLimit(userId)`: Enforce session limits
- `getSessionStats()`: Get session statistics
- `cleanupExpiredSessions()`: Remove expired sessions
- `close()`: Close Redis connection

### SessionMonitor

#### Methods

- `start()`: Start monitoring
- `stop()`: Stop monitoring
- `getMetrics()`: Get current metrics
- `triggerCleanup()`: Manual cleanup trigger
- `getDetailedStats()`: Get detailed statistics
- `checkSessionAnomalies()`: Check for alerts
- `generateReport()`: Generate monitoring report

#### Events

- `alert`: Session alert triggered
- `cleanup:completed`: Cleanup operation completed
- `metrics:updated`: Metrics refreshed
- `monitor:started`: Monitoring started
- `monitor:stopped`: Monitoring stopped

## Security Best Practices

### 1. Session Configuration

```typescript
const secureConfig = {
  session: {
    secure: true,           // HTTPS only in production
    httpOnly: true,         // Prevent XSS
    sameSite: 'strict',     // CSRF protection
    rolling: true,          // Extend on activity
    maxAge: 30 * 60 * 1000, // 30 minutes
  },
  concurrentSessions: {
    enabled: true,
    maxSessions: 3,         // Limit concurrent sessions
  },
}
```

### 2. Session Invalidation

```typescript
// On password change
await sessionManager.invalidateUserSessions(userId)

// On account deactivation
await sessionManager.invalidateUserSessions(userId)

// On suspicious activity
await sessionManager.invalidateUserSessions(userId)
```

### 3. Monitoring Alerts

```typescript
monitor.on('alert', (alert) => {
  if (alert.type === 'HIGH_SESSION_COUNT') {
    // Potential attack - investigate
    investigateHighSessionCount(alert.metadata)
  }
})
```

## Testing

### Unit Tests

```bash
npm test libs/api/core
```

### Integration Tests

```bash
# Requires Redis running
docker run -d -p 6379:6379 redis:7-alpine
npm run test:integration
```

### Test Utilities

```typescript
import { SessionManager, createDefaultSessionConfig } from '@product-outcomes/api-core'

// Create test session manager
const testConfig = createDefaultSessionConfig()
testConfig.redis.db = 15 // Use separate DB for tests
const testSessionManager = new SessionManager(testConfig)
```

## Production Deployment

### 1. Redis Configuration

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
```

### 2. Environment Setup

```bash
# Production environment
NODE_ENV=production
SESSION_SECRET=your-256-bit-secret-key
SESSION_SECURE=true
REDIS_HOST=redis.production.com
REDIS_PASSWORD=secure-redis-password
CONCURRENT_SESSIONS_ENABLED=true
MAX_CONCURRENT_SESSIONS=5
```

### 3. Monitoring Setup

```typescript
// Production monitoring
const monitor = createSessionMonitor(sessionManager, {
  maxTotalSessions: 50000,
  cleanupInterval: 300000,    // 5 minutes
  metricsInterval: 30000,     // 30 seconds
  alertCooldown: 300000,      // 5 minutes
})

// Connect to alerting system
monitor.on('alert', (alert) => {
  if (alert.severity === 'CRITICAL') {
    pagerDuty.trigger(alert)
  } else {
    slack.sendAlert(alert)
  }
})
```

## Troubleshooting

### Common Issues

1. **Redis Connection Fails**
   ```
   Error: Redis client not initialized
   ```
   - Check Redis server is running
   - Verify connection parameters
   - Check network connectivity

2. **High Memory Usage**
   ```
   Warning: High percentage of expired sessions
   ```
   - Increase cleanup frequency
   - Reduce session timeout
   - Check for session leaks

3. **Session Not Persisting**
   - Verify Redis is properly connected
   - Check session middleware order
   - Ensure session.save() is called

### Debug Mode

```typescript
// Enable debug logging
process.env.DEBUG = 'express-session'

// Monitor Redis commands
sessionManager.on('redis:command', (command) => {
  console.log('Redis command:', command)
})
```

## License

MIT License - see LICENSE file for details.