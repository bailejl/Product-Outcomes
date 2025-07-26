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

const TeamsScreen: React.FC = () => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const mockTeams = [
    {
      id: '1',
      name: 'Product Team',
      memberCount: 8,
      activeOKRs: 5,
      completionRate: 78,
    },
    {
      id: '2',
      name: 'Engineering Team',
      memberCount: 12,
      activeOKRs: 8,
      completionRate: 85,
    },
    {
      id: '3',
      name: 'Marketing Team',
      memberCount: 6,
      activeOKRs: 4,
      completionRate: 92,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Teams</Text>
        <TouchableOpacity style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Join Team</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {mockTeams.map((team) => (
            <TouchableOpacity key={team.id} style={styles.teamCard}>
              <View style={styles.teamHeader}>
                <Text style={styles.teamName}>{team.name}</Text>
                <Text style={styles.completionRate}>{team.completionRate}%</Text>
              </View>
              
              <View style={styles.teamStats}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{team.memberCount}</Text>
                  <Text style={styles.statLabel}>Members</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{team.activeOKRs}</Text>
                  <Text style={styles.statLabel}>Active OKRs</Text>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <Text style={styles.progressLabel}>Team Progress</Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${team.completionRate}%` }
                    ]} 
                  />
                </View>
              </View>
            </TouchableOpacity>
          ))}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Team Leaderboard</Text>
            <View style={styles.leaderboard}>
              {mockTeams
                .sort((a, b) => b.completionRate - a.completionRate)
                .map((team, index) => (
                  <View key={team.id} style={styles.leaderboardItem}>
                    <View style={styles.rank}>
                      <Text style={styles.rankText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.leaderboardName}>{team.name}</Text>
                    <Text style={styles.leaderboardScore}>{team.completionRate}%</Text>
                  </View>
                ))}
            </View>
          </View>
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
    teamCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      ...theme.shadows.sm,
    },
    teamHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    teamName: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
    },
    completionRate: {
      fontSize: theme.typography.fontSize.xl,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.success,
    },
    teamStats: {
      flexDirection: 'row',
      gap: theme.spacing.xl,
      marginBottom: theme.spacing.md,
    },
    stat: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.primary,
    },
    statLabel: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    progressContainer: {
      gap: theme.spacing.sm,
    },
    progressLabel: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    progressBar: {
      height: 6,
      backgroundColor: theme.colors.borderLight,
      borderRadius: theme.borderRadius.full,
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.success,
      borderRadius: theme.borderRadius.full,
    },
    section: {
      marginTop: theme.spacing.lg,
    },
    sectionTitle: {
      fontSize: theme.typography.fontSize.xl,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    leaderboard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      ...theme.shadows.sm,
    },
    leaderboardItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    rank: {
      width: 32,
      height: 32,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.spacing.md,
    },
    rankText: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.textOnPrimary,
    },
    leaderboardName: {
      flex: 1,
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.text,
    },
    leaderboardScore: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.success,
    },
  });

export default TeamsScreen;