/**
 * GraphQL-based Authentication Context
 * Replaces REST API calls with GraphQL operations
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { apolloClient, clearApolloCache } from '../lib/apollo-client'
import { GET_ME } from '../graphql/queries'
import { LOGIN, REGISTER, LOGOUT, REFRESH_TOKEN, UPDATE_PROFILE, CHANGE_PASSWORD } from '../graphql/mutations'

// Types
interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'user' | 'moderator'
  isActive: boolean
  emailVerified: boolean
  createdAt: string
  updatedAt: string
  fullName?: string
  displayName?: string
}

interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

interface AuthState {
  user: User | null
  tokens: AuthTokens | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
}

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; tokens: AuthTokens } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'REFRESH_TOKEN_SUCCESS'; payload: AuthTokens }
  | { type: 'SET_USER'; payload: User }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_LOADING'; payload: boolean }

// Initial state
const initialState: AuthState = {
  user: null,
  tokens: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
}

// Reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      }
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: true,
        user: action.payload.user,
        tokens: action.payload.tokens,
        error: null,
      }
    case 'LOGIN_FAILURE':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        tokens: null,
        error: action.payload,
      }
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        tokens: null,
        error: null,
        isLoading: false,
      }
    case 'REFRESH_TOKEN_SUCCESS':
      return {
        ...state,
        tokens: action.payload,
      }
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
      }
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      }
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      }
    default:
      return state
  }
}

// Context type
interface GraphQLAuthContextType {
  state: AuthState
  login: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<void>
  register: (userData: {
    email: string
    password: string
    firstName: string
    lastName: string
    role?: 'admin' | 'user' | 'moderator'
  }) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  updateProfile: (updates: {
    firstName?: string
    lastName?: string
    email?: string
  }) => Promise<void>
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<void>
  clearError: () => void
}

const GraphQLAuthContext = createContext<GraphQLAuthContextType | undefined>(undefined)

// Storage helper
const TOKEN_STORAGE_KEY = 'auth_tokens'
const USER_STORAGE_KEY = 'auth_user'

function saveToStorage(tokens: AuthTokens, user: User) {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens))
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
  } catch (error) {
    console.error('Failed to save auth data to storage:', error)
  }
}

function loadFromStorage(): { tokens: AuthTokens | null; user: User | null } {
  try {
    const tokensStr = localStorage.getItem(TOKEN_STORAGE_KEY)
    const userStr = localStorage.getItem(USER_STORAGE_KEY)

    const tokens = tokensStr ? JSON.parse(tokensStr) : null
    const user = userStr ? JSON.parse(userStr) : null

    return { tokens, user }
  } catch (error) {
    console.error('Failed to load auth data from storage:', error)
    return { tokens: null, user: null }
  }
}

function clearStorage() {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  localStorage.removeItem(USER_STORAGE_KEY)
}

// Provider component
interface GraphQLAuthProviderProps {
  children: ReactNode
}

export function GraphQLAuthProvider({ children }: GraphQLAuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // GraphQL hooks
  const { data: currentUser, loading: loadingUser, error: userError } = useQuery(GET_ME, {
    errorPolicy: 'ignore',
    fetchPolicy: 'cache-first',
  })

  const [loginMutation] = useMutation(LOGIN, {
    errorPolicy: 'all',
  })

  const [registerMutation] = useMutation(REGISTER, {
    errorPolicy: 'all',
  })

  const [logoutMutation] = useMutation(LOGOUT, {
    errorPolicy: 'ignore',
  })

  const [refreshTokenMutation] = useMutation(REFRESH_TOKEN, {
    errorPolicy: 'ignore',
  })

  const [updateProfileMutation] = useMutation(UPDATE_PROFILE, {
    update: (cache, { data }) => {
      if (data?.updateProfile) {
        cache.writeQuery({
          query: GET_ME,
          data: { me: data.updateProfile },
        })
      }
    },
  })

  const [changePasswordMutation] = useMutation(CHANGE_PASSWORD)

  // Initialize auth state from storage or current user query
  useEffect(() => {
    if (loadingUser) {
      dispatch({ type: 'SET_LOADING', payload: true })
      return
    }

    if (currentUser?.me) {
      const { tokens } = loadFromStorage()
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          user: currentUser.me,
          tokens: tokens || { accessToken: '', refreshToken: '', expiresIn: 0 },
        },
      })
    } else {
      const { tokens, user } = loadFromStorage()
      if (tokens && user) {
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { tokens, user },
        })
      } else {
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    }
  }, [currentUser, loadingUser])

  // Save auth data to storage when state changes
  useEffect(() => {
    if (state.isAuthenticated && state.tokens && state.user) {
      saveToStorage(state.tokens, state.user)
    } else if (!state.isAuthenticated) {
      clearStorage()
    }
  }, [state.isAuthenticated, state.tokens, state.user])

  // GraphQL event listeners for auth errors
  useEffect(() => {
    const handleUnauthenticated = () => {
      dispatch({ type: 'LOGOUT' })
      clearApolloCache()
    }

    const handleForbidden = () => {
      dispatch({ type: 'LOGIN_FAILURE', payload: 'Access denied' })
    }

    const handleGraphQLError = (event: CustomEvent) => {
      const { message } = event.detail
      dispatch({ type: 'LOGIN_FAILURE', payload: message })
    }

    window.addEventListener('apollo:unauthenticated', handleUnauthenticated)
    window.addEventListener('apollo:forbidden', handleForbidden)
    window.addEventListener('apollo:graphql-error', handleGraphQLError as EventListener)

    return () => {
      window.removeEventListener('apollo:unauthenticated', handleUnauthenticated)
      window.removeEventListener('apollo:forbidden', handleForbidden)
      window.removeEventListener('apollo:graphql-error', handleGraphQLError as EventListener)
    }
  }, [])

  const login = async (email: string, password: string, rememberMe = false) => {
    try {
      dispatch({ type: 'LOGIN_START' })
      
      const { data } = await loginMutation({
        variables: {
          input: { email, password, rememberMe },
        },
      })

      if (data?.login) {
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            user: data.login.user,
            tokens: data.login.tokens,
          },
        })
        
        // Refetch current user to update cache
        await apolloClient.refetchQueries({
          include: [GET_ME],
        })
      }
    } catch (error: any) {
      const message = error.graphQLErrors?.[0]?.message || error.message || 'Login failed'
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: message,
      })
      throw error
    }
  }

  const register = async (userData: {
    email: string
    password: string
    firstName: string
    lastName: string
    role?: 'admin' | 'user' | 'moderator'
  }) => {
    try {
      dispatch({ type: 'LOGIN_START' })
      
      const { data } = await registerMutation({
        variables: {
          input: userData,
        },
      })

      if (data?.register) {
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            user: data.register.user,
            tokens: data.register.tokens,
          },
        })
        
        // Update Apollo cache
        apolloClient.writeQuery({
          query: GET_ME,
          data: { me: data.register.user },
        })
      }
    } catch (error: any) {
      const message = error.graphQLErrors?.[0]?.message || error.message || 'Registration failed'
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: message,
      })
      throw error
    }
  }

  const logout = async () => {
    try {
      await logoutMutation()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      dispatch({ type: 'LOGOUT' })
      clearApolloCache()
      await apolloClient.resetStore()
    }
  }

  const refreshToken = async () => {
    try {
      if (!state.tokens?.refreshToken) {
        throw new Error('No refresh token available')
      }

      const { data } = await refreshTokenMutation()
      
      if (data?.refreshToken) {
        dispatch({
          type: 'REFRESH_TOKEN_SUCCESS',
          payload: data.refreshToken,
        })
      }
    } catch (error) {
      console.error('Token refresh failed:', error)
      dispatch({ type: 'LOGOUT' })
      throw error
    }
  }

  const updateProfile = async (updates: {
    firstName?: string
    lastName?: string
    email?: string
  }) => {
    try {
      const { data } = await updateProfileMutation({
        variables: { input: updates },
      })

      if (data?.updateProfile) {
        dispatch({
          type: 'SET_USER',
          payload: data.updateProfile,
        })
      }
    } catch (error: any) {
      console.error('Profile update failed:', error)
      const message = error.graphQLErrors?.[0]?.message || error.message || 'Profile update failed'
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: message,
      })
      throw error
    }
  }

  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ) => {
    try {
      await changePasswordMutation({
        variables: {
          input: { currentPassword, newPassword },
        },
      })
    } catch (error: any) {
      console.error('Password change failed:', error)
      const message = error.graphQLErrors?.[0]?.message || error.message || 'Password change failed'
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: message,
      })
      throw error
    }
  }

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' })
  }

  const value: GraphQLAuthContextType = {
    state,
    login,
    register,
    logout,
    refreshToken,
    updateProfile,
    changePassword,
    clearError,
  }

  return (
    <GraphQLAuthContext.Provider value={value}>
      {children}
    </GraphQLAuthContext.Provider>
  )
}

// Hook to use GraphQL auth context
export function useGraphQLAuth() {
  const context = useContext(GraphQLAuthContext)
  if (context === undefined) {
    throw new Error('useGraphQLAuth must be used within a GraphQLAuthProvider')
  }
  return context
}

// Export for backward compatibility
export { GraphQLAuthProvider as AuthProvider, useGraphQLAuth as useAuth }