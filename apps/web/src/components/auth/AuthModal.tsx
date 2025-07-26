import React, { useState, useEffect } from 'react'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { useAuth } from '../../contexts/AuthContext'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'login' | 'register'
}

export function AuthModal({
  isOpen,
  onClose,
  initialMode = 'login',
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const { clearError } = useAuth()

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      
      // Handle Escape key
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose()
        }
      }
      
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.body.style.overflow = 'unset'
      }
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  // Auto-close on successful authentication
  const { state } = useAuth()
  useEffect(() => {
    if (state.isAuthenticated && isOpen) {
      onClose()
    }
  }, [state.isAuthenticated, isOpen, onClose])

  if (!isOpen) return null

  const handleToggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    clearError() // Clear error when switching forms
  }

  const handleSuccess = () => {
    onClose()
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
      onClick={handleBackdropClick}
      data-testid="modal-backdrop"
    >
      <div 
        className="relative w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${mode}-modal-title`}
        data-testid="auth-modal"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
          data-testid="close-modal"
          aria-label="Close modal"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {mode === 'login' ? (
          <LoginForm
            onToggleMode={handleToggleMode}
            onSuccess={handleSuccess}
          />
        ) : (
          <RegisterForm
            onToggleMode={handleToggleMode}
            onSuccess={handleSuccess}
          />
        )}
      </div>
    </div>
  )
}
