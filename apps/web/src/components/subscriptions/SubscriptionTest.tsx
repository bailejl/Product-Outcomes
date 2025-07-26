import React, { useState, useEffect } from 'react'
import { useGraphQLSubscriptions } from '../../hooks/useGraphQLSubscriptions'

interface SubscriptionTestProps {
  organizationId?: string
  okrId?: string
  userId?: string
}

export const SubscriptionTest: React.FC<SubscriptionTestProps> = ({
  organizationId = '123e4567-e89b-12d3-a456-426614174000',
  okrId = '123e4567-e89b-12d3-a456-426614174001',
  userId = '123e4567-e89b-12d3-a456-426614174002',
}) => {
  const { subscribe, unsubscribe, isConnected, connectionError, activeSubscriptions } = useGraphQLSubscriptions()
  const [messages, setMessages] = useState<any[]>([])
  const [testQuery, setTestQuery] = useState('')

  // Test subscription queries
  const testQueries = {
    okrUpdated: `
      subscription OKRUpdated($okrId: ID) {
        okrUpdated(okrId: $okrId) {
          id
          title
          status
          progress
          updatedAt
          owner {
            id
            fullName
          }
        }
      }
    `,
    progressChanged: `
      subscription OKRProgressChanged($organizationId: ID) {
        okrProgressChanged(organizationId: $organizationId) {
          id
          title
          progress
          progressPercentage
          owner {
            id
            fullName
          }
        }
      }
    `,
    newOKR: `
      subscription NewOKRCreated($organizationId: ID) {
        newOKRCreated(organizationId: $organizationId) {
          id
          title
          owner {
            id
            fullName
          }
          createdAt
        }
      }
    `,
    newComment: `
      subscription NewComment($okrId: ID) {
        newComment(okrId: $okrId) {
          id
          content
          type
          author {
            id
            fullName
          }
          createdAt
        }
      }
    `,
    userActivity: `
      subscription UserActivity($organizationId: ID) {
        userActivity(organizationId: $organizationId) {
          userId
          user {
            id
            fullName
          }
          action
          resourceType
          resourceId
          timestamp
          metadata
        }
      }
    `,
    notifications: `
      subscription SystemNotification($userId: ID) {
        systemNotification(userId: $userId) {
          id
          type
          title
          message
          priority
          createdAt
          metadata
        }
      }
    `,
  }

  const handleSubscribe = (queryName: string) => {
    const query = testQueries[queryName as keyof typeof testQueries]
    if (!query) return

    let variables = {}
    if (queryName.includes('organizationId')) {
      variables = { organizationId }
    } else if (queryName.includes('okrId')) {
      variables = { okrId }
    } else if (queryName.includes('userId')) {
      variables = { userId }
    }

    const subscriptionId = `test-${queryName}`
    
    subscribe(
      subscriptionId,
      { query, variables },
      (data) => {
        const timestamp = new Date().toLocaleTimeString()
        setMessages(prev => [{
          id: Date.now(),
          timestamp,
          type: queryName,
          data,
          subscriptionId,
        }, ...prev.slice(0, 99)]) // Keep last 100 messages
      },
      (error) => {
        const timestamp = new Date().toLocaleTimeString()
        setMessages(prev => [{
          id: Date.now(),
          timestamp,
          type: 'error',
          error: error.message,
          subscriptionId,
        }, ...prev.slice(0, 99)])
      }
    )
  }

  const handleUnsubscribe = (subscriptionId: string) => {
    unsubscribe(subscriptionId)
    setMessages(prev => prev.filter(msg => msg.subscriptionId !== subscriptionId))
  }

  const clearMessages = () => {
    setMessages([])
  }

  const testCustomQuery = () => {
    if (!testQuery.trim()) return

    const subscriptionId = `custom-${Date.now()}`
    
    subscribe(
      subscriptionId,
      { query: testQuery },
      (data) => {
        const timestamp = new Date().toLocaleTimeString()
        setMessages(prev => [{
          id: Date.now(),
          timestamp,
          type: 'custom',
          data,
          subscriptionId,
        }, ...prev.slice(0, 99)])
      },
      (error) => {
        const timestamp = new Date().toLocaleTimeString()
        setMessages(prev => [{
          id: Date.now(),
          timestamp,
          type: 'error',
          error: error.message,
          subscriptionId,
        }, ...prev.slice(0, 99)])
      }
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">GraphQL Subscription Test</h1>
        
        {/* Connection Status */}
        <div className="mb-6 p-4 rounded-lg bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="font-medium">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
              <span className="text-sm text-gray-600">
                Active: {activeSubscriptions}
              </span>
            </div>
            {connectionError && (
              <div className="text-red-600 text-sm">
                Error: {connectionError.message}
              </div>
            )}
          </div>
        </div>

        {/* Test Configuration */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Test Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">Organization ID:</span>
              <br />
              <code className="text-blue-600">{organizationId}</code>
            </div>
            <div>
              <span className="font-medium">OKR ID:</span>
              <br />
              <code className="text-blue-600">{okrId}</code>
            </div>
            <div>
              <span className="font-medium">User ID:</span>
              <br />
              <code className="text-blue-600">{userId}</code>
            </div>
          </div>
        </div>

        {/* Subscription Controls */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {Object.keys(testQueries).map((queryName) => (
            <button
              key={queryName}
              onClick={() => handleSubscribe(queryName)}
              disabled={!isConnected}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
            >
              Subscribe: {queryName}
            </button>
          ))}
        </div>

        {/* Custom Query Test */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">Test Custom Query</h3>
          <textarea
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            placeholder="Enter GraphQL subscription query..."
            className="w-full h-32 p-3 border border-gray-300 rounded-lg font-mono text-sm"
          />
          <div className="mt-2 flex space-x-2">
            <button
              onClick={testCustomQuery}
              disabled={!isConnected || !testQuery.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
            >
              Test Custom Query
            </button>
            <button
              onClick={() => setTestQuery('')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Subscription Messages ({messages.length})</h3>
            <button
              onClick={clearMessages}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Clear Messages
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No messages yet</p>
                <p className="text-sm">Subscribe to start receiving real-time updates</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`p-3 rounded-lg border ${
                    message.type === 'error'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`
                          px-2 py-1 rounded text-xs font-medium
                          ${message.type === 'error'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                          }
                        `}>
                          {message.type}
                        </span>
                        <span className="text-xs text-gray-600">{message.timestamp}</span>
                      </div>
                      
                      {message.error ? (
                        <div className="text-red-600 text-sm font-mono">
                          {message.error}
                        </div>
                      ) : (
                        <pre className="text-sm text-gray-900 font-mono whitespace-pre-wrap overflow-x-auto">
                          {JSON.stringify(message.data, null, 2)}
                        </pre>
                      )}
                    </div>
                    
                    <button
                      onClick={() => handleUnsubscribe(message.subscriptionId)}
                      className="ml-2 px-2 py-1 text-xs text-red-600 hover:text-red-800"
                    >
                      Unsubscribe
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}