// Hello World Web Application with TailwindCSS
import { HelloWorld } from '@product-outcomes/ui'
import '../styles/tailwind.css'

export function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Product Outcomes - Hello World Demo
            </h1>
            <p className="text-lg text-gray-600">
              Cross-platform Hello World application with database integration
            </p>
            <div className="mt-4 flex justify-center space-x-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                React 19
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                Express.js
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                PostgreSQL
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                TypeORM
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-pink-100 text-pink-800">
                TailwindCSS
              </span>
            </div>
          </div>
        </div>
      </header>
      
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <HelloWorld />
      </main>
      
      <footer className="bg-gray-100 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Built with React, Express.js, PostgreSQL, TypeORM, and Nx
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Phase 1: Foundation Infrastructure ✅
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App