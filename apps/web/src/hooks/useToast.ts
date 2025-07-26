import { useState, useCallback, useEffect } from 'react'

export interface Toast {
  id: string
  title: string
  description?: string
  status: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  isClosable?: boolean
  action?: {
    label: string
    onClick: () => void
  }
}

export interface ToastOptions extends Omit<Toast, 'id'> {}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((options: ToastOptions) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const toast: Toast = {
      id,
      duration: 5000,
      isClosable: true,
      ...options
    }

    setToasts(prev => [...prev, toast])

    // Auto-remove toast after duration (if specified)
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, toast.duration)
    }

    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const removeAllToasts = useCallback(() => {
    setToasts([])
  }, [])

  const updateToast = useCallback((id: string, updates: Partial<ToastOptions>) => {
    setToasts(prev => prev.map(toast =>
      toast.id === id ? { ...toast, ...updates } : toast
    ))
  }, [])

  return {
    toasts,
    showToast,
    removeToast,
    removeAllToasts,
    updateToast
  }
}

// Toast component helpers
export const getToastIcon = (status: Toast['status']) => {
  switch (status) {
    case 'success':
      return '✅'
    case 'error':
      return '❌'
    case 'warning':
      return '⚠️'
    case 'info':
    default:
      return 'ℹ️'
  }
}

export const getToastColors = (status: Toast['status']) => {
  switch (status) {
    case 'success':
      return {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-800',
        icon: 'text-green-500'
      }
    case 'error':
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        icon: 'text-red-500'
      }
    case 'warning':
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-800',
        icon: 'text-yellow-500'
      }
    case 'info':
    default:
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800',
        icon: 'text-blue-500'
      }
  }
}