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
      'Cross-platform Hello World application with authentication & database integration'
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
    expect(screen.getByText('JWT Auth')).toBeInTheDocument()
  })

  it('should render authentication buttons when not logged in', () => {
    render(<App />)
    const signInButton = screen.getByTestId('header-login')
    const signUpButton = screen.getByTestId('header-register')
    expect(signInButton).toBeInTheDocument()
    expect(signUpButton).toBeInTheDocument()
  })

  it('should render authentication demo info when not logged in', () => {
    render(<App />)
    const authInfo = screen.getByText('Authentication Demo')
    expect(authInfo).toBeInTheDocument()
  })
})
