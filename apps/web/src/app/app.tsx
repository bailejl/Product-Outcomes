// Hello World Web Application with TailwindCSS, Authentication, and GraphQL
import { useState } from 'react'
import { HelloWorld } from '@product-outcomes/ui'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { AuthModal, UserMenu, ProtectedRoute } from '../components/auth'
import { GluestackUIProvider } from '@gluestack-ui/themed'
import { config } from '../config/gluestack-ui'
import { ApolloProvider } from '@apollo/client'
import { apolloClient } from '../lib/apollo-client'
import { GraphQLErrorBoundary } from '../components/GraphQLErrorBoundary'
import '../styles/tailwind.css'

function AppContent() {
  const { state } = useAuth()
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

  const openAuthModal = (mode: 'login' | 'register') => {
    setAuthMode(mode)
    setIsAuthModalOpen(true)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center mb-4">
            <div></div> {/* Spacer */}
            <div className="flex items-center space-x-4">
              {state.isAuthenticated ? (
                <UserMenu />
              ) : (
                <>
                  <button
                    onClick={() => openAuthModal('login')}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
                    data-testid="header-login"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => openAuthModal('register')}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
                    data-testid="header-register"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Product Outcomes - Hello World Demo
            </h1>
            <p className="text-lg text-gray-600">
              Cross-platform Hello World application with authentication &
              database integration
            </p>
            <div className="mt-4 flex justify-center space-x-4 flex-wrap">
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
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                JWT Auth
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {state.isAuthenticated ? (
          <div className="space-y-8">
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex items-center">
                <div className="text-green-500 text-xl mr-3">✅</div>
                <div>
                  <h3 className="text-sm font-medium text-green-800">
                    Welcome back, {state.user?.firstName}!
                  </h3>
                  <p className="text-sm text-green-600 mt-1">
                    You are successfully authenticated. You can now access
                    protected features.
                  </p>
                </div>
              </div>
            </div>

            <ProtectedRoute fallback={<div>Please log in to continue</div>}>
              <HelloWorld />
            </ProtectedRoute>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex items-center">
                <div className="text-blue-500 text-xl mr-3">ℹ️</div>
                <div>
                  <h3 className="text-sm font-medium text-blue-800">
                    Authentication Demo
                  </h3>
                  <p className="text-sm text-blue-600 mt-1">
                    Sign in or create an account to access protected features
                    and test the authentication system.
                  </p>
                </div>
              </div>
            </div>

            <HelloWorld />
          </div>
        )}
      </main>

      <footer className="bg-gray-100 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Built with React, Express.js, PostgreSQL, TypeORM, JWT, and Nx
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Phase 1: Foundation Infrastructure ✅ | Phase 2: Authentication &
              Security ⚡
            </p>
          </div>
        </div>
      </footer>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authMode}
      />
    </div>
  )
}

export function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <GraphQLErrorBoundary>
        <GluestackUIProvider config={config}>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </GluestackUIProvider>
      </GraphQLErrorBoundary>
    </ApolloProvider>
  )
}

export default App
