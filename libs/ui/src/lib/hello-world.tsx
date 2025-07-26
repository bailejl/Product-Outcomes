import { useState, useEffect } from 'react'

interface Message {
  message: string
  source: string
  id?: string
  timestamp: string
}

export function HelloWorld() {
  const [data, setData] = useState<Message | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMessage = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(
        'http://localhost:3333/api/messages/hello-world'
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      console.error('Failed to fetch message:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch message')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMessage()
  }, [])

  if (loading) {
    return (
      <div className="card max-w-2xl mx-auto" data-testid="hello-world-loading">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div
          className="card max-w-2xl mx-auto text-center"
          data-testid="hello-world-error"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Hello World Message
          </h2>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700" data-testid="error-message">
              {error}
            </p>
            <p className="text-xs text-red-600 mt-2">
              Make sure the API server is running on http://localhost:3333
            </p>
            <button
              onClick={fetchMessage}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>

        {/* Phase 1 Status */}
        <div className="card max-w-4xl mx-auto">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            🚀 Phase 1 Implementation Status
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <span className="text-green-600 text-xl mr-2">✅</span>
                <div>
                  <h4 className="font-medium text-green-900">
                    Docker Services
                  </h4>
                  <p className="text-sm text-green-700">
                    PostgreSQL, Redis, MinIO
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <span className="text-green-600 text-xl mr-2">✅</span>
                <div>
                  <h4 className="font-medium text-green-900">TypeORM</h4>
                  <p className="text-sm text-green-700">
                    Database ORM integration
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <span className="text-green-600 text-xl mr-2">✅</span>
                <div>
                  <h4 className="font-medium text-green-900">TailwindCSS</h4>
                  <p className="text-sm text-green-700">Modern CSS framework</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <span className="text-blue-600 text-xl mr-2">🔄</span>
                <div>
                  <h4 className="font-medium text-blue-900">Testing</h4>
                  <p className="text-sm text-blue-700">
                    Validation in progress
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">
              Next Steps (Phase 2):
            </h4>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• JWT Authentication system</li>
              <li>• React authentication flows</li>
              <li>• Protected routes and middleware</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // Success state
  return (
    <div className="space-y-6">
      {/* Main Message Card */}
      <div
        className="card max-w-2xl mx-auto text-center"
        data-testid="hello-world-success"
      >
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Hello World Message
        </h2>

        {data && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
              <p
                className="text-xl font-medium text-gray-900 mb-2"
                data-testid="hello-message"
              >
                {data.message}
              </p>
              <p className="text-sm text-gray-600">
                This message came from the database!
              </p>
              <div className="flex justify-center space-x-4 text-sm text-gray-600 mt-4">
                <span className="flex items-center">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                  Source: {data.source}
                </span>
                {data.id && (
                  <span className="flex items-center">
                    <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                    ID: {data.id.substring(0, 8)}...
                  </span>
                )}
              </div>
            </div>

            <div className="text-xs text-gray-500">
              Fetched at: {new Date(data.timestamp).toLocaleString()}
            </div>

            <button
              onClick={fetchMessage}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Phase 1 Status */}
      <div className="card max-w-4xl mx-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          🚀 Phase 1 Implementation Status
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <span className="text-green-600 text-xl mr-2">✅</span>
              <div>
                <h4 className="font-medium text-green-900">Docker Services</h4>
                <p className="text-sm text-green-700">
                  PostgreSQL, Redis, MinIO
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <span className="text-green-600 text-xl mr-2">✅</span>
              <div>
                <h4 className="font-medium text-green-900">TypeORM</h4>
                <p className="text-sm text-green-700">
                  Database ORM integration
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <span className="text-green-600 text-xl mr-2">✅</span>
              <div>
                <h4 className="font-medium text-green-900">TailwindCSS</h4>
                <p className="text-sm text-green-700">Modern CSS framework</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <span className="text-blue-600 text-xl mr-2">🔄</span>
              <div>
                <h4 className="font-medium text-blue-900">Testing</h4>
                <p className="text-sm text-blue-700">Validation in progress</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">
            Next Steps (Phase 2):
          </h4>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• JWT Authentication system</li>
            <li>• React authentication flows</li>
            <li>• Protected routes and middleware</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default HelloWorld
