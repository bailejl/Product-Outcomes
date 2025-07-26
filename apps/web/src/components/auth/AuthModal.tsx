import React, { useState, useEffect } from 'react'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import { ResetPasswordForm } from './ResetPasswordForm'
import { useAuth } from '../../contexts/AuthContext'
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Button,
  ButtonText,
  CloseIcon,
} from '@gluestack-ui/themed'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'login' | 'register' | 'forgot-password' | 'reset-password'
  resetToken?: string
}

export function AuthModal({
  isOpen,
  onClose,
  initialMode = 'login',
  resetToken,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot-password' | 'reset-password'>(initialMode)
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
    if (mode === 'login') {
      setMode('forgot-password')
    } else if (mode === 'register') {
      setMode('login')
    } else if (mode === 'forgot-password') {
      setMode('login')
    } else if (mode === 'reset-password') {
      setMode('login')
    } else {
      setMode('login')
    }
    clearError() // Clear error when switching forms
  }

  const handleModeSwitch = (newMode: 'login' | 'register' | 'forgot-password' | 'reset-password') => {
    setMode(newMode)
    clearError()
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
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalBackdrop onPress={onClose} testID="modal-backdrop" />
      <ModalContent maxWidth="$96" testID="auth-modal">
        <ModalHeader>
          <ModalCloseButton onPress={onClose} testID="close-modal">
            <CloseIcon />
          </ModalCloseButton>
        </ModalHeader>
        <ModalBody p="$0">

        {mode === 'login' && (
          <LoginForm
            onToggleMode={() => handleModeSwitch('forgot-password')}
            onSuccess={handleSuccess}
          />
        )}
        
        {mode === 'register' && (
          <RegisterForm
            onToggleMode={() => handleModeSwitch('login')}
            onSuccess={handleSuccess}
          />
        )}
        
        {mode === 'forgot-password' && (
          <ForgotPasswordForm
            onSuccess={() => handleModeSwitch('login')}
            onBackToLogin={() => handleModeSwitch('login')}
          />
        )}
        
        {mode === 'reset-password' && (
          <ResetPasswordForm
            token={resetToken}
            onSuccess={() => handleModeSwitch('login')}
            onBackToLogin={() => handleModeSwitch('login')}
          />
        )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
