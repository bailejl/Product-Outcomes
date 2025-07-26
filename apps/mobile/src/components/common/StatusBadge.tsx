import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getStatusColor } from '../../theme';
import { OKRStatus } from '../../types';

interface StatusBadgeProps {
  status: OKRStatus | string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'filled' | 'outlined';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'medium',
  variant = 'filled',
}) => {
  const { theme } = useTheme();
  const statusColor = getStatusColor(status, theme);

  const styles = createStyles(theme, statusColor, size, variant);

  const getStatusText = (status: string): string => {
    switch (status.toLowerCase()) {
      case OKRStatus.DRAFT:
        return 'Draft';
      case OKRStatus.ACTIVE:
        return 'Active';
      case OKRStatus.PAUSED:
        return 'Paused';
      case OKRStatus.COMPLETED:
        return 'Completed';
      case OKRStatus.CANCELLED:
        return 'Cancelled';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{getStatusText(status)}</Text>
    </View>
  );
};

const createStyles = (
  theme: any,
  statusColor: string,
  size: string,
  variant: string
) => {
  const sizes = {
    small: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      fontSize: 10,
    },
    medium: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      fontSize: 12,
    },
    large: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      fontSize: 14,
    },
  };

  const sizeStyle = sizes[size as keyof typeof sizes];

  return StyleSheet.create({
    container: {
      paddingHorizontal: sizeStyle.paddingHorizontal,
      paddingVertical: sizeStyle.paddingVertical,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: variant === 'filled' ? statusColor : 'transparent',
      borderWidth: variant === 'outlined' ? 1 : 0,
      borderColor: statusColor,
      alignSelf: 'flex-start',
    },
    text: {
      fontSize: sizeStyle.fontSize,
      fontWeight: '600',
      color: variant === 'filled' ? '#FFFFFF' : statusColor,
      textAlign: 'center',
    },
  });
};

export default StatusBadge;