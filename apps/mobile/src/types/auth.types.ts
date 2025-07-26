export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatar?: string;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'GUEST';

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
  biometricEnabled: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  acceptTerms: boolean;
}

export interface BiometricConfig {
  isAvailable: boolean;
  biometryType: 'TouchID' | 'FaceID' | 'Fingerprint' | null;
  isEnabled: boolean;
  hasHardware: boolean;
  hasEnrolledFingerprints: boolean;
}

export interface OAuthProvider {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface PasswordStrength {
  score: number;
  feedback: string[];
  isValid: boolean;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  refreshToken?: string;
  user?: User;
  error?: string;
  message?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface SecuritySettings {
  biometricLogin: boolean;
  twoFactorAuth: boolean;
  sessionTimeout: number;
  autoLock: boolean;
  autoLockTime: number;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: string;
  isCompleted: boolean;
  isRequired: boolean;
}

export interface FormValidationState {
  isValid: boolean;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
}