# Product Outcomes - Observability & Monitoring Guide

This guide explains how to use the comprehensive observability system implemented for the Product Outcomes application.

## 🚀 Quick Start

### Start Monitoring Stack
```bash
# Start all monitoring services
npm run monitoring:start

# Start application with monitoring
npm run dev:with-monitoring

# Check monitoring status
npm run monitoring:status
```

### Stop Monitoring Stack
```bash
# Stop monitoring services
npm run monitoring:stop
```

## 📊 Monitoring Components

### 1. Prometheus (Port 9090)
- **URL**: http://localhost:9090
- **Purpose**: Metrics collection and storage
- **Metrics Endpoints**:
  - API Metrics: http://localhost:3333/api/metrics
  - Business Metrics: http://localhost:3333/api/business-metrics
  - Health Metrics: http://localhost:3333/api/health-metrics

### 2. Grafana (Port 3001)
- **URL**: http://localhost:3001
- **Credentials**: admin/admin123
- **Dashboards**:
  - Business Metrics: OKR progress, user activity, organization metrics
  - Technical Metrics: API performance, database, system resources
  - Custom dashboards for specific use cases

### 3. AlertManager (Port 9093)
- **URL**: http://localhost:9093
- **Purpose**: Alert routing and notification management
- **Features**:
  - Email notifications
  - Webhook integration
  - Alert grouping and suppression

### 4. Jaeger (Port 16686)
- **URL**: http://localhost:16686
- **Purpose**: Distributed tracing
- **Features**:
  - Request tracing across services
  - Performance bottleneck identification
  - Dependency mapping

### 5. Node Exporter (Port 9100)
- **URL**: http://localhost:9100
- **Purpose**: System metrics collection
- **Metrics**: CPU, memory, disk, network

## 📈 Available Metrics

### API Performance Metrics
- Request rate and duration
- Error rates by endpoint
- Response time percentiles
- User and organization segmentation

### Business Metrics
- OKR creation and completion rates
- User registration and activity
- Organization growth metrics
- Feature usage analytics

### System Metrics
- CPU and memory usage
- Database connection pools
- Redis operations
- WebSocket connections

### Frontend Metrics (Web & Mobile)
- Page load times
- User interactions
- Error tracking
- Performance metrics (LCP, FID, CLS)

## 🎯 SLI/SLO Monitoring

### Service Level Indicators (SLIs)
- **API Availability**: 99.9% uptime target
- **API Latency**: 95% of requests < 500ms
- **Error Rate**: < 1% error rate
- **Database Performance**: 95% of queries < 200ms

### Service Level Objectives (SLOs)
See `monitoring/sli-slo/service-levels.yml` for complete configuration.

### User Journey Monitoring
- User Registration Flow
- OKR Creation Process
- Dashboard Loading Performance

## 🚨 Alerting

### Alert Severity Levels
- **Critical**: Immediate response required (API down, high error rates)
- **Warning**: Investigation needed (performance degradation)
- **Info**: Awareness notifications (business metrics)

### Alert Routing
- **Critical Alerts**: admin@product-outcomes.com
- **Warning Alerts**: devops@product-outcomes.com
- **Business Alerts**: business@product-outcomes.com

### Error Budget Policies
- 50% budget consumed: Team alert
- 80% budget consumed: Page on-call
- 100% budget consumed: Halt deployments

## 🔧 Configuration Files

### Prometheus Configuration
- Main config: `monitoring/prometheus/prometheus.yml`
- Alert rules: `monitoring/prometheus/rules/alerts.yml`

### Grafana Configuration
- Datasources: `monitoring/grafana/datasources/`
- Dashboards: `monitoring/grafana/dashboards/`

### AlertManager Configuration
- Config: `monitoring/alertmanager/alertmanager.yml`

## 📱 Frontend Metrics Integration

### Web Application
```typescript
import { webMetrics } from './utils/metrics';

// Set user context
webMetrics.setUserContext('user123', 'org456');

// Record page views
webMetrics.recordPageView('/dashboard');

// Record business events
webMetrics.recordBusinessEvent('okr_created', { okrId: 'okr123' });

// Custom timing
const timer = webMetrics.startTimer('data_fetch');
// ... perform operation
timer(); // Records timing
```

### Mobile Application
```typescript
import { mobileMetrics } from './utils/metrics';

// Set user context
mobileMetrics.setUserContext('user123', 'org456');

// Record screen views
mobileMetrics.recordScreenView('DashboardScreen');

// Record user interactions
mobileMetrics.recordButtonPress('createOKR', 'DashboardScreen');

// Record business events
mobileMetrics.recordOKREvent('create', 'okr123');
```

## 🐛 Debugging & Troubleshooting

### Check Metrics Collection
```bash
# Test metrics endpoint
npm run metrics:test

# View detailed metrics
curl http://localhost:3333/api/metrics
```

### View Logs
```bash
# View all monitoring logs
npm run monitoring:logs

# View specific service logs
docker-compose -f docker-compose.monitoring.yml logs prometheus
docker-compose -f docker-compose.monitoring.yml logs grafana
```

### Common Issues

1. **Metrics not appearing in Prometheus**
   - Check API is running: http://localhost:3333/api/health
   - Verify metrics endpoint: http://localhost:3333/api/metrics
   - Check Prometheus targets: http://localhost:9090/targets

2. **Grafana dashboards empty**
   - Verify Prometheus datasource connection
   - Check query syntax in dashboard panels
   - Ensure metrics are being generated

3. **Alerts not firing**
   - Check AlertManager configuration
   - Verify alert rules in Prometheus
   - Test alert conditions manually

## 🚀 Advanced Usage

### Custom Metrics
Add custom metrics in your application code:

```typescript
import metricsService from './metrics/MetricsService';

// Business metrics
metricsService.recordOKRCreation('org123', 'Q1-2024', 'objective');
metricsService.updateOKRProgress('okr123', 'org123', 'user123', 75);

// Technical metrics
metricsService.recordDatabaseQuery('SELECT', 'users', 0.025);
metricsService.recordRedisOperation('GET', 'success', 0.002);
```

### Custom Dashboards
1. Open Grafana: http://localhost:3001
2. Create new dashboard
3. Add panels with PromQL queries
4. Save dashboard to `monitoring/grafana/dashboards/`

### Custom Alerts
1. Edit `monitoring/prometheus/rules/alerts.yml`
2. Add new alert rules
3. Restart Prometheus: `docker-compose -f docker-compose.monitoring.yml restart prometheus`

## 📚 Best Practices

### Metrics Naming
- Use consistent prefixes: `product_outcomes_*`
- Include relevant labels: `user_id`, `organization_id`
- Follow Prometheus naming conventions

### Dashboard Design
- Focus on key business metrics
- Use appropriate visualization types
- Include SLI/SLO indicators
- Add meaningful descriptions

### Alert Design
- Avoid alert fatigue
- Focus on actionable alerts
- Include clear descriptions
- Test alert conditions

## 🔐 Security Considerations

- Metrics endpoints don't expose sensitive data
- User IDs are hashed in logs
- Dashboard access is restricted
- Alert messages are sanitized

## 📈 Performance Impact

- Minimal overhead (~1-2% CPU)
- Metrics collection is asynchronous
- Configurable retention periods
- Efficient aggregation strategies

## 🤝 Contributing

When adding new features:
1. Add relevant metrics
2. Create dashboard panels
3. Define SLIs/SLOs if applicable
4. Add alerting rules
5. Update documentation

## 📞 Support

For monitoring issues:
1. Check this documentation
2. View service logs
3. Contact the DevOps team
4. Create GitHub issue with monitoring label