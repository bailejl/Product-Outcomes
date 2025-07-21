import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HelloWorld from './hello-world'

// Mock fetch globally
global.fetch = jest.fn()

describe('HelloWorld Component', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    ;(global.fetch as jest.Mock).mockClear()
  })

  it('should render loading state initially', () => {
    // Mock a delayed response
    ;(global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves to keep loading state
    )

    render(<HelloWorld />)
    expect(screen.getByTestId('hello-world-loading')).toBeInTheDocument()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should render success state with message', async () => {
    // Mock successful response
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Hello World!' }),
    })

    render(<HelloWorld />)

    await waitFor(() => {
      expect(screen.getByTestId('hello-world-success')).toBeInTheDocument()
    })

    expect(screen.getByTestId('hello-message')).toHaveTextContent(
      'Hello World!'
    )
    expect(
      screen.getByText('This message came from the database!')
    ).toBeInTheDocument()
  })

  it('should render error state on fetch failure', async () => {
    // Mock failed response
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network error')
    )

    render(<HelloWorld />)

    await waitFor(() => {
      expect(screen.getByTestId('hello-world-error')).toBeInTheDocument()
    })

    expect(screen.getByTestId('error-message')).toHaveTextContent(
      'Network error'
    )
  })

  it('should retry on button click after error', async () => {
    // First call fails, second succeeds
    ;(global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Hello World!' }),
      })

    const user = userEvent.setup()
    render(<HelloWorld />)

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId('hello-world-error')).toBeInTheDocument()
    })

    // Click retry button
    await user.click(screen.getByText('Retry'))

    // Should show success state
    await waitFor(() => {
      expect(screen.getByTestId('hello-world-success')).toBeInTheDocument()
    })
  })

  it('should refresh on button click in success state', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Hello World!' }),
    })

    const user = userEvent.setup()
    render(<HelloWorld />)

    // Wait for success state
    await waitFor(() => {
      expect(screen.getByTestId('hello-world-success')).toBeInTheDocument()
    })

    // Click refresh button
    await user.click(screen.getByText('Refresh'))

    // Should call fetch again
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})
