import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AuthStackParamList } from '../../navigation/types';
import { useTheme } from '../../contexts/ThemeContext';

type WelcomeScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Welcome'
>;

const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<WelcomeScreenNavigationProp>();
  const { theme } = useTheme();

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo/Header Section */}
        <View style={styles.header}>
          <Text style={styles.title}>Product Outcomes</Text>
          <Text style={styles.subtitle}>
            Achieve your goals with powerful OKR management
          </Text>
        </View>

        {/* Feature highlights */}
        <View style={styles.features}>
          <View style={styles.feature}>
            <Text style={styles.featureTitle}>🎯 Track OKRs</Text>
            <Text style={styles.featureText}>
              Set and monitor objectives with key results
            </Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureTitle}>👥 Team Collaboration</Text>
            <Text style={styles.featureText}>
              Work together towards common goals
            </Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureTitle}>📊 Progress Insights</Text>
            <Text style={styles.featureText}>
              Get real-time analytics and reports
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.secondaryButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: theme.spacing.lg,
      justifyContent: 'space-between',
      paddingTop: theme.spacing['3xl'],
      paddingBottom: theme.spacing.xl,
    },
    header: {
      alignItems: 'center',
      marginBottom: theme.spacing['2xl'],
    },
    title: {
      fontSize: theme.typography.fontSize['4xl'],
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: theme.spacing.md,
    },
    subtitle: {
      fontSize: theme.typography.fontSize.lg,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.lg,
    },
    features: {
      flex: 1,
      justifyContent: 'center',
      gap: theme.spacing.xl,
    },
    feature: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.lg,
      borderRadius: theme.borderRadius.lg,
      ...theme.shadows.sm,
    },
    featureTitle: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    featureText: {
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.textSecondary,
      lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
    },
    actions: {
      gap: theme.spacing.md,
    },
    primaryButton: {
      backgroundColor: theme.colors.primary,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.borderRadius.lg,
      alignItems: 'center',
      ...theme.shadows.sm,
    },
    primaryButtonText: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textOnPrimary,
    },
    secondaryButton: {
      backgroundColor: theme.colors.surface,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.borderRadius.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    secondaryButtonText: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
  });

export default WelcomeScreen;