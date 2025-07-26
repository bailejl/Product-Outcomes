// Core types for the mobile app
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  roles: UserRole[];
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  avatar?: string;
  preferences?: UserPreferences;
}

export interface UserRole {
  id: string;
  name: string;
  permissions: string[];
  isActive: boolean;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: NotificationSettings;
  dashboard: DashboardSettings;
}

export interface NotificationSettings {
  push: boolean;
  email: boolean;
  okrUpdates: boolean;
  comments: boolean;
  mentions: boolean;
  dueDates: boolean;
}

export interface DashboardSettings {
  defaultView: 'list' | 'grid' | 'chart';
  showCompleted: boolean;
  sortBy: 'dueDate' | 'progress' | 'title' | 'priority';
  groupBy: 'none' | 'status' | 'period' | 'organization';
}

export interface OKR {
  id: string;
  title: string;
  description?: string;
  status: OKRStatus;
  period: OKRPeriod;
  visibility: OKRVisibility;
  startDate: Date;
  endDate: Date;
  progress: number;
  targetProgress: number;
  owner: User;
  organization: Organization;
  keyResults: KeyResult[];
  comments: OKRComment[];
  metadata?: OKRMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export enum OKRStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum OKRPeriod {
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
  CUSTOM = 'custom',
}

export enum OKRVisibility {
  PUBLIC = 'public',
  ORGANIZATION = 'organization',
  TEAM = 'team',
  PRIVATE = 'private',
}

export interface OKRMetadata {
  tags?: string[];
  priority?: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  department?: string;
  stakeholders?: string[];
  milestones?: Milestone[];
}

export interface Milestone {
  id: string;
  title: string;
  dueDate: Date;
  completed: boolean;
}

export interface KeyResult {
  id: string;
  title: string;
  description?: string;
  type: 'number' | 'percentage' | 'boolean';
  targetValue: number;
  currentValue: number;
  unit?: string;
  status: OKRStatus;
  okr: OKR;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OKRComment {
  id: string;
  content: string;
  author: User;
  okr: OKR;
  parentComment?: OKRComment;
  mentions: User[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  settings: OrganizationSettings;
  okrs: OKR[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationSettings {
  allowPublicOKRs: boolean;
  requireApproval: boolean;
  defaultPeriod: OKRPeriod;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  isRead: boolean;
  readAt?: Date;
  actionUrl?: string;
  metadata?: Record<string, any>;
  recipient: User;
  sender?: User;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum NotificationType {
  OKR_UPDATE = 'okr_update',
  OKR_COMMENT = 'okr_comment',
  OKR_ASSIGNED = 'okr_assigned',
  OKR_DUE_SOON = 'okr_due_soon',
  OKR_COMPLETED = 'okr_completed',
  USER_MENTIONED = 'user_mentioned',
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
  COLLABORATION_INVITE = 'collaboration_invite',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  OKRDetail: { okrId: string };
  Profile: undefined;
  Settings: undefined;
  Notifications: undefined;
  Search: { query?: string };
  CreateOKR: undefined;
  EditOKR: { okrId: string };
};

export type MainTabParamList = {
  Dashboard: undefined;
  OKRs: undefined;
  Profile: undefined;
  Search: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
};

// Search and filter types
export interface SearchFilters {
  status?: OKRStatus[];
  period?: OKRPeriod[];
  priority?: string[];
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  tags?: string[];
  owner?: string;
  organization?: string;
}

export interface SortOptions {
  field: 'title' | 'progress' | 'dueDate' | 'createdAt' | 'priority';
  direction: 'asc' | 'desc';
}

// Theme types
export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    warning: string;
    success: string;
    info: string;
    disabled: string;
    placeholder: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  typography: {
    h1: TextStyle;
    h2: TextStyle;
    h3: TextStyle;
    body: TextStyle;
    caption: TextStyle;
    button: TextStyle;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  shadows: {
    sm: object;
    md: object;
    lg: object;
  };
}

// Component props types
export interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightComponent?: React.ReactNode;
  backgroundColor?: string;
}

export interface LoadingProps {
  size?: 'small' | 'large';
  color?: string;
  overlay?: boolean;
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  illustration?: string;
  action?: {
    title: string;
    onPress: () => void;
  };
}

export interface ErrorStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
}

// Real-time types
export interface SocketEvent {
  type: string;
  payload: any;
  timestamp: Date;
}

export interface PresenceUser {
  userId: string;
  user: User;
  status: 'online' | 'away' | 'offline';
  lastSeen?: Date;
}

// Deep linking types
export interface DeepLinkParams {
  screen?: string;
  params?: Record<string, any>;
}

// Analytics types
export interface AnalyticsEvent {
  name: string;
  parameters?: Record<string, any>;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}