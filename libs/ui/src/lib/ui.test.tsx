import { render, screen } from '@testing-library/react'
import Ui from './ui'

describe('Ui Component', () => {
  it('should render title', () => {
    render(<Ui title="Test Title" />)
    expect(screen.getByText('Test Title')).toBeInTheDocument()
  })

  it('should render title and subtitle', () => {
    render(<Ui title="Test Title" subtitle="Test Subtitle" />)
    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByText('Test Subtitle')).toBeInTheDocument()
  })

  it('should not render subtitle when not provided', () => {
    render(<Ui title="Test Title" />)
    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.queryByText('Test Subtitle')).not.toBeInTheDocument()
  })
})
