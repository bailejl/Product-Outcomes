import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getProgressColor } from '../../theme';

interface ProgressBarProps {
  progress: number; // 0-100
  height?: number;
  showLabel?: boolean;
  labelPosition?: 'top' | 'bottom' | 'right';
  animated?: boolean;
  color?: string;
  backgroundColor?: string;
  borderRadius?: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 8,
  showLabel = true,
  labelPosition = 'right',
  animated = true,
  color,
  backgroundColor,
  borderRadius,
}) => {
  const { theme } = useTheme();
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  // Ensure progress is between 0 and 100
  const normalizedProgress = Math.max(0, Math.min(100, progress));
  
  // Determine colors
  const progressColor = color || getProgressColor(normalizedProgress, theme);
  const bgColor = backgroundColor || theme.colors.surface;
  const radius = borderRadius ?? height / 2;

  React.useEffect(() => {
    if (animated) {
      Animated.timing(animatedValue, {
        toValue: normalizedProgress,
        duration: 800,
        useNativeDriver: false,
      }).start();
    } else {
      animatedValue.setValue(normalizedProgress);
    }
  }, [normalizedProgress, animated]);

  const styles = createStyles(theme, height, progressColor, bgColor, radius);

  const renderLabel = () => {
    if (!showLabel) return null;

    return (
      <Text style={styles.label}>
        {Math.round(normalizedProgress)}%
      </Text>
    );
  };

  const renderProgress = () => (
    <View style={styles.container}>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: animatedValue.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
      </View>
    </View>
  );

  if (labelPosition === 'top') {
    return (
      <View>
        {renderLabel()}
        {renderProgress()}
      </View>
    );
  }

  if (labelPosition === 'bottom') {
    return (
      <View>
        {renderProgress()}
        {renderLabel()}
      </View>
    );
  }

  // Right position (default)
  return (
    <View style={styles.horizontalContainer}>
      <View style={styles.progressContainer}>
        {renderProgress()}
      </View>
      {renderLabel()}
    </View>
  );
};

const createStyles = (
  theme: any,
  height: number,
  progressColor: string,
  backgroundColor: string,
  borderRadius: number
) =>
  StyleSheet.create({
    container: {
      justifyContent: 'center',
    },
    horizontalContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    progressContainer: {
      flex: 1,
      marginRight: theme.spacing.sm,
    },
    track: {
      height,
      backgroundColor,
      borderRadius,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    fill: {
      height: '100%',
      backgroundColor: progressColor,
      borderRadius: borderRadius - 1,
    },
    label: {
      ...theme.typography.caption,
      fontWeight: '600',
      minWidth: 40,
      textAlign: 'right',
    },
  });

export default ProgressBar;