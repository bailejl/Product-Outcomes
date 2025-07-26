import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import Header from '../../components/common/Header';
import ProgressBar from '../../components/common/ProgressBar';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { OKR, OKRStatus, SearchFilters, SortOptions } from '../../types';
import { notificationService } from '../../services/notification';
import { useOKRs } from '../../hooks/useOKRs';
import { getStatusColor, getPriorityColor } from '../../theme';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: SearchFilters, sort: SortOptions) => void;
  currentFilters: SearchFilters;
  currentSort: SortOptions;
}

const OKRListScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [sort, setSort] = useState<SortOptions>({ field: 'createdAt', direction: 'desc' });

  const {
    okrs,
    loading,
    error,
    hasMore,
    refreshing,
    fetchOKRs,
    loadMore,
    refresh,
    deleteOKR,
  } = useOKRs();

  const styles = createStyles(theme);

  // Load data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchOKRs({ filters, sort });
    }, [filters, sort])
  );

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadMore();
    }
  }, [loading, hasMore, loadMore]);

  const handleDeleteOKR = useCallback((okr: OKR) => {
    Alert.alert(
      'Delete OKR',
      `Are you sure you want to delete "${okr.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOKR(okr.id);
              notificationService.showToast({
                type: 'success',
                title: 'OKR Deleted',
                message: 'The OKR has been deleted successfully.',
              });
            } catch (error) {
              notificationService.showToast({
                type: 'error',
                title: 'Delete Failed',
                message: 'Failed to delete the OKR. Please try again.',
              });
            }
          },
        },
      ]
    );
  }, [deleteOKR]);

  const handleApplyFilters = useCallback((newFilters: SearchFilters, newSort: SortOptions) => {
    setFilters(newFilters);
    setSort(newSort);
    setShowFilters(false);
  }, []);

  const getActiveFiltersCount = useCallback(() => {
    let count = 0;
    if (filters.status && filters.status.length > 0) count++;
    if (filters.period && filters.period.length > 0) count++;
    if (filters.priority && filters.priority.length > 0) count++;
    if (filters.tags && filters.tags.length > 0) count++;
    if (filters.dateRange && (filters.dateRange.start || filters.dateRange.end)) count++;
    return count;
  }, [filters]);

  const renderOKRItem = useCallback(({ item: okr }: { item: OKR }) => {
    const isOverdue = new Date(okr.endDate) < new Date() && okr.status !== OKRStatus.COMPLETED;
    const daysUntilDue = Math.ceil((new Date(okr.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    return (
      <TouchableOpacity
        style={[styles.okrCard, isOverdue && styles.overdueCard]}
        onPress={() => navigation.navigate('OKRDetail' as never, { okrId: okr.id } as never)}
      >
        <View style={styles.okrHeader}>
          <View style={styles.okrTitleSection}>
            <Text style={styles.okrTitle} numberOfLines={2}>
              {okr.title}
            </Text>
            {okr.metadata?.priority && (
              <View
                style={[
                  styles.priorityDot,
                  { backgroundColor: getPriorityColor(okr.metadata.priority, theme) },
                ]}
              />
            )}
          </View>
          <View style={styles.okrActions}>
            <StatusBadge status={okr.status} size="small" />
            <TouchableOpacity
              onPress={() => navigation.navigate('EditOKR' as never, { okrId: okr.id } as never)}
              style={styles.actionButton}
            >
              <Icon name="pencil" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteOKR(okr)}
              style={styles.actionButton}
            >
              <Icon name="delete" size={16} color={theme.colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        {okr.description && (
          <Text style={styles.okrDescription} numberOfLines={2}>
            {okr.description}
          </Text>
        )}

        <View style={styles.progressSection}>
          <ProgressBar progress={okr.progress} height={6} />
        </View>

        <View style={styles.okrFooter}>
          <View style={styles.footerLeft}>
            <Icon name="account" size={14} color={theme.colors.textSecondary} />
            <Text style={styles.ownerText}>
              {okr.owner.firstName} {okr.owner.lastName}
            </Text>
          </View>
          
          <View style={styles.footerRight}>
            <View style={styles.dueDateContainer}>
              <Icon 
                name={isOverdue ? "alert-circle" : "calendar"} 
                size={14} 
                color={isOverdue ? theme.colors.error : theme.colors.textSecondary} 
              />
              <Text style={[styles.dueDateText, isOverdue && styles.overdueText]}>
                {isOverdue ? `${Math.abs(daysUntilDue)}d overdue` : 
                 daysUntilDue === 0 ? 'Due today' :
                 daysUntilDue > 0 ? `${daysUntilDue}d left` : 'Past due'}
              </Text>
            </View>
          </View>
        </View>

        {okr.metadata?.tags && okr.metadata.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {okr.metadata.tags.slice(0, 3).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
            {okr.metadata.tags.length > 3 && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>+{okr.metadata.tags.length - 3}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }, [navigation, theme, handleDeleteOKR]);

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="target" size={64} color={theme.colors.disabled} />
      <Text style={styles.emptyTitle}>No OKRs Found</Text>
      <Text style={styles.emptyDescription}>
        {Object.keys(filters).length > 0 || sort.field !== 'createdAt'
          ? 'Try adjusting your filters or search criteria'
          : 'Create your first OKR to get started'}
      </Text>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => navigation.navigate('CreateOKR' as never)}
      >
        <Icon name="plus" size={20} color="#FFFFFF" />
        <Text style={styles.createButtonText}>Create OKR</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (!loading || okrs.length === 0) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <LoadingSpinner size="small" />
        <Text style={styles.loadingText}>Loading more OKRs...</Text>
      </View>
    );
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <View style={styles.container}>
      <Header
        title="My OKRs"
        subtitle={`${okrs.length} OKR${okrs.length !== 1 ? 's' : ''}`}
        rightComponent={
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setShowFilters(true)}
              style={[styles.filterButton, activeFiltersCount > 0 && styles.activeFilter]}
            >
              <Icon name="filter-variant" size={20} color={theme.colors.text} />
              {activeFiltersCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('CreateOKR' as never)}
              style={styles.addButton}
            >
              <Icon name="plus" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        }
      />

      <FlatList
        data={okrs}
        renderItem={renderOKRItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContainer,
          okrs.length === 0 && styles.emptyListContainer,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        ListEmptyComponent={!loading ? renderEmptyState : null}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
      />

      {/* Filter Modal would go here */}
      {/* <FilterModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={handleApplyFilters}
        currentFilters={filters}
        currentSort={sort}
      /> */}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    filterButton: {
      padding: theme.spacing.sm,
      marginRight: theme.spacing.xs,
      borderRadius: theme.borderRadius.md,
      position: 'relative',
    },
    activeFilter: {
      backgroundColor: theme.colors.primary + '20',
    },
    filterBadge: {
      position: 'absolute',
      top: 2,
      right: 2,
      backgroundColor: theme.colors.error,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    filterBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: 'bold',
    },
    addButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContainer: {
      padding: theme.spacing.md,
    },
    emptyListContainer: {
      flex: 1,
    },
    okrCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      ...theme.shadows.sm,
    },
    overdueCard: {
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.error,
    },
    okrHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: theme.spacing.sm,
    },
    okrTitleSection: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    okrTitle: {
      ...theme.typography.body,
      fontWeight: '600',
      flex: 1,
      marginRight: theme.spacing.sm,
    },
    priorityDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 6,
      marginLeft: theme.spacing.xs,
    },
    okrActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionButton: {
      padding: theme.spacing.xs,
      marginLeft: theme.spacing.xs,
    },
    okrDescription: {
      ...theme.typography.caption,
      marginBottom: theme.spacing.sm,
      lineHeight: 18,
    },
    progressSection: {
      marginBottom: theme.spacing.sm,
    },
    okrFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    footerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    ownerText: {
      ...theme.typography.caption,
      marginLeft: theme.spacing.xs,
      fontWeight: '500',
    },
    footerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    dueDateContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    dueDateText: {
      ...theme.typography.caption,
      marginLeft: theme.spacing.xs,
    },
    overdueText: {
      color: theme.colors.error,
      fontWeight: '600',
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    tag: {
      backgroundColor: theme.colors.primary + '20',
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: 2,
    },
    tagText: {
      fontSize: 10,
      color: theme.colors.primary,
      fontWeight: '500',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.xl,
    },
    emptyTitle: {
      ...theme.typography.h3,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    emptyDescription: {
      ...theme.typography.body,
      textAlign: 'center',
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xl,
      lineHeight: 22,
    },
    createButton: {
      backgroundColor: theme.colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
    },
    createButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
      marginLeft: theme.spacing.sm,
    },
    loadingFooter: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.spacing.lg,
    },
    loadingText: {
      ...theme.typography.caption,
      marginLeft: theme.spacing.sm,
    },
  });

export default OKRListScreen;