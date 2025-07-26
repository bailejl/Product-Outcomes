import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { LoadingProps } from '../../types';

const LoadingSpinner: React.FC<LoadingProps & { message?: string }> = ({
  size = 'large',
  color,
  overlay = false,
  message,
}) => {
  const { theme } = useTheme();
  const loadingColor = color || theme.colors.primary;

  const styles = createStyles(theme, overlay);

  if (overlay) {
    return (
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ActivityIndicator size={size} color={loadingColor} />
          {message && <Text style={styles.message}>{message}</Text>}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={loadingColor} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
};

const createStyles = (theme: any, overlay: boolean) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    container: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
      backgroundColor: overlay ? theme.colors.surface : 'transparent',
      borderRadius: overlay ? theme.borderRadius.lg : 0,
      ...theme.shadows.md,
    },
    message: {
      ...theme.typography.body,
      marginTop: theme.spacing.md,
      textAlign: 'center',
    },
  });

export default LoadingSpinner;