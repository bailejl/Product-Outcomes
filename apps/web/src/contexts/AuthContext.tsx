import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from 'react'

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

// Initial state
const initialState: AuthState = {
  user: null,
  tokens: null,
  isLoading: false,
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
    default:
      return state
  }
}

// Auth service
class AuthService {
  private baseURL = 'http://localhost:3333/api/auth'

  async login(email: string, password: string, rememberMe = false) {
    const response = await fetch(`${this.baseURL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, rememberMe }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Login failed')
    }

    return await response.json()
  }

  async register(userData: {
    email: string
    password: string
    firstName: string
    lastName: string
    role?: 'admin' | 'user' | 'moderator'
  }) {
    const response = await fetch(`${this.baseURL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Registration failed')
    }

    return await response.json()
  }

  async refreshToken(refreshToken: string) {
    const response = await fetch(`${this.baseURL}/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Token refresh failed')
    }

    return await response.json()
  }

  async logout(accessToken: string) {
    const response = await fetch(`${this.baseURL}/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Logout failed')
    }

    return await response.json()
  }

  async getProfile(accessToken: string) {
    const response = await fetch(`${this.baseURL}/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to fetch profile')
    }

    return await response.json()
  }

  async updateProfile(
    accessToken: string,
    updates: {
      firstName?: string
      lastName?: string
      email?: string
    }
  ) {
    const response = await fetch(`${this.baseURL}/profile`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Profile update failed')
    }

    return await response.json()
  }

  async changePassword(
    accessToken: string,
    currentPassword: string,
    newPassword: string
  ) {
    const response = await fetch(`${this.baseURL}/change-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Password change failed')
    }

    return await response.json()
  }
}

// Context
interface AuthContextType {
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
  getProfile: () => Promise<void>
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

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Storage helper
const TOKEN_STORAGE_KEY = 'auth_tokens'
const USER_STORAGE_KEY = 'auth_user'

function saveToStorage(tokens: AuthTokens, user: User) {
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens))
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
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
interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState)
  const authService = new AuthService()

  // Load auth data from storage on mount
  useEffect(() => {
    const { tokens, user } = loadFromStorage()
    if (tokens && user) {
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { tokens, user },
      })
    }
  }, [])

  // Save auth data to storage when state changes
  useEffect(() => {
    if (state.isAuthenticated && state.tokens && state.user) {
      saveToStorage(state.tokens, state.user)
    } else {
      clearStorage()
    }
  }, [state.isAuthenticated, state.tokens, state.user])

  const login = async (email: string, password: string, rememberMe = false) => {
    try {
      dispatch({ type: 'LOGIN_START' })
      const response = await authService.login(email, password, rememberMe)
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          user: response.user,
          tokens: response.tokens,
        },
      })
    } catch (error) {
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: error instanceof Error ? error.message : 'Login failed',
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
      const response = await authService.register(userData)
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          user: response.user,
          tokens: response.tokens,
        },
      })
    } catch (error) {
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: error instanceof Error ? error.message : 'Registration failed',
      })
      throw error
    }
  }

  const logout = async () => {
    try {
      if (state.tokens?.accessToken) {
        await authService.logout(state.tokens.accessToken)
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      dispatch({ type: 'LOGOUT' })
    }
  }

  const refreshToken = async () => {
    try {
      if (!state.tokens?.refreshToken) {
        throw new Error('No refresh token available')
      }

      const response = await authService.refreshToken(state.tokens.refreshToken)
      dispatch({
        type: 'REFRESH_TOKEN_SUCCESS',
        payload: response.tokens,
      })
    } catch (error) {
      console.error('Token refresh failed:', error)
      dispatch({ type: 'LOGOUT' })
      throw error
    }
  }

  const getProfile = async () => {
    try {
      if (!state.tokens?.accessToken) {
        throw new Error('No access token available')
      }

      const response = await authService.getProfile(state.tokens.accessToken)
      dispatch({
        type: 'SET_USER',
        payload: response.user,
      })
    } catch (error) {
      console.error('Failed to fetch profile:', error)
      throw error
    }
  }

  const updateProfile = async (updates: {
    firstName?: string
    lastName?: string
    email?: string
  }) => {
    try {
      if (!state.tokens?.accessToken) {
        throw new Error('No access token available')
      }

      const response = await authService.updateProfile(
        state.tokens.accessToken,
        updates
      )
      dispatch({
        type: 'SET_USER',
        payload: response.user,
      })
    } catch (error) {
      console.error('Profile update failed:', error)
      throw error
    }
  }

  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ) => {
    try {
      if (!state.tokens?.accessToken) {
        throw new Error('No access token available')
      }

      await authService.changePassword(
        state.tokens.accessToken,
        currentPassword,
        newPassword
      )
    } catch (error) {
      console.error('Password change failed:', error)
      throw error
    }
  }

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' })
  }

  const value: AuthContextType = {
    state,
    login,
    register,
    logout,
    refreshToken,
    getProfile,
    updateProfile,
    changePassword,
    clearError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
