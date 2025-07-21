// Hello World Web Application
import { HelloWorld } from '@product-outcomes/ui'

export function App() {
  return (
    <div>
      <header
        style={{ padding: '1rem', textAlign: 'center', background: '#f5f5f5' }}
      >
        <h1>Product Outcomes - Hello World Demo</h1>
        <p>Cross-platform Hello World application with database integration</p>
      </header>
      <main>
        <HelloWorld />
      </main>
      <footer
        style={{
          padding: '1rem',
          textAlign: 'center',
          color: '#666',
          fontSize: '0.9rem',
        }}
      >
        <p>Built with React, Express.js, PostgreSQL, and Nx</p>
      </footer>
    </div>
  )
}

export default App
