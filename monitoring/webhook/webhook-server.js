const express = require('express')
const app = express()
const port = process.env.PORT || 3001

app.use(express.json())

// Webhook authentication middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (token !== 'webhook-secret-token') {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// Log all incoming webhooks
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
  next()
})

// Format alert message for different platforms
const formatAlert = (alert, platform = 'general') => {
  const emoji = {
    critical: '🚨',
    warning: '⚠️',
    info: 'ℹ️',
    resolved: '✅'
  }
  
  const severity = alert.labels?.severity || 'info'
  const status = alert.status || 'firing'
  const icon = status === 'resolved' ? emoji.resolved : emoji[severity]
  
  const baseMessage = {
    alert: alert.annotations?.summary || 'Unknown alert',
    description: alert.annotations?.description || 'No description provided',
    severity: severity.toUpperCase(),
    status: status.toUpperCase(),
    instance: alert.labels?.instance || 'Unknown',
    timestamp: alert.startsAt || new Date().toISOString(),
    generatorURL: alert.generatorURL
  }
  
  if (platform === 'slack') {
    return {
      username: 'Product Outcomes Monitor',
      icon_emoji: ':warning:',
      attachments: [{
        color: status === 'resolved' ? 'good' : severity === 'critical' ? 'danger' : 'warning',
        title: `${icon} ${baseMessage.alert}`,
        text: baseMessage.description,
        fields: [
          { title: 'Severity', value: baseMessage.severity, short: true },
          { title: 'Status', value: baseMessage.status, short: true },
          { title: 'Instance', value: baseMessage.instance, short: true },
          { title: 'Time', value: new Date(baseMessage.timestamp).toLocaleString(), short: true }
        ],
        footer: 'Product Outcomes Monitoring',
        ts: Math.floor(new Date(baseMessage.timestamp).getTime() / 1000)
      }]
    }
  }
  
  if (platform === 'teams') {
    return {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: baseMessage.alert,
      themeColor: status === 'resolved' ? '00FF00' : severity === 'critical' ? 'FF0000' : 'FFA500',
      sections: [{
        activityTitle: `${icon} ${baseMessage.alert}`,
        activitySubtitle: `Severity: ${baseMessage.severity} | Status: ${baseMessage.status}`,
        text: baseMessage.description,
        facts: [
          { name: 'Instance', value: baseMessage.instance },
          { name: 'Time', value: new Date(baseMessage.timestamp).toLocaleString() },
          { name: 'Severity', value: baseMessage.severity },
          { name: 'Status', value: baseMessage.status }
        ]
      }],
      potentialAction: baseMessage.generatorURL ? [{
        '@type': 'OpenUri',
        name: 'View in Prometheus',
        targets: [{ os: 'default', uri: baseMessage.generatorURL }]
      }] : []
    }
  }
  
  return baseMessage
}

// Send notification to external services
const sendNotification = async (alerts, type = 'general') => {
  const promises = []
  
  // Send to Slack if configured
  if (process.env.SLACK_WEBHOOK_URL) {
    for (const alert of alerts) {
      const slackMessage = formatAlert(alert, 'slack')
      promises.push(
        fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackMessage)
        }).catch(err => console.error('Slack webhook error:', err))
      )
    }
  }
  
  // Send to Microsoft Teams if configured
  if (process.env.TEAMS_WEBHOOK_URL) {
    for (const alert of alerts) {
      const teamsMessage = formatAlert(alert, 'teams')
      promises.push(
        fetch(process.env.TEAMS_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(teamsMessage)
        }).catch(err => console.error('Teams webhook error:', err))
      )
    }
  }
  
  // Send to custom webhook if configured
  if (process.env.CUSTOM_WEBHOOK_URL) {
    const customPayload = {
      alerts: alerts.map(alert => formatAlert(alert)),
      type,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    }
    
    promises.push(
      fetch(process.env.CUSTOM_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customPayload)
      }).catch(err => console.error('Custom webhook error:', err))
    )
  }
  
  await Promise.allSettled(promises)
}

// Store alerts for status page
const alertsStore = {
  alerts: [],
  maxAlerts: 100,
  
  add(alerts) {
    const timestamp = new Date().toISOString()
    alerts.forEach(alert => {
      this.alerts.unshift({
        ...alert,
        receivedAt: timestamp
      })
    })
    
    // Keep only the most recent alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(0, this.maxAlerts)
    }
  },
  
  getRecent(limit = 20) {
    return this.alerts.slice(0, limit)
  },
  
  getActive() {
    return this.alerts.filter(alert => alert.status === 'firing')
  }
}

// Main webhook endpoint
app.post('/webhook', authenticate, async (req, res) => {
  try {
    const { alerts = [] } = req.body
    
    console.log(`Received ${alerts.length} alerts`)
    alerts.forEach(alert => {
      console.log(`- ${alert.status}: ${alert.annotations?.summary} (${alert.labels?.severity})`)
    })
    
    // Store alerts
    alertsStore.add(alerts)
    
    // Send notifications
    await sendNotification(alerts, 'general')
    
    res.json({ 
      status: 'ok', 
      processed: alerts.length,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Webhook processing error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Critical alerts endpoint
app.post('/webhook/critical', authenticate, async (req, res) => {
  try {
    const { alerts = [] } = req.body
    
    console.log(`🚨 CRITICAL: Received ${alerts.length} critical alerts`)
    alerts.forEach(alert => {
      console.log(`🚨 CRITICAL: ${alert.annotations?.summary}`)
    })
    
    alertsStore.add(alerts)
    await sendNotification(alerts, 'critical')
    
    res.json({ 
      status: 'critical_processed', 
      processed: alerts.length,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Critical webhook error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Warning alerts endpoint
app.post('/webhook/warning', authenticate, async (req, res) => {
  try {
    const { alerts = [] } = req.body
    
    console.log(`⚠️ WARNING: Received ${alerts.length} warning alerts`)
    alertsStore.add(alerts)
    await sendNotification(alerts, 'warning')
    
    res.json({ 
      status: 'warning_processed', 
      processed: alerts.length,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Warning webhook error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Database alerts endpoint
app.post('/webhook/database', authenticate, async (req, res) => {
  try {
    const { alerts = [] } = req.body
    
    console.log(`🗄️ DATABASE: Received ${alerts.length} database alerts`)
    alertsStore.add(alerts)
    await sendNotification(alerts, 'database')
    
    res.json({ 
      status: 'database_processed', 
      processed: alerts.length,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Database webhook error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Application alerts endpoint
app.post('/webhook/application', authenticate, async (req, res) => {
  try {
    const { alerts = [] } = req.body
    
    console.log(`🚀 APPLICATION: Received ${alerts.length} application alerts`)
    alertsStore.add(alerts)
    await sendNotification(alerts, 'application')
    
    res.json({ 
      status: 'application_processed', 
      processed: alerts.length,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Application webhook error:', error)
    res.status(500).json({ error: error.message })
  }
})

// API endpoints for status page
app.get('/api/alerts', (req, res) => {
  const limit = parseInt(req.query.limit) || 20
  res.json({
    alerts: alertsStore.getRecent(limit),
    total: alertsStore.alerts.length,
    active: alertsStore.getActive().length
  })
})

app.get('/api/alerts/active', (req, res) => {
  res.json({
    alerts: alertsStore.getActive(),
    count: alertsStore.getActive().length
  })
})

app.get('/api/status', (req, res) => {
  const activeAlerts = alertsStore.getActive()
  const criticalAlerts = activeAlerts.filter(alert => alert.labels?.severity === 'critical')
  const warningAlerts = activeAlerts.filter(alert => alert.labels?.severity === 'warning')
  
  let status = 'operational'
  if (criticalAlerts.length > 0) {
    status = 'critical'
  } else if (warningAlerts.length > 0) {
    status = 'degraded'
  }
  
  res.json({
    status,
    active_alerts: activeAlerts.length,
    critical_alerts: criticalAlerts.length,
    warning_alerts: warningAlerts.length,
    last_updated: new Date().toISOString()
  })
})

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    alerts_stored: alertsStore.alerts.length
  })
})

app.listen(port, () => {
  console.log(`🔔 Webhook server listening on port ${port}`)
  console.log(`📊 Status API available at http://localhost:${port}/api/status`)
  console.log(`🚨 Alerts API available at http://localhost:${port}/api/alerts`)
  console.log(`💚 Health check at http://localhost:${port}/health`)
})