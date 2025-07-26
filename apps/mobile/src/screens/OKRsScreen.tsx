import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const OKRsScreen: React.FC = () => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const mockOKRs = [
    {
      id: '1',
      title: 'Increase Customer Satisfaction',
      progress: 75,
      keyResults: [
        { title: 'NPS Score > 70', progress: 80 },
        { title: 'Support Response < 2hrs', progress: 90 },
        { title: 'Customer Retention > 95%', progress: 65 },
      ],
    },
    {
      id: '2',
      title: 'Improve Product Performance',
      progress: 60,
      keyResults: [
        { title: 'Page Load Time < 2s', progress: 70 },
        { title: 'API Response < 500ms', progress: 55 },
        { title: 'Zero Critical Bugs', progress: 45 },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>OKRs</Text>
        <TouchableOpacity style={styles.addButton}>
          <Text style={styles.addButtonText}>+ New OKR</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {mockOKRs.map((okr) => (
            <View key={okr.id} style={styles.okrCard}>
              <View style={styles.okrHeader}>
                <Text style={styles.okrTitle}>{okr.title}</Text>
                <Text style={styles.okrProgress}>{okr.progress}%</Text>
              </View>
              
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${okr.progress}%` }
                  ]} 
                />
              </View>

              <View style={styles.keyResults}>
                <Text style={styles.keyResultsTitle}>Key Results</Text>
                {okr.keyResults.map((kr, index) => (
                  <View key={index} style={styles.keyResult}>
                    <Text style={styles.keyResultTitle}>{kr.title}</Text>
                    <View style={styles.keyResultProgress}>
                      <View style={styles.keyResultProgressBar}>
                        <View 
                          style={[
                            styles.keyResultProgressFill,
                            { width: `${kr.progress}%` }
                          ]} 
                        />
                      </View>
                      <Text style={styles.keyResultProgressText}>{kr.progress}%</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
    },
    title: {
      fontSize: theme.typography.fontSize['3xl'],
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
    },
    addButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
    },
    addButtonText: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textOnPrimary,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: theme.spacing.lg,
      gap: theme.spacing.lg,
    },
    okrCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      ...theme.shadows.sm,
    },
    okrHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    okrTitle: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
      flex: 1,
    },
    okrProgress: {
      fontSize: theme.typography.fontSize.xl,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.primary,
    },
    progressBar: {
      height: 8,
      backgroundColor: theme.colors.borderLight,
      borderRadius: theme.borderRadius.full,
      marginBottom: theme.spacing.lg,
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.full,
    },
    keyResults: {
      gap: theme.spacing.md,
    },
    keyResultsTitle: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    keyResult: {
      gap: theme.spacing.sm,
    },
    keyResultTitle: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    keyResultProgress: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    keyResultProgressBar: {
      flex: 1,
      height: 4,
      backgroundColor: theme.colors.borderLight,
      borderRadius: theme.borderRadius.full,
    },
    keyResultProgressFill: {
      height: '100%',
      backgroundColor: theme.colors.success,
      borderRadius: theme.borderRadius.full,
    },
    keyResultProgressText: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.textSecondary,
      minWidth: 30,
      textAlign: 'right',
    },
  });

export default OKRsScreen;