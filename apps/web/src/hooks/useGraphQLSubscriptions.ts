import { useEffect, useRef, useCallback, useState } from 'react'
import { createClient, Client, SubscribePayload } from 'graphql-ws'

// WebSocket client configuration
const createWSClient = () => {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3333/graphql'
  
  return createClient({
    url: wsUrl,
    connectionParams: () => {
      // Get auth token from localStorage or context
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken')
      return {
        authorization: token ? `Bearer ${token}` : undefined,
      }
    },
    retryAttempts: 5,
    shouldRetry: () => true,
    keepAlive: 30000, // 30 seconds
    lazy: true,
    on: {
      connecting: () => console.log('🔌 Connecting to GraphQL WebSocket...'),
      opened: () => console.log('✅ GraphQL WebSocket connected'),
      closed: () => console.log('🔌 GraphQL WebSocket disconnected'),
      error: (error) => console.error('❌ GraphQL WebSocket error:', error),
    },
  })
}

// Hook for managing WebSocket subscriptions
export const useGraphQLSubscriptions = () => {
  const clientRef = useRef<Client | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<Error | null>(null)
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map())

  // Initialize WebSocket client
  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = createWSClient()
      
      // Setup connection event listeners
      const client = clientRef.current
      
      client.on('connecting', () => {
        setIsConnected(false)
        setConnectionError(null)
      })
      
      client.on('opened', () => {
        setIsConnected(true)
        setConnectionError(null)
      })
      
      client.on('closed', () => {
        setIsConnected(false)
      })
      
      client.on('error', (error) => {
        setConnectionError(error as Error)
        setIsConnected(false)
      })
    }

    return () => {
      // Cleanup all subscriptions
      subscriptionsRef.current.forEach(unsubscribe => unsubscribe())
      subscriptionsRef.current.clear()
      
      if (clientRef.current) {
        clientRef.current.dispose()
        clientRef.current = null
      }
    }
  }, [])

  // Subscribe to a GraphQL subscription
  const subscribe = useCallback((
    subscriptionId: string,
    payload: SubscribePayload,
    onNext: (data: any) => void,
    onError?: (error: any) => void
  ) => {
    if (!clientRef.current) {
      console.error('GraphQL WebSocket client not initialized')
      return () => {}
    }

    // Unsubscribe from existing subscription with same ID
    const existingUnsubscribe = subscriptionsRef.current.get(subscriptionId)
    if (existingUnsubscribe) {
      existingUnsubscribe()
    }

    // Create new subscription
    const unsubscribe = clientRef.current.subscribe(payload, {
      next: (result) => {
        if (result.data) {
          onNext(result.data)
        }
      },
      error: (error) => {
        console.error(`❌ Subscription error (${subscriptionId}):`, error)
        if (onError) {
          onError(error)
        }
      },
      complete: () => {
        console.log(`✅ Subscription completed (${subscriptionId})`)
        subscriptionsRef.current.delete(subscriptionId)
      }
    })

    // Store unsubscribe function
    subscriptionsRef.current.set(subscriptionId, unsubscribe)

    return unsubscribe
  }, [])

  // Unsubscribe from a specific subscription
  const unsubscribe = useCallback((subscriptionId: string) => {
    const unsubscribeFunc = subscriptionsRef.current.get(subscriptionId)
    if (unsubscribeFunc) {
      unsubscribeFunc()
      subscriptionsRef.current.delete(subscriptionId)
    }
  }, [])

  // Reconnect to WebSocket
  const reconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.dispose()
      clientRef.current = createWSClient()
    }
  }, [])

  return {
    isConnected,
    connectionError,
    subscribe,
    unsubscribe,
    reconnect,
    activeSubscriptions: subscriptionsRef.current.size,
  }
}

// Hook for OKR subscriptions
export const useOKRSubscriptions = (organizationId?: string, okrId?: string) => {
  const { subscribe, unsubscribe, isConnected } = useGraphQLSubscriptions()
  const [okrUpdates, setOKRUpdates] = useState<any[]>([])
  const [progressUpdates, setProgressUpdates] = useState<any[]>([])
  const [newOKRs, setNewOKRs] = useState<any[]>([])

  useEffect(() => {
    if (!isConnected) return

    const subscriptions: string[] = []

    // Subscribe to OKR updates
    if (okrId) {
      const okrUpdateSub = subscribe(
        `okr-updated-${okrId}`,
        {
          query: `
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
          variables: { okrId }
        },
        (data) => {
          setOKRUpdates(prev => [data.okrUpdated, ...prev.slice(0, 49)])
        }
      )
      subscriptions.push(`okr-updated-${okrId}`)
    }

    // Subscribe to progress changes
    if (organizationId) {
      const progressSub = subscribe(
        `okr-progress-${organizationId}`,
        {
          query: `
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
          variables: { organizationId }
        },
        (data) => {
          setProgressUpdates(prev => [data.okrProgressChanged, ...prev.slice(0, 49)])
        }
      )
      subscriptions.push(`okr-progress-${organizationId}`)

      // Subscribe to new OKRs
      const newOKRSub = subscribe(
        `new-okr-${organizationId}`,
        {
          query: `
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
          variables: { organizationId }
        },
        (data) => {
          setNewOKRs(prev => [data.newOKRCreated, ...prev.slice(0, 9)])
        }
      )
      subscriptions.push(`new-okr-${organizationId}`)
    }

    return () => {
      subscriptions.forEach(sub => unsubscribe(sub))
    }
  }, [isConnected, organizationId, okrId, subscribe, unsubscribe])

  return {
    okrUpdates,
    progressUpdates,
    newOKRs,
    clearUpdates: () => {
      setOKRUpdates([])
      setProgressUpdates([])
      setNewOKRs([])
    }
  }
}

// Hook for comment subscriptions
export const useCommentSubscriptions = (okrId: string) => {
  const { subscribe, unsubscribe, isConnected } = useGraphQLSubscriptions()
  const [newComments, setNewComments] = useState<any[]>([])
  const [commentUpdates, setCommentUpdates] = useState<any[]>([])

  useEffect(() => {
    if (!isConnected || !okrId) return

    const newCommentSub = subscribe(
      `new-comment-${okrId}`,
      {
        query: `
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
        variables: { okrId }
      },
      (data) => {
        setNewComments(prev => [data.newComment, ...prev.slice(0, 9)])
      }
    )

    const commentUpdateSub = subscribe(
      `comment-updated-${okrId}`,
      {
        query: `
          subscription CommentUpdated($okrId: ID) {
            commentUpdated(okrId: $okrId) {
              id
              content
              isResolved
              metadata
              updatedAt
            }
          }
        `,
        variables: { okrId }
      },
      (data) => {
        setCommentUpdates(prev => [data.commentUpdated, ...prev.slice(0, 9)])
      }
    )

    return () => {
      unsubscribe(`new-comment-${okrId}`)
      unsubscribe(`comment-updated-${okrId}`)
    }
  }, [isConnected, okrId, subscribe, unsubscribe])

  return {
    newComments,
    commentUpdates,
    clearComments: () => {
      setNewComments([])
      setCommentUpdates([])
    }
  }
}

// Hook for user activity subscriptions
export const useUserActivitySubscriptions = (organizationId: string) => {
  const { subscribe, unsubscribe, isConnected } = useGraphQLSubscriptions()
  const [userActivity, setUserActivity] = useState<any[]>([])
  const [userPresence, setUserPresence] = useState<Map<string, any>>(new Map())

  useEffect(() => {
    if (!isConnected || !organizationId) return

    const activitySub = subscribe(
      `user-activity-${organizationId}`,
      {
        query: `
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
        variables: { organizationId }
      },
      (data) => {
        setUserActivity(prev => [data.userActivity, ...prev.slice(0, 19)])
      }
    )

    const presenceSub = subscribe(
      `user-presence-${organizationId}`,
      {
        query: `
          subscription UserPresence($organizationId: ID) {
            userPresence(organizationId: $organizationId) {
              userId
              user {
                id
                fullName
              }
              status
              lastSeen
              currentPage
            }
          }
        `,
        variables: { organizationId }
      },
      (data) => {
        setUserPresence(prev => {
          const newMap = new Map(prev)
          newMap.set(data.userPresence.userId, data.userPresence)
          return newMap
        })
      }
    )

    return () => {
      unsubscribe(`user-activity-${organizationId}`)
      unsubscribe(`user-presence-${organizationId}`)
    }
  }, [isConnected, organizationId, subscribe, unsubscribe])

  return {
    userActivity,
    userPresence: Array.from(userPresence.values()),
    clearActivity: () => {
      setUserActivity([])
      setUserPresence(new Map())
    }
  }
}

// Hook for system notifications
export const useNotificationSubscriptions = (userId?: string) => {
  const { subscribe, unsubscribe, isConnected } = useGraphQLSubscriptions()
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    if (!isConnected || !userId) return

    const notificationSub = subscribe(
      `notifications-${userId}`,
      {
        query: `
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
        variables: { userId }
      },
      (data) => {
        setNotifications(prev => [data.systemNotification, ...prev.slice(0, 19)])
      }
    )

    return () => {
      unsubscribe(`notifications-${userId}`)
    }
  }, [isConnected, userId, subscribe, unsubscribe])

  return {
    notifications,
    clearNotifications: () => setNotifications([])
  }
}