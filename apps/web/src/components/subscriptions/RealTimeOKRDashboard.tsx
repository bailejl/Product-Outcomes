import React, { useState, useEffect } from 'react'
import { useOKRSubscriptions, useUserActivitySubscriptions, useNotificationSubscriptions } from '../../hooks/useGraphQLSubscriptions'

interface RealTimeOKRDashboardProps {
  organizationId: string
  userId?: string
}

export const RealTimeOKRDashboard: React.FC<RealTimeOKRDashboardProps> = ({
  organizationId,
  userId
}) => {
  const [selectedTab, setSelectedTab] = useState<'progress' | 'activity' | 'notifications'>('progress')
  
  // Subscribe to real-time updates
  const { okrUpdates, progressUpdates, newOKRs, clearUpdates } = useOKRSubscriptions(organizationId)
  const { userActivity, userPresence, clearActivity } = useUserActivitySubscriptions(organizationId)
  const { notifications, clearNotifications } = useNotificationSubscriptions(userId)

  // Auto-clear old updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Clear updates older than 1 hour
      const oneHourAgo = Date.now() - (60 * 60 * 1000)
      // Implementation would filter out old items
    }, 300000) // Every 5 minutes

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Real-Time Dashboard</h2>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">Live</span>
          </div>
          <div className="text-sm text-gray-500">
            {userPresence.filter(p => p.status === 'online').length} online
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'progress', label: 'Progress Updates', count: progressUpdates.length },
            { key: 'activity', label: 'User Activity', count: userActivity.length },
            { key: 'notifications', label: 'Notifications', count: notifications.length },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setSelectedTab(key as any)}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                ${selectedTab === key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {label}
              {count > 0 && (
                <span className="ml-2 bg-blue-100 text-blue-600 py-0.5 px-2 rounded-full text-xs">
                  {count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {selectedTab === 'progress' && (
          <ProgressUpdatesTab 
            progressUpdates={progressUpdates}
            newOKRs={newOKRs}
            onClear={clearUpdates}
          />
        )}
        
        {selectedTab === 'activity' && (
          <UserActivityTab 
            userActivity={userActivity}
            userPresence={userPresence}
            onClear={clearActivity}
          />
        )}
        
        {selectedTab === 'notifications' && (
          <NotificationsTab 
            notifications={notifications}
            onClear={clearNotifications}
          />
        )}
      </div>
    </div>
  )
}

// Progress Updates Tab Component
const ProgressUpdatesTab: React.FC<{
  progressUpdates: any[]
  newOKRs: any[]
  onClear: () => void
}> = ({ progressUpdates, newOKRs, onClear }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Recent Progress Updates</h3>
        {(progressUpdates.length > 0 || newOKRs.length > 0) && (
          <button
            onClick={onClear}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear all
          </button>
        )}
      </div>

      {/* New OKRs */}
      {newOKRs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">New OKRs Created</h4>
          {newOKRs.map((okr, index) => (
            <div key={`${okr.id}-${index}`} className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">{okr.title}</p>
                  <p className="text-xs text-green-700">
                    Created by {okr.owner.fullName} • {new Date(okr.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    New
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Progress Updates */}
      {progressUpdates.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Progress Changes</h4>
          {progressUpdates.map((update, index) => (
            <div key={`${update.id}-${index}`} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">{update.title}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(update.progressPercentage, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-blue-700 font-medium">
                      {update.progressPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    Updated by {update.owner.fullName}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {progressUpdates.length === 0 && newOKRs.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No recent progress updates</p>
          <p className="text-sm">Updates will appear here in real-time</p>
        </div>
      )}
    </div>
  )
}

// User Activity Tab Component
const UserActivityTab: React.FC<{
  userActivity: any[]
  userPresence: any[]
  onClear: () => void
}> = ({ userActivity, userPresence, onClear }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">User Activity</h3>
        {userActivity.length > 0 && (
          <button
            onClick={onClear}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Online Users */}
      {userPresence.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Currently Online</h4>
          <div className="flex flex-wrap gap-2">
            {userPresence
              .filter(p => p.status === 'online')
              .map((presence) => (
                <div
                  key={presence.userId}
                  className="inline-flex items-center space-x-2 bg-green-50 border border-green-200 rounded-full px-3 py-1"
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-900">{presence.user.fullName}</span>
                  {presence.currentPage && (
                    <span className="text-xs text-green-700">
                      on {presence.currentPage}
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {userActivity.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Recent Activity</h4>
          <div className="space-y-2">
            {userActivity.map((activity, index) => (
              <div key={`${activity.userId}-${activity.timestamp}-${index}`} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-600">
                        {activity.user.fullName.split(' ').map((n: string) => n[0]).join('')}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{activity.user.fullName}</span>
                      {' '}
                      <span className="text-gray-600">
                        {getActivityDescription(activity.action, activity.resourceType, activity.metadata)}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {userActivity.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No recent activity</p>
          <p className="text-sm">User actions will appear here in real-time</p>
        </div>
      )}
    </div>
  )
}

// Notifications Tab Component
const NotificationsTab: React.FC<{
  notifications: any[]
  onClear: () => void
}> = ({ notifications, onClear }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
        {notifications.length > 0 && (
          <button
            onClick={onClear}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear all
          </button>
        )}
      </div>

      {notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((notification, index) => (
            <div
              key={`${notification.id}-${index}`}
              className={`
                border rounded-lg p-4
                ${notification.priority === 'high' || notification.priority === 'urgent'
                  ? 'bg-red-50 border-red-200'
                  : notification.priority === 'medium'
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-blue-50 border-blue-200'
                }
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900">
                    {notification.title}
                  </h4>
                  <p className="text-sm text-gray-700 mt-1">
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <span className={`
                    inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                    ${notification.priority === 'high' || notification.priority === 'urgent'
                      ? 'bg-red-100 text-red-800'
                      : notification.priority === 'medium'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-blue-100 text-blue-800'
                    }
                  `}>
                    {notification.priority}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>No notifications</p>
          <p className="text-sm">System notifications will appear here</p>
        </div>
      )}
    </div>
  )
}

// Helper function to format activity descriptions
const getActivityDescription = (action: string, resourceType: string, metadata?: any) => {
  switch (action) {
    case 'created_okr':
      return `created a new OKR "${metadata?.title}"`
    case 'updated_okr':
      return `updated an OKR "${metadata?.title}"`
    case 'completed_okr':
      return `completed an OKR "${metadata?.title}"`
    case 'updated_key_result':
      return `updated a key result`
    case 'commented_on_okr':
      return `commented on an OKR`
    case 'joined_organization':
      return `joined the organization`
    default:
      return `performed ${action} on ${resourceType.toLowerCase()}`
  }
}