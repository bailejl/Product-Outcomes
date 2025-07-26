import { Platform } from 'react-native';

// API Configuration
export const API_CONFIG = {
  BASE_URL: __DEV__ 
    ? Platform.OS === 'ios' 
      ? 'http://localhost:3000' 
      : 'http://10.0.2.2:3000'
    : 'https://api.product-outcomes.com',
  GRAPHQL_URL: '/graphql',
  WS_URL: '/socket.io',
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

// Authentication Configuration
export const AUTH_CONFIG = {
  TOKEN_KEY: 'auth_token',
  REFRESH_TOKEN_KEY: 'refresh_token',
  USER_KEY: 'user_data',
  BIOMETRIC_KEY: 'biometric_enabled',
  AUTO_LOGOUT_TIME: 30 * 60 * 1000, // 30 minutes
  LOCK_AFTER_ATTEMPTS: 5,
  LOCK_DURATION: 30 * 60 * 1000, // 30 minutes
};

// Storage Configuration
export const STORAGE_CONFIG = {
  CACHE_PREFIX: 'po_cache_',
  USER_PREFERENCES: 'user_preferences',
  OFFLINE_DATA: 'offline_data',
  SEARCH_HISTORY: 'search_history',
  DRAFT_OKRS: 'draft_okrs',
  MAX_CACHE_SIZE: 50 * 1024 * 1024, // 50MB
  CACHE_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
};

// Notification Configuration
export const NOTIFICATION_CONFIG = {
  CHANNELS: {
    OKR_UPDATES: 'okr_updates',
    COMMENTS: 'comments',
    MENTIONS: 'mentions',
    REMINDERS: 'reminders',
    SYSTEM: 'system',
  },
  DEFAULT_SOUND: 'default',
  BADGE_COUNT_KEY: 'badge_count',
};

// Performance Configuration
export const PERFORMANCE_CONFIG = {
  LIST_PAGE_SIZE: 20,
  SEARCH_DEBOUNCE: 300,
  IMAGE_CACHE_SIZE: 100,
  MAX_CONCURRENT_REQUESTS: 5,
  OFFLINE_SYNC_INTERVAL: 60000, // 1 minute
  TELEMETRY_BATCH_SIZE: 10,
  TELEMETRY_FLUSH_INTERVAL: 30000, // 30 seconds
};

// UI Configuration
export const UI_CONFIG = {
  ANIMATION_DURATION: 300,
  TOAST_DURATION: 3000,
  BOTTOM_SHEET_SNAP_POINTS: ['25%', '50%', '90%'],
  REFRESH_CONTROL_COLORS: ['#007AFF'],
  SKELETON_ANIMATION_SPEED: 800,
  HAPTIC_FEEDBACK: true,
};

// Theme Configuration
export const THEME_CONFIG = {
  DEFAULT_THEME: 'light' as const,
  SYSTEM_THEME_ENABLED: true,
  CUSTOM_THEMES: ['light', 'dark', 'auto'] as const,
  COLOR_SCHEME_TRANSITION: 200,
};

// Security Configuration
export const SECURITY_CONFIG = {
  CERTIFICATE_PINNING: !__DEV__,
  NETWORK_SECURITY: true,
  SCREENSHOT_PROTECTION: false,
  ROOT_DETECTION: !__DEV__,
  DEBUG_PROTECTION: !__DEV__,
  OBFUSCATION: !__DEV__,
};

// Analytics Configuration
export const ANALYTICS_CONFIG = {
  ENABLED: !__DEV__,
  ANONYMOUS_ID_KEY: 'anonymous_id',
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  TRACK_CRASHES: true,
  TRACK_PERFORMANCE: true,
  TRACK_USER_PROPERTIES: true,
  DEBUG_LOGGING: __DEV__,
};

// Deep Linking Configuration
export const DEEP_LINK_CONFIG = {
  SCHEME: 'productoutcomes',
  HOST: 'app',
  UNIVERSAL_LINK_DOMAIN: 'product-outcomes.com',
  SUPPORTED_ROUTES: [
    'okr/:id',
    'profile/:userId',
    'search',
    'notifications',
    'settings',
  ],
};

// Offline Configuration
export const OFFLINE_CONFIG = {
  ENABLED: true,
  MAX_OFFLINE_ACTIONS: 100,
  SYNC_RETRY_ATTEMPTS: 3,
  SYNC_RETRY_DELAY: 5000,
  OFFLINE_INDICATOR_DELAY: 2000,
  QUEUE_PROCESSOR_INTERVAL: 5000,
};

// Feature Flags
export const FEATURE_FLAGS = {
  BIOMETRIC_AUTH: true,
  DARK_MODE: true,
  OFFLINE_MODE: true,
  PUSH_NOTIFICATIONS: true,
  ANALYTICS: !__DEV__,
  DEEP_LINKING: true,
  REAL_TIME_UPDATES: true,
  COLLABORATIVE_EDITING: true,
  ADVANCED_SEARCH: true,
  PERFORMANCE_MONITORING: true,
  A_B_TESTING: false,
  BETA_FEATURES: __DEV__,
};

// Environment Variables (with fallbacks)
export const ENV = {
  API_URL: process.env.REACT_APP_API_URL || API_CONFIG.BASE_URL,
  ENVIRONMENT: process.env.NODE_ENV || 'development',
  VERSION: process.env.REACT_APP_VERSION || '1.0.0',
  BUILD_NUMBER: process.env.REACT_APP_BUILD_NUMBER || '1',
  SENTRY_DSN: process.env.REACT_APP_SENTRY_DSN,
  FIREBASE_CONFIG: {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
  },
};

// Validation Configuration
export const VALIDATION_CONFIG = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  OKR_TITLE_MAX_LENGTH: 255,
  OKR_DESCRIPTION_MAX_LENGTH: 1000,
  COMMENT_MAX_LENGTH: 500,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
  AUTHENTICATION_ERROR: 'Authentication failed. Please log in again.',
  AUTHORIZATION_ERROR: 'You do not have permission to perform this action.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  SERVER_ERROR: 'Server error occurred. Please try again later.',
  OFFLINE_ERROR: 'This action requires an internet connection.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  GENERIC_ERROR: 'An unexpected error occurred. Please try again.',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  OKR_CREATED: 'OKR created successfully!',
  OKR_UPDATED: 'OKR updated successfully!',
  OKR_DELETED: 'OKR deleted successfully!',
  COMMENT_ADDED: 'Comment added successfully!',
  PROFILE_UPDATED: 'Profile updated successfully!',
  SETTINGS_SAVED: 'Settings saved successfully!',
  PASSWORD_CHANGED: 'Password changed successfully!',
  EMAIL_VERIFIED: 'Email verified successfully!',
  LOGOUT_SUCCESS: 'Logged out successfully!',
};

export default {
  API_CONFIG,
  AUTH_CONFIG,
  STORAGE_CONFIG,
  NOTIFICATION_CONFIG,
  PERFORMANCE_CONFIG,
  UI_CONFIG,
  THEME_CONFIG,
  SECURITY_CONFIG,
  ANALYTICS_CONFIG,
  DEEP_LINK_CONFIG,
  OFFLINE_CONFIG,
  FEATURE_FLAGS,
  ENV,
  VALIDATION_CONFIG,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
};