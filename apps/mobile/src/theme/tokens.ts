import { Dimensions, Platform, PixelRatio } from 'react-native';

const { width, height } = Dimensions.get('window');

// Responsive breakpoints
export const breakpoints = {
  small: 320,
  medium: 768,
  large: 1024,
  extraLarge: 1200,
};

// Get responsive size based on screen width
export const getResponsiveSize = (size: number): number => {
  const scale = width / 320;
  const newSize = size * scale;
  
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  } else {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 2;
  }
};

// Screen dimensions
export const screenDimensions = {
  width,
  height,
  isSmallScreen: width < breakpoints.medium,
  isTablet: width >= breakpoints.medium,
  isLargeScreen: width >= breakpoints.large,
};

// Spacing tokens
export const spacing = {
  xs: getResponsiveSize(4),
  sm: getResponsiveSize(8),
  md: getResponsiveSize(16),
  lg: getResponsiveSize(24),
  xl: getResponsiveSize(32),
  '2xl': getResponsiveSize(48),
  '3xl': getResponsiveSize(64),
};

// Typography tokens
export const typography = {
  fontSize: {
    xs: getResponsiveSize(12),
    sm: getResponsiveSize(14),
    base: getResponsiveSize(16),
    lg: getResponsiveSize(18),
    xl: getResponsiveSize(20),
    '2xl': getResponsiveSize(24),
    '3xl': getResponsiveSize(30),
    '4xl': getResponsiveSize(36),
    '5xl': getResponsiveSize(48),
  },
  lineHeight: {
    tight: 1.2,
    snug: 1.4,
    normal: 1.5,
    relaxed: 1.6,
    loose: 2,
  },
  fontWeight: {
    thin: '100' as const,
    light: '300' as const,
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
    black: '900' as const,
  },
  fontFamily: {
    system: Platform.select({
      ios: 'System',
      android: 'Roboto',
    }),
    systemMedium: Platform.select({
      ios: 'System',
      android: 'Roboto-Medium',
    }),
    systemBold: Platform.select({
      ios: 'System',
      android: 'Roboto-Bold',
    }),
  },
};

// Border radius tokens
export const borderRadius = {
  none: 0,
  sm: getResponsiveSize(4),
  base: getResponsiveSize(8),
  md: getResponsiveSize(12),
  lg: getResponsiveSize(16),
  xl: getResponsiveSize(24),
  '2xl': getResponsiveSize(32),
  '3xl': getResponsiveSize(48),
  full: 9999,
};

// Shadow tokens
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  base: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 16,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 24,
  },
};

// Animation tokens
export const animations = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 350,
  },
  easing: {
    linear: 'linear' as const,
    ease: 'ease' as const,
    easeIn: 'ease-in' as const,
    easeOut: 'ease-out' as const,
    easeInOut: 'ease-in-out' as const,
  },
};

// Platform-specific tokens
export const platform = {
  isIOS: Platform.OS === 'ios',
  isAndroid: Platform.OS === 'android',
  statusBarHeight: Platform.select({
    ios: 44,
    android: 24,
  }),
  bottomSafeArea: Platform.select({
    ios: 34,
    android: 0,
  }),
};