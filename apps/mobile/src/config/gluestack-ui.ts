import { config as defaultConfig, createConfig } from '@gluestack-ui/themed';

// Create custom configuration for Gluestack UI Mobile App
const mobileConfig = createConfig({
  ...defaultConfig,
  // Custom theme configuration for mobile
  theme: {
    ...defaultConfig.theme,
    colors: {
      ...defaultConfig.theme.colors,
      // Primary brand colors
      primary: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6', // Main blue
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a',
      },
      // Secondary colors
      secondary: {
        50: '#f8fafc',
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
        700: '#334155',
        800: '#1e293b',
        900: '#0f172a',
      },
      // Success colors
      success: {
        50: '#f0fdf4',
        100: '#dcfce7',
        200: '#bbf7d0',
        300: '#86efac',
        400: '#4ade80',
        500: '#22c55e',
        600: '#16a34a',
        700: '#15803d',
        800: '#166534',
        900: '#14532d',
      },
      // Error colors
      error: {
        50: '#fef2f2',
        100: '#fee2e2',
        200: '#fecaca',
        300: '#fca5a5',
        400: '#f87171',
        500: '#ef4444',
        600: '#dc2626',
        700: '#b91c1c',
        800: '#991b1b',
        900: '#7f1d1d',
      },
      // Warning colors
      warning: {
        50: '#fffbeb',
        100: '#fef3c7',
        200: '#fde68a',
        300: '#fcd34d',
        400: '#fbbf24',
        500: '#f59e0b',
        600: '#d97706',
        700: '#b45309',
        800: '#92400e',
        900: '#78350f',
      },
    },
    space: {
      ...defaultConfig.theme.space,
      // Mobile-optimized spacing
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
      '2xl': 48,
      '3xl': 64,
    },
    fontSizes: {
      ...defaultConfig.theme.fontSizes,
      // Mobile-optimized font sizes
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
      '5xl': 48,
    },
    radii: {
      ...defaultConfig.theme.radii,
      // Mobile-friendly border radius
      none: 0,
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
      full: 9999,
    },
  },
  // Mobile-specific component configurations
  components: {
    ...defaultConfig.components,
    // Button configurations for mobile
    Button: {
      ...defaultConfig.components.Button,
      variants: {
        ...defaultConfig.components.Button.variants,
        solid: {
          ...defaultConfig.components.Button.variants.solid,
          bg: '$primary500',
          _hover: {
            bg: '$primary600',
          },
          _pressed: {
            bg: '$primary700',
          },
          _disabled: {
            bg: '$secondary300',
            opacity: 0.5,
          },
        },
        outline: {
          ...defaultConfig.components.Button.variants.outline,
          borderColor: '$primary500',
          borderWidth: 1,
          _hover: {
            bg: '$primary50',
          },
          _pressed: {
            bg: '$primary100',
          },
        },
        ghost: {
          bg: 'transparent',
          _hover: {
            bg: '$secondary100',
          },
          _pressed: {
            bg: '$secondary200',
          },
        },
      },
      sizes: {
        ...defaultConfig.components.Button.sizes,
        xs: {
          px: '$2',
          py: '$1',
          _text: {
            fontSize: '$xs',
          },
        },
        sm: {
          px: '$3',
          py: '$2',
          _text: {
            fontSize: '$sm',
          },
        },
        md: {
          px: '$4',
          py: '$3',
          _text: {
            fontSize: '$md',
          },
        },
        lg: {
          px: '$6',
          py: '$4',
          _text: {
            fontSize: '$lg',
          },
        },
      },
    },
    // Input configurations for mobile
    Input: {
      ...defaultConfig.components.Input,
      variants: {
        ...defaultConfig.components.Input.variants,
        outline: {
          ...defaultConfig.components.Input.variants.outline,
          borderColor: '$secondary300',
          borderWidth: 1,
          borderRadius: '$md',
          _focus: {
            borderColor: '$primary500',
            borderWidth: 2,
          },
          _invalid: {
            borderColor: '$error500',
            borderWidth: 2,
          },
        },
      },
    },
    // Modal configurations for mobile
    Modal: {
      ...defaultConfig.components.Modal,
      defaultProps: {
        ...defaultConfig.components.Modal.defaultProps,
        size: 'md',
      },
    },
  },
});

export { mobileConfig as config };
export type Config = typeof mobileConfig;