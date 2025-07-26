import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Keychain from '@react-native-keychain/react-native-keychain';
import TouchID from 'react-native-touch-id';
import ReactNativeBiometrics from 'react-native-biometrics';
import DeviceInfo from 'react-native-device-info';
import { 
  AuthState, 
  LoginCredentials, 
  RegisterCredentials, 
  AuthResponse, 
  BiometricConfig,
  TokenPair,
  User 
} from '../types/auth.types';

// Constants for storage keys
const STORAGE_KEYS = {
  AUTH_TOKEN: '@auth_token',
  REFRESH_TOKEN: '@refresh_token',
  USER_DATA: '@user_data',
  BIOMETRIC_ENABLED: '@biometric_enabled',
  SECURITY_SETTINGS: '@security_settings',
} as const;

class AuthService {
  private static instance: AuthService;
  private biometrics: any;
  
  constructor() {
    this.biometrics = new ReactNativeBiometrics();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Authentication API calls
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();
      
      if (data.success) {
        await this.storeTokens({
          accessToken: data.token,
          refreshToken: data.refreshToken,
          expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
        });
        
        await this.storeUserData(data.user);
        
        // Setup biometrics if enabled
        if (credentials.rememberMe) {
          await this.enableBiometricLogin(credentials);
        }
      }

      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    }
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();
      
      if (data.success) {
        await this.storeTokens({
          accessToken: data.token,
          refreshToken: data.refreshToken,
          expiresAt: Date.now() + (24 * 60 * 60 * 1000),
        });
        
        await this.storeUserData(data.user);
      }

      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      };
    }
  }

  async logout(): Promise<void> {
    try {
      // Call logout API
      const token = await this.getToken();
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      // Clear all stored data
      await this.clearStoredData();
    }
  }

  async refreshToken(): Promise<string | null> {
    try {
      const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) return null;

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();
      
      if (data.success) {
        await this.storeTokens({
          accessToken: data.token,
          refreshToken: data.refreshToken,
          expiresAt: Date.now() + (24 * 60 * 60 * 1000),
        });
        return data.token;
      }
      
      return null;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }

  // Biometric authentication
  async checkBiometricAvailability(): Promise<BiometricConfig> {
    try {
      const { available, biometryType } = await this.biometrics.isSensorAvailable();
      const hasHardware = await TouchID.isSupported();
      
      return {
        isAvailable: available,
        biometryType: biometryType as 'TouchID' | 'FaceID' | 'Fingerprint' | null,
        isEnabled: await this.isBiometricEnabled(),
        hasHardware: !!hasHardware,
        hasEnrolledFingerprints: available,
      };
    } catch (error) {
      return {
        isAvailable: false,
        biometryType: null,
        isEnabled: false,
        hasHardware: false,
        hasEnrolledFingerprints: false,
      };
    }
  }

  async enableBiometricLogin(credentials: LoginCredentials): Promise<boolean> {
    try {
      const biometricConfig = await this.checkBiometricAvailability();
      if (!biometricConfig.isAvailable) return false;

      // Store credentials securely for biometric login
      await Keychain.setInternetCredentials(
        'ProductOutcomesAuth',
        credentials.email,
        credentials.password,
        {
          accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
          authenticationType: Keychain.AUTHENTICATION_TYPE.BIOMETRICS,
        }
      );

      await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, 'true');
      return true;
    } catch (error) {
      console.error('Failed to enable biometric login:', error);
      return false;
    }
  }

  async authenticateWithBiometrics(): Promise<AuthResponse> {
    try {
      const biometricConfig = await this.checkBiometricAvailability();
      if (!biometricConfig.isAvailable || !biometricConfig.isEnabled) {
        return { success: false, error: 'Biometric authentication not available' };
      }

      // Authenticate with biometrics
      const biometricResult = await this.biometrics.simplePrompt({
        promptMessage: 'Authenticate to sign in',
        cancelButtonText: 'Cancel',
      });

      if (!biometricResult.success) {
        return { success: false, error: 'Biometric authentication failed' };
      }

      // Retrieve stored credentials
      const credentials = await Keychain.getInternetCredentials('ProductOutcomesAuth');
      if (!credentials || credentials === false) {
        return { success: false, error: 'No stored credentials found' };
      }

      // Use stored credentials to log in
      return await this.login({
        email: credentials.username,
        password: credentials.password,
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Biometric authentication failed',
      };
    }
  }

  async disableBiometricLogin(): Promise<void> {
    try {
      await Keychain.resetInternetCredentials('ProductOutcomesAuth');
      await AsyncStorage.removeItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
    } catch (error) {
      console.error('Failed to disable biometric login:', error);
    }
  }

  // Token and storage management
  async storeTokens(tokens: TokenPair): Promise<void> {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.AUTH_TOKEN, tokens.accessToken],
      [STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken],
    ]);
  }

  async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  }

  async storeUserData(user: User): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
  }

  async getUserData(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      return userData ? JSON.parse(userData) : null;
    } catch {
      return null;
    }
  }

  async isBiometricEnabled(): Promise<boolean> {
    const enabled = await AsyncStorage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
    return enabled === 'true';
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }

  async clearStoredData(): Promise<void> {
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    await Keychain.resetInternetCredentials('ProductOutcomesAuth');
  }

  // Device security
  async getDeviceInfo() {
    return {
      deviceId: await DeviceInfo.getUniqueId(),
      model: DeviceInfo.getModel(),
      systemName: DeviceInfo.getSystemName(),
      systemVersion: DeviceInfo.getSystemVersion(),
      brand: DeviceInfo.getBrand(),
      isEmulator: await DeviceInfo.isEmulator(),
      hasNotch: DeviceInfo.hasNotch(),
      bundleId: DeviceInfo.getBundleId(),
    };
  }
}

export default AuthService.getInstance();