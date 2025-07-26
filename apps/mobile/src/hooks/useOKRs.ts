import { useState, useCallback } from 'react';
import { OKR, PaginatedResponse, SearchFilters, SortOptions } from '../types';
import { apiService } from '../services/api';

interface UseOKRsOptions {
  page?: number;
  limit?: number;
  filters?: SearchFilters;
  sort?: SortOptions;
}

interface UseOKRsReturn {
  okrs: OKR[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  refreshing: boolean;
  fetchOKRs: (options?: UseOKRsOptions) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  createOKR: (okrData: Partial<OKR>) => Promise<OKR>;
  updateOKR: (id: string, okrData: Partial<OKR>) => Promise<OKR>;
  deleteOKR: (id: string) => Promise<void>;
  getOKR: (id: string) => Promise<OKR>;
}

export const useOKRs = (): UseOKRsReturn => {
  const [okrs, setOKRs] = useState<OKR[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastOptions, setLastOptions] = useState<UseOKRsOptions>({});

  const fetchOKRs = useCallback(async (options: UseOKRsOptions = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page: options.page || 1,
        limit: options.limit || 20,
        ...options.filters,
        sortBy: options.sort?.field,
        sortOrder: options.sort?.direction,
      };

      const response = await apiService.getPaginated<OKR>('/okrs', params);
      
      if (params.page === 1) {
        setOKRs(response.data);
      } else {
        setOKRs(prev => [...prev, ...response.data]);
      }
      
      setHasMore(response.pagination.hasNext);
      setCurrentPage(params.page);
      setLastOptions(options);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch OKRs');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    
    await fetchOKRs({
      ...lastOptions,
      page: currentPage + 1,
    });
  }, [loading, hasMore, currentPage, lastOptions, fetchOKRs]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOKRs({ ...lastOptions, page: 1 });
    setRefreshing(false);
  }, [lastOptions, fetchOKRs]);

  const createOKR = useCallback(async (okrData: Partial<OKR>): Promise<OKR> => {
    try {
      const response = await apiService.post<OKR>('/okrs', okrData);
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create OKR');
      }

      // Add the new OKR to the beginning of the list
      setOKRs(prev => [response.data!, ...prev]);
      
      return response.data;
    } catch (err: any) {
      setError(err.message || 'Failed to create OKR');
      throw err;
    }
  }, []);

  const updateOKR = useCallback(async (id: string, okrData: Partial<OKR>): Promise<OKR> => {
    try {
      const response = await apiService.patch<OKR>(`/okrs/${id}`, okrData);
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update OKR');
      }

      // Update the OKR in the list
      setOKRs(prev => prev.map(okr => 
        okr.id === id ? { ...okr, ...response.data } : okr
      ));
      
      return response.data;
    } catch (err: any) {
      setError(err.message || 'Failed to update OKR');
      throw err;
    }
  }, []);

  const deleteOKR = useCallback(async (id: string): Promise<void> => {
    try {
      const response = await apiService.delete(`/okrs/${id}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete OKR');
      }

      // Remove the OKR from the list
      setOKRs(prev => prev.filter(okr => okr.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete OKR');
      throw err;
    }
  }, []);

  const getOKR = useCallback(async (id: string): Promise<OKR> => {
    try {
      const response = await apiService.get<OKR>(`/okrs/${id}`);
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch OKR');
      }

      // Update the OKR in the list if it exists
      setOKRs(prev => prev.map(okr => 
        okr.id === id ? response.data! : okr
      ));
      
      return response.data;
    } catch (err: any) {
      setError(err.message || 'Failed to fetch OKR');
      throw err;
    }
  }, []);

  return {
    okrs,
    loading,
    error,
    hasMore,
    refreshing,
    fetchOKRs,
    loadMore,
    refresh,
    createOKR,
    updateOKR,
    deleteOKR,
    getOKR,
  };
};