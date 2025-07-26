import React from 'react'
import { useToast, getToastIcon, getToastColors, Toast as ToastType } from '../../hooks/useToast'

interface ToastProps {
  toast: ToastType
  onClose: (id: string) => void
}

export function ToastItem({ toast, onClose }: ToastProps) {
  const colors = getToastColors(toast.status)
  const icon = getToastIcon(toast.status)

  return (
    <div className={`
      max-w-sm w-full ${colors.bg} shadow-lg rounded-lg pointer-events-auto 
      ring-1 ring-black ring-opacity-5 overflow-hidden
      transform transition-all duration-300 ease-in-out
      hover:scale-105
    `}>
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className={`text-xl ${colors.icon}`}>{icon}</span>
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className={`text-sm font-medium ${colors.text}`}>
              {toast.title}
            </p>
            {toast.description && (
              <p className={`mt-1 text-sm ${colors.text} opacity-90`}>
                {toast.description}
              </p>
            )}
            {toast.action && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={toast.action.onClick}
                  className={`
                    text-sm font-medium ${colors.text} hover:opacity-80
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white
                    underline
                  `}
                >
                  {toast.action.label}
                </button>
              </div>
            )}
          </div>
          {toast.isClosable && (
            <div className="ml-4 flex-shrink-0 flex">
              <button
                type="button"
                className={`
                  inline-flex ${colors.text} hover:opacity-80 focus:outline-none 
                  focus:ring-2 focus:ring-offset-2 focus:ring-offset-white
                  rounded-md
                `}
                onClick={() => onClose(toast.id)}
              >
                <span className="sr-only">Close</span>
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="fixed inset-0 flex items-end justify-center px-4 py-6 pointer-events-none sm:p-6 sm:items-start sm:justify-end z-50">
      <div className="w-full flex flex-col items-center space-y-4 sm:items-end">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onClose={removeToast}
          />
        ))}
      </div>
    </div>
  )
}

// Provider component to include in your app
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToastContainer />
    </>
  )
}