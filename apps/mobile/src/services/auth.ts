import { User } from '../types';
import { apiService } from './api';

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

class AuthService {
  // Authentication endpoints
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await apiService.post<LoginResponse>('/auth/login', {
      email,
      password,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Login failed');
    }

    return response.data;
  }

  async register(userData: RegisterData): Promise<LoginResponse> {
    const response = await apiService.post<LoginResponse>('/auth/register', userData);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Registration failed');
    }

    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await apiService.post('/auth/logout');
    } catch (error) {
      // Continue with logout even if server request fails
      console.warn('Logout request failed:', error);
    }
  }

  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    const response = await apiService.post<LoginResponse>('/auth/refresh', {
      refreshToken,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Token refresh failed');
    }

    return response.data;
  }

  async verifyToken(): Promise<User> {
    const response = await apiService.get<User>('/auth/verify');

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Token verification failed');
    }

    return response.data;
  }

  // Profile management
  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await apiService.patch<User>('/auth/profile', data);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Profile update failed');
    }

    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const response = await apiService.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });

    if (!response.success) {
      throw new Error(response.error || 'Password change failed');
    }
  }

  async deleteAccount(): Promise<void> {
    const response = await apiService.delete('/auth/account');

    if (!response.success) {
      throw new Error(response.error || 'Account deletion failed');
    }
  }

  // Password reset
  async requestPasswordReset(email: string): Promise<void> {
    const response = await apiService.post('/auth/forgot-password', { email });

    if (!response.success) {
      throw new Error(response.error || 'Password reset request failed');
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const response = await apiService.post('/auth/reset-password', {
      token,
      newPassword,
    });

    if (!response.success) {
      throw new Error(response.error || 'Password reset failed');
    }
  }

  // Email verification
  async verifyEmail(token: string): Promise<User> {
    const response = await apiService.post<User>('/auth/verify-email', { token });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Email verification failed');
    }

    return response.data;
  }

  async resendVerification(): Promise<void> {
    const response = await apiService.post('/auth/resend-verification');

    if (!response.success) {
      throw new Error(response.error || 'Resend verification failed');
    }
  }

  // Utility methods
  setAuthToken(token: string): void {
    apiService.setAuthToken(token);
  }

  clearAuthToken(): void {
    apiService.clearAuthToken();
  }
}

export const authService = new AuthService();
export default authService;