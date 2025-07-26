import { lightThemeColors, darkThemeColors, ThemeColors } from './colors';
import { spacing, typography, borderRadius, shadows, animations, platform } from './tokens';

export interface Theme {
  colors: ThemeColors;
  spacing: typeof spacing;
  typography: typeof typography;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
  animations: typeof animations;
  platform: typeof platform;
}

export const lightTheme: Theme = {
  colors: lightThemeColors,
  spacing,
  typography,
  borderRadius,
  shadows,
  animations,
  platform,
};

export const darkTheme: Theme = {
  colors: darkThemeColors,
  spacing,
  typography,
  borderRadius,
  shadows,
  animations,
  platform,
};

// Theme utilities
export const getStatusColor = (status: string, theme: Theme): string => {
  switch (status.toLowerCase()) {
    case 'draft':
      return theme.colors.textTertiary;
    case 'active':
      return theme.colors.primary;
    case 'paused':
      return theme.colors.warning;
    case 'completed':
      return theme.colors.success;
    case 'cancelled':
      return theme.colors.error;
    default:
      return theme.colors.textSecondary;
  }
};

export const getPriorityColor = (priority: string, theme: Theme): string => {
  switch (priority.toLowerCase()) {
    case 'low':
      return theme.colors.success;
    case 'medium':
      return theme.colors.warning;
    case 'high':
      return theme.colors.error;
    case 'critical':
      return theme.colors.errorDark;
    default:
      return theme.colors.textSecondary;
  }
};

export const getProgressColor = (progress: number, theme: Theme): string => {
  if (progress >= 90) return theme.colors.success;
  if (progress >= 70) return theme.colors.primary;
  if (progress >= 50) return theme.colors.warning;
  return theme.colors.error;
};

export * from './colors';
export * from './tokens';
export { lightTheme as defaultTheme };