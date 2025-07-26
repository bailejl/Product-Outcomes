import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../../components/common/Header';
import ProgressBar from '../../components/common/ProgressBar';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { OKR, OKRStatus } from '../../types';
import { notificationService } from '../../services/notification';
import { useOKRs } from '../../hooks/useOKRs';

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 32;

interface DashboardStats {
  totalOKRs: number;
  activeOKRs: number;
  completedOKRs: number;
  averageProgress: number;
  dueThisWeek: number;
  overdue: number;
}

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalOKRs: 0,
    activeOKRs: 0,
    completedOKRs: 0,
    averageProgress: 0,
    dueThisWeek: 0,
    overdue: 0,
  });

  const {
    okrs,
    loading,
    error,
    fetchOKRs,
  } = useOKRs();

  const styles = createStyles(theme);

  // Load data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const loadDashboardData = async () => {
    try {
      await fetchOKRs({ limit: 50 }); // Get recent OKRs for dashboard
    } catch (error) {
      notificationService.showToast({
        type: 'error',
        title: 'Load Error',
        message: 'Failed to load dashboard data',
      });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // Calculate stats when OKRs change
  useEffect(() => {
    if (okrs.length > 0) {
      calculateStats(okrs);
    }
  }, [okrs]);

  const calculateStats = (okrList: OKR[]) => {
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const newStats = okrList.reduce(
      (acc, okr) => {
        acc.totalOKRs++;
        
        if (okr.status === OKRStatus.ACTIVE) {
          acc.activeOKRs++;
        }
        
        if (okr.status === OKRStatus.COMPLETED) {
          acc.completedOKRs++;
        }
        
        // Check if due this week
        if (okr.endDate <= oneWeekFromNow && okr.endDate > now) {
          acc.dueThisWeek++;
        }
        
        // Check if overdue
        if (okr.endDate < now && okr.status !== OKRStatus.COMPLETED) {
          acc.overdue++;
        }
        
        return acc;
      },
      {
        totalOKRs: 0,
        activeOKRs: 0,
        completedOKRs: 0,
        averageProgress: 0,
        dueThisWeek: 0,
        overdue: 0,
      }
    );

    // Calculate average progress
    const activeOKRs = okrList.filter(okr => okr.status === OKRStatus.ACTIVE);
    if (activeOKRs.length > 0) {
      newStats.averageProgress = activeOKRs.reduce((sum, okr) => sum + okr.progress, 0) / activeOKRs.length;
    }

    setStats(newStats);
  };

  const getProgressChartData = () => {
    const progressRanges = [
      { label: '0-25%', count: 0, color: theme.colors.error },
      { label: '26-50%', count: 0, color: theme.colors.warning },
      { label: '51-75%', count: 0, color: theme.colors.info },
      { label: '76-100%', count: 0, color: theme.colors.success },
    ];

    okrs.filter(okr => okr.status === OKRStatus.ACTIVE).forEach(okr => {
      if (okr.progress <= 25) progressRanges[0].count++;
      else if (okr.progress <= 50) progressRanges[1].count++;
      else if (okr.progress <= 75) progressRanges[2].count++;
      else progressRanges[3].count++;
    });

    return progressRanges.map(range => ({
      name: range.label,
      count: range.count,
      color: range.color,
      legendFontColor: theme.colors.text,
      legendFontSize: 12,
    }));
  };

  const getTrendData = () => {
    // This would typically come from historical data
    // For demo purposes, we'll generate sample data
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return {
        label: date.toLocaleDateString('en', { weekday: 'short' }),
        value: Math.floor(Math.random() * 30) + 50, // Sample data
      };
    });

    return {
      labels: last7Days.map(d => d.label),
      datasets: [
        {
          data: last7Days.map(d => d.value),
          color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  };

  const renderStatsCard = (title: string, value: number, icon: string, color: string) => (
    <View style={[styles.statsCard, { borderLeftColor: color }]}>
      <View style={styles.statsContent}>
        <Icon name={icon} size={24} color={color} />
        <View style={styles.statsText}>
          <Text style={styles.statsValue}>{value}</Text>
          <Text style={styles.statsTitle}>{title}</Text>
        </View>
      </View>
    </View>
  );

  const renderRecentOKRs = () => {
    const recentOKRs = okrs.slice(0, 5);

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent OKRs</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('OKRs' as never)}
            style={styles.seeAllButton}
          >
            <Text style={styles.seeAllText}>See All</Text>
            <Icon name="chevron-right" size={16} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {recentOKRs.map((okr) => (
          <TouchableOpacity
            key={okr.id}
            style={styles.okrCard}
            onPress={() => navigation.navigate('OKRDetail' as never, { okrId: okr.id } as never)}
          >
            <View style={styles.okrHeader}>
              <Text style={styles.okrTitle} numberOfLines={1}>
                {okr.title}
              </Text>
              <StatusBadge status={okr.status} size="small" />
            </View>
            <ProgressBar progress={okr.progress} height={6} />
            <View style={styles.okrFooter}>
              <Text style={styles.okrDueDate}>
                Due: {new Date(okr.endDate).toLocaleDateString()}
              </Text>
              <Text style={styles.okrOwner}>
                {okr.owner.firstName} {okr.owner.lastName}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (loading && okrs.length === 0) {
    return (
      <View style={styles.container}>
        <Header 
          title="Dashboard" 
          rightComponent={
            <TouchableOpacity onPress={() => navigation.navigate('CreateOKR' as never)}>
              <Icon name="plus" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          }
        />
        <LoadingSpinner message="Loading dashboard..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header 
        title="Dashboard" 
        subtitle={`Welcome back, ${user?.firstName}!`}
        rightComponent={
          <View style={styles.headerActions}>
            <TouchableOpacity 
              onPress={() => navigation.navigate('Notifications' as never)}
              style={styles.headerButton}
            >
              <Icon name="bell-outline" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => navigation.navigate('CreateOKR' as never)}
              style={styles.headerButton}
            >
              <Icon name="plus" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            {renderStatsCard('Total OKRs', stats.totalOKRs, 'target', theme.colors.primary)}
            {renderStatsCard('Active', stats.activeOKRs, 'play-circle', theme.colors.success)}
            {renderStatsCard('Completed', stats.completedOKRs, 'check-circle', theme.colors.info)}
            {renderStatsCard('Due This Week', stats.dueThisWeek, 'clock-alert', theme.colors.warning)}
            {renderStatsCard('Overdue', stats.overdue, 'alert-circle', theme.colors.error)}
            {renderStatsCard('Avg Progress', Math.round(stats.averageProgress), 'trending-up', theme.colors.secondary)}
          </View>
        </View>

        {/* Progress Distribution Chart */}
        {stats.activeOKRs > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Progress Distribution</Text>
            <View style={styles.chartContainer}>
              <PieChart
                data={getProgressChartData()}
                width={chartWidth}
                height={220}
                chartConfig={{
                  backgroundColor: theme.colors.surface,
                  backgroundGradientFrom: theme.colors.surface,
                  backgroundGradientTo: theme.colors.surface,
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor="count"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            </View>
          </View>
        )}

        {/* Progress Trend */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7-Day Progress Trend</Text>
          <View style={styles.chartContainer}>
            <LineChart
              data={getTrendData()}
              width={chartWidth}
              height={220}
              chartConfig={{
                backgroundColor: theme.colors.surface,
                backgroundGradientFrom: theme.colors.surface,
                backgroundGradientTo: theme.colors.surface,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
                labelColor: (opacity = 1) => theme.colors.text,
                style: {
                  borderRadius: theme.borderRadius.md,
                },
                propsForDots: {
                  r: '6',
                  strokeWidth: '2',
                  stroke: theme.colors.primary,
                },
              }}
              bezier
              style={{
                marginVertical: 8,
                borderRadius: theme.borderRadius.md,
              }}
            />
          </View>
        </View>

        {/* Recent OKRs */}
        {renderRecentOKRs()}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('CreateOKR' as never)}
            >
              <Icon name="plus-circle" size={32} color={theme.colors.primary} />
              <Text style={styles.actionText}>Create OKR</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('Search' as never)}
            >
              <Icon name="magnify" size={32} color={theme.colors.secondary} />
              <Text style={styles.actionText}>Search</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('Settings' as never)}
            >
              <Icon name="cog" size={32} color={theme.colors.info} />
              <Text style={styles.actionText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerButton: {
      padding: theme.spacing.xs,
      marginLeft: theme.spacing.sm,
    },
    section: {
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    sectionTitle: {
      ...theme.typography.h3,
      marginBottom: theme.spacing.md,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    seeAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    seeAllText: {
      ...theme.typography.body,
      color: theme.colors.primary,
      marginRight: theme.spacing.xs,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    statsCard: {
      width: '48%',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      borderLeftWidth: 4,
      ...theme.shadows.sm,
    },
    statsContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statsText: {
      marginLeft: theme.spacing.md,
      flex: 1,
    },
    statsValue: {
      ...theme.typography.h2,
      fontSize: 24,
      fontWeight: 'bold',
    },
    statsTitle: {
      ...theme.typography.caption,
      marginTop: 2,
    },
    chartContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.sm,
      ...theme.shadows.sm,
    },
    okrCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      ...theme.shadows.sm,
    },
    okrHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    okrTitle: {
      ...theme.typography.body,
      fontWeight: '600',
      flex: 1,
      marginRight: theme.spacing.sm,
    },
    okrFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: theme.spacing.sm,
    },
    okrDueDate: {
      ...theme.typography.caption,
    },
    okrOwner: {
      ...theme.typography.caption,
      fontWeight: '500',
    },
    quickActions: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: theme.spacing.md,
    },
    actionButton: {
      alignItems: 'center',
      padding: theme.spacing.md,
    },
    actionText: {
      ...theme.typography.caption,
      marginTop: theme.spacing.xs,
      fontWeight: '500',
    },
  });

export default DashboardScreen;