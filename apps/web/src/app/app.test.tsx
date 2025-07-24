import { render, screen } from '@testing-library/react'
import App from './app'

// Mock the HelloWorld component from UI library
jest.mock('@product-outcomes/ui', () => ({
  HelloWorld: () => <div data-testid="hello-world-mock">Hello World Mock</div>,
}))

describe('App Component', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<App />)
    expect(baseElement).toBeTruthy()
  })

  it('should render the header with correct title', () => {
    render(<App />)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('Product Outcomes - Hello World Demo')
  })

  it('should render the header description', () => {
    render(<App />)
    const description = screen.getByText(
      'Cross-platform Hello World application with database integration'
    )
    expect(description).toBeInTheDocument()
  })

  it('should render the HelloWorld component', () => {
    render(<App />)
    const helloWorld = screen.getByTestId('hello-world-mock')
    expect(helloWorld).toBeInTheDocument()
  })

  it('should render the technology badges', () => {
    render(<App />)
    expect(screen.getByText('React 19')).toBeInTheDocument()
    expect(screen.getByText('Express.js')).toBeInTheDocument()
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument()
  })
})
