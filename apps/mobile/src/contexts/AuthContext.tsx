import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import { authService } from '../services/auth';
import { notificationService } from '../services/notification';
import { AUTH_CONFIG } from '../config';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  deleteAccount: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [autoLogoutTimer, setAutoLogoutTimer] = useState<NodeJS.Timeout | null>(null);

  const isAuthenticated = !!user;

  // Initialize auth state on app start
  useEffect(() => {
    initializeAuth();
  }, []);

  // Setup auto-logout timer
  useEffect(() => {
    if (isAuthenticated) {
      setupAutoLogout();
    } else {
      clearAutoLogout();
    }
    return () => clearAutoLogout();
  }, [isAuthenticated]);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      
      // Check for stored authentication data
      const [token, refreshToken, userData] = await Promise.all([
        AsyncStorage.getItem(AUTH_CONFIG.TOKEN_KEY),
        AsyncStorage.getItem(AUTH_CONFIG.REFRESH_TOKEN_KEY),
        AsyncStorage.getItem(AUTH_CONFIG.USER_KEY),
      ]);

      if (token && userData) {
        // Set auth headers
        authService.setAuthToken(token);
        
        // Parse user data
        const user = JSON.parse(userData);
        setUser(user);

        // Verify token validity
        try {
          await authService.verifyToken();
        } catch (error) {
          // Token invalid, try to refresh
          if (refreshToken) {
            try {
              await refreshTokens();
            } catch (refreshError) {
              // Refresh failed, logout
              await handleLogout();
            }
          } else {
            await handleLogout();
          }
        }
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      await handleLogout();
    } finally {
      setIsLoading(false);
    }
  };

  const setupAutoLogout = () => {
    clearAutoLogout();
    const timer = setTimeout(() => {
      handleAutoLogout();
    }, AUTH_CONFIG.AUTO_LOGOUT_TIME);
    setAutoLogoutTimer(timer);
  };

  const clearAutoLogout = () => {
    if (autoLogoutTimer) {
      clearTimeout(autoLogoutTimer);
      setAutoLogoutTimer(null);
    }
  };

  const handleAutoLogout = async () => {
    await logout();
    notificationService.showToast({
      type: 'info',
      title: 'Session Expired',
      message: 'You have been logged out due to inactivity.',
    });
  };

  const login = async (email: string, password: string, rememberMe = false): Promise<void> => {
    try {
      setIsLoading(true);
      
      const response = await authService.login(email, password);
      const { user, token, refreshToken } = response;

      // Store authentication data
      await Promise.all([
        AsyncStorage.setItem(AUTH_CONFIG.TOKEN_KEY, token),
        AsyncStorage.setItem(AUTH_CONFIG.USER_KEY, JSON.stringify(user)),
        rememberMe 
          ? AsyncStorage.setItem(AUTH_CONFIG.REFRESH_TOKEN_KEY, refreshToken)
          : AsyncStorage.removeItem(AUTH_CONFIG.REFRESH_TOKEN_KEY),
      ]);

      // Set auth headers
      authService.setAuthToken(token);
      
      // Update state
      setUser(user);

      // Setup notifications
      await notificationService.setupPushNotifications(user.id);

      notificationService.showToast({
        type: 'success',
        title: 'Welcome back!',
        message: `Hello ${user.firstName}`,
      });
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: RegisterData): Promise<void> => {
    try {
      setIsLoading(true);
      
      const response = await authService.register(userData);
      const { user, token, refreshToken } = response;

      // Store authentication data
      await Promise.all([
        AsyncStorage.setItem(AUTH_CONFIG.TOKEN_KEY, token),
        AsyncStorage.setItem(AUTH_CONFIG.USER_KEY, JSON.stringify(user)),
        AsyncStorage.setItem(AUTH_CONFIG.REFRESH_TOKEN_KEY, refreshToken),
      ]);

      // Set auth headers
      authService.setAuthToken(token);
      
      // Update state
      setUser(user);

      // Setup notifications
      await notificationService.setupPushNotifications(user.id);

      notificationService.showToast({
        type: 'success',
        title: 'Welcome!',
        message: 'Your account has been created successfully.',
      });
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    await handleLogout();
    notificationService.showToast({
      type: 'info',
      title: 'Logged out',
      message: 'You have been logged out successfully.',
    });
  };

  const handleLogout = async (): Promise<void> => {
    try {
      // Clear authentication data
      await Promise.all([
        AsyncStorage.removeItem(AUTH_CONFIG.TOKEN_KEY),
        AsyncStorage.removeItem(AUTH_CONFIG.REFRESH_TOKEN_KEY),
        AsyncStorage.removeItem(AUTH_CONFIG.USER_KEY),
      ]);

      // Clear auth headers
      authService.clearAuthToken();
      
      // Clear notifications
      await notificationService.clearNotifications();
      
      // Update state
      setUser(null);
      clearAutoLogout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const refreshToken = async (): Promise<void> => {
    await refreshTokens();
  };

  const refreshTokens = async (): Promise<void> => {
    try {
      const refreshToken = await AsyncStorage.getItem(AUTH_CONFIG.REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await authService.refreshToken(refreshToken);
      const { user, token, refreshToken: newRefreshToken } = response;

      // Update stored data
      await Promise.all([
        AsyncStorage.setItem(AUTH_CONFIG.TOKEN_KEY, token),
        AsyncStorage.setItem(AUTH_CONFIG.USER_KEY, JSON.stringify(user)),
        AsyncStorage.setItem(AUTH_CONFIG.REFRESH_TOKEN_KEY, newRefreshToken),
      ]);

      // Set auth headers
      authService.setAuthToken(token);
      
      // Update state
      setUser(user);
    } catch (error) {
      await handleLogout();
      throw error;
    }
  };

  const updateProfile = async (data: Partial<User>): Promise<void> => {
    try {
      if (!user) throw new Error('User not authenticated');

      const updatedUser = await authService.updateProfile(data);
      
      // Update stored user data
      await AsyncStorage.setItem(AUTH_CONFIG.USER_KEY, JSON.stringify(updatedUser));
      
      // Update state
      setUser(updatedUser);

      notificationService.showToast({
        type: 'success',
        title: 'Profile Updated',
        message: 'Your profile has been updated successfully.',
      });
    } catch (error) {
      throw error;
    }
  };

  const deleteAccount = async (): Promise<void> => {
    try {
      if (!user) throw new Error('User not authenticated');

      await authService.deleteAccount();
      await handleLogout();

      notificationService.showToast({
        type: 'info',
        title: 'Account Deleted',
        message: 'Your account has been deleted successfully.',
      });
    } catch (error) {
      throw error;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    try {
      await authService.changePassword(currentPassword, newPassword);

      notificationService.showToast({
        type: 'success',
        title: 'Password Changed',
        message: 'Your password has been changed successfully.',
      });
    } catch (error) {
      throw error;
    }
  };

  const requestPasswordReset = async (email: string): Promise<void> => {
    try {
      await authService.requestPasswordReset(email);

      notificationService.showToast({
        type: 'success',
        title: 'Reset Email Sent',
        message: 'Please check your email for password reset instructions.',
      });
    } catch (error) {
      throw error;
    }
  };

  const resetPassword = async (token: string, newPassword: string): Promise<void> => {
    try {
      await authService.resetPassword(token, newPassword);

      notificationService.showToast({
        type: 'success',
        title: 'Password Reset',
        message: 'Your password has been reset successfully.',
      });
    } catch (error) {
      throw error;
    }
  };

  const verifyEmail = async (token: string): Promise<void> => {
    try {
      const updatedUser = await authService.verifyEmail(token);
      
      if (user) {
        const newUser = { ...user, emailVerified: true };
        setUser(newUser);
        await AsyncStorage.setItem(AUTH_CONFIG.USER_KEY, JSON.stringify(newUser));
      }

      notificationService.showToast({
        type: 'success',
        title: 'Email Verified',
        message: 'Your email has been verified successfully.',
      });
    } catch (error) {
      throw error;
    }
  };

  const resendVerification = async (): Promise<void> => {
    try {
      if (!user) throw new Error('User not authenticated');

      await authService.resendVerification();

      notificationService.showToast({
        type: 'success',
        title: 'Verification Sent',
        message: 'A new verification email has been sent.',
      });
    } catch (error) {
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    refreshToken,
    updateProfile,
    deleteAccount,
    changePassword,
    requestPasswordReset,
    resetPassword,
    verifyEmail,
    resendVerification,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};