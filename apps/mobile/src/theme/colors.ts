// Color palette
const palette = {
  // Primary colors
  primary50: '#EFF6FF',
  primary100: '#DBEAFE',
  primary200: '#BFDBFE',
  primary300: '#93C5FD',
  primary400: '#60A5FA',
  primary500: '#3B82F6',
  primary600: '#2563EB',
  primary700: '#1D4ED8',
  primary800: '#1E40AF',
  primary900: '#1E3A8A',

  // Secondary colors
  secondary50: '#F8FAFC',
  secondary100: '#F1F5F9',
  secondary200: '#E2E8F0',
  secondary300: '#CBD5E1',
  secondary400: '#94A3B8',
  secondary500: '#64748B',
  secondary600: '#475569',
  secondary700: '#334155',
  secondary800: '#1E293B',
  secondary900: '#0F172A',

  // Success colors
  success50: '#F0FDF4',
  success100: '#DCFCE7',
  success200: '#BBF7D0',
  success300: '#86EFAC',
  success400: '#4ADE80',
  success500: '#22C55E',
  success600: '#16A34A',
  success700: '#15803D',
  success800: '#166534',
  success900: '#14532D',

  // Warning colors
  warning50: '#FFFBEB',
  warning100: '#FEF3C7',
  warning200: '#FDE68A',
  warning300: '#FCD34D',
  warning400: '#FBBF24',
  warning500: '#F59E0B',
  warning600: '#D97706',
  warning700: '#B45309',
  warning800: '#92400E',
  warning900: '#78350F',

  // Error colors
  error50: '#FEF2F2',
  error100: '#FEE2E2',
  error200: '#FECACA',
  error300: '#FCA5A5',
  error400: '#F87171',
  error500: '#EF4444',
  error600: '#DC2626',
  error700: '#B91C1C',
  error800: '#991B1B',
  error900: '#7F1D1D',

  // Neutral colors
  neutral50: '#FAFAFA',
  neutral100: '#F5F5F5',
  neutral200: '#E5E5E5',
  neutral300: '#D4D4D4',
  neutral400: '#A3A3A3',
  neutral500: '#737373',
  neutral600: '#525252',
  neutral700: '#404040',
  neutral800: '#262626',
  neutral900: '#171717',

  // Special colors
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

// Light theme colors
export const lightThemeColors = {
  // Primary
  primary: palette.primary600,
  primaryLight: palette.primary100,
  primaryDark: palette.primary800,

  // Secondary
  secondary: palette.secondary500,
  secondaryLight: palette.secondary100,
  secondaryDark: palette.secondary700,

  // Background
  background: palette.white,
  backgroundSecondary: palette.neutral50,
  surface: palette.white,
  surfaceSecondary: palette.neutral100,

  // Text
  text: palette.neutral900,
  textSecondary: palette.neutral600,
  textTertiary: palette.neutral400,
  textOnPrimary: palette.white,
  textOnSecondary: palette.white,

  // Border
  border: palette.neutral200,
  borderLight: palette.neutral100,
  borderDark: palette.neutral300,

  // Status
  success: palette.success500,
  successLight: palette.success100,
  successDark: palette.success700,

  warning: palette.warning500,
  warningLight: palette.warning100,
  warningDark: palette.warning700,

  error: palette.error500,
  errorLight: palette.error100,
  errorDark: palette.error700,

  // Interactive
  link: palette.primary600,
  linkHover: palette.primary700,
  linkVisited: palette.primary800,

  // Accent
  accent: palette.primary500,
  accentLight: palette.primary100,
  accentDark: palette.primary700,

  // Shadow
  shadow: palette.black,
  shadowLight: palette.neutral300,

  // Special
  overlay: 'rgba(0, 0, 0, 0.5)',
  backdrop: 'rgba(0, 0, 0, 0.25)',
};

// Dark theme colors
export const darkThemeColors = {
  // Primary
  primary: palette.primary400,
  primaryLight: palette.primary300,
  primaryDark: palette.primary600,

  // Secondary
  secondary: palette.secondary400,
  secondaryLight: palette.secondary300,
  secondaryDark: palette.secondary600,

  // Background
  background: palette.neutral900,
  backgroundSecondary: palette.neutral800,
  surface: palette.neutral800,
  surfaceSecondary: palette.neutral700,

  // Text
  text: palette.neutral100,
  textSecondary: palette.neutral300,
  textTertiary: palette.neutral500,
  textOnPrimary: palette.neutral900,
  textOnSecondary: palette.neutral900,

  // Border
  border: palette.neutral700,
  borderLight: palette.neutral600,
  borderDark: palette.neutral800,

  // Status
  success: palette.success400,
  successLight: palette.success900,
  successDark: palette.success300,

  warning: palette.warning400,
  warningLight: palette.warning900,
  warningDark: palette.warning300,

  error: palette.error400,
  errorLight: palette.error900,
  errorDark: palette.error300,

  // Interactive
  link: palette.primary400,
  linkHover: palette.primary300,
  linkVisited: palette.primary500,

  // Accent
  accent: palette.primary400,
  accentLight: palette.primary900,
  accentDark: palette.primary300,

  // Shadow
  shadow: palette.black,
  shadowLight: palette.neutral800,

  // Special
  overlay: 'rgba(0, 0, 0, 0.7)',
  backdrop: 'rgba(0, 0, 0, 0.5)',
};

export type ThemeColors = typeof lightThemeColors;