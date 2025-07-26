import { useState, useEffect, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import AuthService from '../services/AuthService';
import { 
  AuthState, 
  LoginCredentials, 
  RegisterCredentials, 
  BiometricConfig,
  User 
} from '../types/auth.types';

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    refreshToken: null,
    isLoading: true,
    error: null,
    biometricEnabled: false,
  });

  const [biometricConfig, setBiometricConfig] = useState<BiometricConfig>({
    isAvailable: false,
    biometryType: null,
    isEnabled: false,
    hasHardware: false,
    hasEnrolledFingerprints: false,
  });

  // Initialize auth state
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const [isAuthenticated, userData, biometricEnabled, biometricAvailability] = await Promise.all([
        AuthService.isAuthenticated(),
        AuthService.getUserData(),
        AuthService.isBiometricEnabled(),
        AuthService.checkBiometricAvailability(),
      ]);

      const token = await AuthService.getToken();

      setBiometricConfig(biometricAvailability);
      
      setAuthState({
        isAuthenticated,
        user: userData,
        token,
        refreshToken: null, // We don't expose refresh token
        isLoading: false,
        error: null,
        biometricEnabled,
      });
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize auth',
      }));
    }
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await AuthService.login(credentials);
      
      if (response.success && response.user && response.token) {
        setAuthState({
          isAuthenticated: true,
          user: response.user,
          token: response.token,
          refreshToken: null,
          isLoading: false,
          error: null,
          biometricEnabled: await AuthService.isBiometricEnabled(),
        });
        return { success: true };
      } else {
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: response.error || 'Login failed',
        }));
        return { success: false, error: response.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return { success: false, error: errorMessage };
    }
  }, []);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await AuthService.register(credentials);
      
      if (response.success && response.user && response.token) {
        setAuthState({
          isAuthenticated: true,
          user: response.user,
          token: response.token,
          refreshToken: null,
          isLoading: false,
          error: null,
          biometricEnabled: false,
        });
        return { success: true };
      } else {
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: response.error || 'Registration failed',
        }));
        return { success: false, error: response.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return { success: false, error: errorMessage };
    }
  }, []);

  const loginWithBiometrics = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await AuthService.authenticateWithBiometrics();
      
      if (response.success && response.user && response.token) {
        setAuthState({
          isAuthenticated: true,
          user: response.user,
          token: response.token,
          refreshToken: null,
          isLoading: false,
          error: null,
          biometricEnabled: true,
        });
        return { success: true };
      } else {
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: response.error || 'Biometric authentication failed',
        }));
        return { success: false, error: response.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Biometric authentication failed';
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return { success: false, error: errorMessage };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      await AuthService.logout();
      
      setAuthState({
        isAuthenticated: false,
        user: null,
        token: null,
        refreshToken: null,
        isLoading: false,
        error: null,
        biometricEnabled: false,
      });
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Logout failed';
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return { success: false, error: errorMessage };
    }
  }, []);

  const enableBiometrics = useCallback(async (credentials: LoginCredentials) => {
    try {
      if (!biometricConfig.isAvailable) {
        Alert.alert(
          'Biometric Authentication Unavailable',
          'This device does not support biometric authentication or it is not set up.',
          [{ text: 'OK' }]
        );
        return { success: false, error: 'Biometric authentication not available' };
      }

      const success = await AuthService.enableBiometricLogin(credentials);
      
      if (success) {
        setAuthState(prev => ({ ...prev, biometricEnabled: true }));
        Alert.alert(
          'Biometric Authentication Enabled',
          `${biometricConfig.biometryType} has been enabled for quick sign-in.`,
          [{ text: 'OK' }]
        );
        return { success: true };
      } else {
        return { success: false, error: 'Failed to enable biometric authentication' };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to enable biometric authentication';
      return { success: false, error: errorMessage };
    }
  }, [biometricConfig]);

  const disableBiometrics = useCallback(async () => {
    try {
      await AuthService.disableBiometricLogin();
      setAuthState(prev => ({ ...prev, biometricEnabled: false }));
      
      Alert.alert(
        'Biometric Authentication Disabled',
        'Biometric authentication has been disabled. You will need to use your password to sign in.',
        [{ text: 'OK' }]
      );
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to disable biometric authentication';
      return { success: false, error: errorMessage };
    }
  }, []);

  const clearError = useCallback(() => {
    setAuthState(prev => ({ ...prev, error: null }));
  }, []);

  const updateUser = useCallback(async (userData: Partial<User>) => {
    if (authState.user) {
      const updatedUser = { ...authState.user, ...userData };
      await AuthService.storeUserData(updatedUser);
      setAuthState(prev => ({ ...prev, user: updatedUser }));
    }
  }, [authState.user]);

  return {
    // State
    ...authState,
    biometricConfig,
    
    // Actions
    login,
    register,
    logout,
    loginWithBiometrics,
    enableBiometrics,
    disableBiometrics,
    clearError,
    updateUser,
    initializeAuth,
    
    // Helper methods
    get isLoggedIn() { return authState.isAuthenticated && !!authState.user; },
    get canUseBiometrics() { return biometricConfig.isAvailable && authState.biometricEnabled; },
    get userRole() { return authState.user?.role; },
    get userName() { 
      return authState.user ? 
        `${authState.user.firstName} ${authState.user.lastName}` : 
        null;
    },
  };
};