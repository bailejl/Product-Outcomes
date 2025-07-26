import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { API_CONFIG, AUTH_CONFIG, ERROR_MESSAGES } from '../config';
import { ApiResponse, PaginatedResponse } from '../types';
import { notificationService } from './notification';

interface RequestQueue {
  id: string;
  config: AxiosRequestConfig;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  retries: number;
}

class ApiService {
  private axiosInstance: AxiosInstance;
  private requestQueue: RequestQueue[] = [];
  private isOnline: boolean = true;
  private processingQueue: boolean = false;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.setupNetworkListener();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // Add auth token if available
        const token = await AsyncStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request timestamp
        config.metadata = { startTime: Date.now() };

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        // Calculate request duration
        const duration = Date.now() - response.config.metadata?.startTime;
        console.log(`API Request completed in ${duration}ms:`, response.config.url);

        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // Handle 401 errors (authentication)
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            // Try to refresh token
            const refreshToken = await AsyncStorage.getItem(AUTH_CONFIG.REFRESH_TOKEN_KEY);
            if (refreshToken) {
              const response = await this.refreshToken(refreshToken);
              const { token } = response.data;
              
              await AsyncStorage.setItem(AUTH_CONFIG.TOKEN_KEY, token);
              originalRequest.headers.Authorization = `Bearer ${token}`;
              
              return this.axiosInstance(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            await this.handleAuthenticationError();
            return Promise.reject(refreshError);
          }
        }

        // Handle network errors
        if (!error.response && !this.isOnline) {
          return this.handleOfflineRequest(originalRequest);
        }

        // Handle specific error codes
        return this.handleApiError(error);
      }
    );
  }

  private setupNetworkListener(): void {
    NetInfo.addEventListener((state) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (wasOffline && this.isOnline) {
        this.processRequestQueue();
      }
    });
  }

  private async handleOfflineRequest(config: AxiosRequestConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        id: Date.now().toString(),
        config,
        resolve,
        reject,
        retries: 0,
      });

      notificationService.showToast({
        type: 'warning',
        title: 'Offline',
        message: 'Request queued. Will retry when connection is restored.',
      });
    });
  }

  private async processRequestQueue(): Promise<void> {
    if (this.processingQueue || this.requestQueue.length === 0) return;

    this.processingQueue = true;

    while (this.requestQueue.length > 0 && this.isOnline) {
      const queuedRequest = this.requestQueue.shift();
      if (!queuedRequest) continue;

      try {
        const response = await this.axiosInstance(queuedRequest.config);
        queuedRequest.resolve(response);
      } catch (error) {
        queuedRequest.retries++;
        
        if (queuedRequest.retries < API_CONFIG.RETRY_ATTEMPTS) {
          // Re-queue for retry
          this.requestQueue.unshift(queuedRequest);
          await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY));
        } else {
          queuedRequest.reject(error);
        }
      }
    }

    this.processingQueue = false;

    if (this.requestQueue.length === 0) {
      notificationService.showToast({
        type: 'success',
        title: 'Sync Complete',
        message: 'All pending requests have been processed.',
      });
    }
  }

  private async handleAuthenticationError(): Promise<void> {
    // Clear stored auth data
    await Promise.all([
      AsyncStorage.removeItem(AUTH_CONFIG.TOKEN_KEY),
      AsyncStorage.removeItem(AUTH_CONFIG.REFRESH_TOKEN_KEY),
      AsyncStorage.removeItem(AUTH_CONFIG.USER_KEY),
    ]);

    notificationService.showToast({
      type: 'error',
      title: 'Session Expired',
      message: 'Please log in again to continue.',
    });

    // Note: Navigation to login screen should be handled by the auth context
  }

  private handleApiError(error: any): Promise<never> {
    let message = ERROR_MESSAGES.GENERIC_ERROR;

    if (error.code === 'ECONNABORTED') {
      message = ERROR_MESSAGES.TIMEOUT_ERROR;
    } else if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          message = data?.message || ERROR_MESSAGES.VALIDATION_ERROR;
          break;
        case 401:
          message = ERROR_MESSAGES.AUTHENTICATION_ERROR;
          break;
        case 403:
          message = ERROR_MESSAGES.AUTHORIZATION_ERROR;
          break;
        case 404:
          message = 'The requested resource was not found.';
          break;
        case 429:
          message = 'Too many requests. Please try again later.';
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          message = ERROR_MESSAGES.SERVER_ERROR;
          break;
        default:
          message = data?.message || ERROR_MESSAGES.GENERIC_ERROR;
      }
    } else if (error.request) {
      // Network error
      message = ERROR_MESSAGES.NETWORK_ERROR;
    }

    const enhancedError = {
      ...error,
      message,
      isApiError: true,
    };

    return Promise.reject(enhancedError);
  }

  private async refreshToken(refreshToken: string): Promise<AxiosResponse> {
    return this.axiosInstance.post('/auth/refresh', { refreshToken });
  }

  // Public API methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.get(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.post(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.put(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.patch(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.delete(url, config);
    return response.data;
  }

  // Paginated requests
  async getPaginated<T>(
    url: string,
    params?: { page?: number; limit?: number; [key: string]: any },
    config?: AxiosRequestConfig
  ): Promise<PaginatedResponse<T>> {
    const response = await this.axiosInstance.get(url, {
      ...config,
      params: {
        page: 1,
        limit: 20,
        ...params,
      },
    });
    return response.data;
  }

  // File upload
  async uploadFile(
    url: string,
    file: any,
    onProgress?: (progress: number) => void,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.axiosInstance.post(url, formData, {
      ...config,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...config?.headers,
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
    
    return response.data;
  }

  // Batch requests
  async batch(requests: Array<() => Promise<any>>): Promise<any[]> {
    const chunks = [];
    const chunkSize = API_CONFIG.MAX_CONCURRENT_REQUESTS;

    for (let i = 0; i < requests.length; i += chunkSize) {
      chunks.push(requests.slice(i, i + chunkSize));
    }

    const results = [];
    
    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(request => request())
      );
      results.push(...chunkResults);
    }

    return results;
  }

  // Set auth token
  setAuthToken(token: string): void {
    this.axiosInstance.defaults.headers.common.Authorization = `Bearer ${token}`;
  }

  // Clear auth token
  clearAuthToken(): void {
    delete this.axiosInstance.defaults.headers.common.Authorization;
  }

  // Get network status
  getNetworkStatus(): boolean {
    return this.isOnline;
  }

  // Get pending requests count
  getPendingRequestsCount(): number {
    return this.requestQueue.length;
  }

  // Clear request queue
  clearRequestQueue(): void {
    this.requestQueue.forEach(request => {
      request.reject(new Error('Request cancelled'));
    });
    this.requestQueue = [];
  }
}

export const apiService = new ApiService();
export default apiService;