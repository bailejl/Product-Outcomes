// Hello World component using functional programming patterns
import { useEffect, useState } from 'react'
import './hello-world.module.css'

// Type definitions
interface HelloWorldMessage {
  message: string
}

interface HelloWorldError {
  error: string
}

// Factory function for creating hello world state management
const createHelloWorldState = () => {
  const [message, setMessage] = useState<string>('Loading...')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // Arrow function for fetching message
  const fetchMessage = async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/messages/hello-world')

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: HelloWorldMessage = await response.json()
      setMessage(data.message)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load message'
      setError(errorMessage)
      setMessage('Failed to load message')
    } finally {
      setLoading(false)
    }
  }

  return { message, error, loading, fetchMessage }
}

// Main Hello World component (arrow function)
export const HelloWorld = () => {
  const { message, error, loading, fetchMessage } = createHelloWorldState()

  useEffect(() => {
    fetchMessage()
  }, [])

  // Render loading state
  if (loading) {
    return (
      <div className="hello-world-container" data-testid="hello-world-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  // Render error state
  if (error) {
    return (
      <div
        className="hello-world-container error"
        data-testid="hello-world-error"
      >
        <h2>Error</h2>
        <p data-testid="error-message">{error}</p>
        <button onClick={fetchMessage} className="retry-button">
          Retry
        </button>
      </div>
    )
  }

  // Render success state
  return (
    <div
      className="hello-world-container success"
      data-testid="hello-world-success"
    >
      <h1 data-testid="hello-message">{message}</h1>
      <p className="subtitle">This message came from the database!</p>
      <button onClick={fetchMessage} className="refresh-button">
        Refresh
      </button>
    </div>
  )
}

export default HelloWorld
