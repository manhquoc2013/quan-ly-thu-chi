/**
 * Debounced paged list loader with filter/sort reset and invalidate subscription.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_PAGE_SIZE,
  onListInvalidated,
  type ListEntity,
  type ListPageResult,
  type PageSize,
} from '@/services/listQuery';

export interface UsePagedListOptions<TFilters> {
  entity: ListEntity;
  filters: TFilters;
  /** Serialize filters for dependency comparison */
  filterKey: string;
  fetchPage: (args: {
    page: number;
    pageSize: PageSize;
    filters: TFilters;
  }) => Promise<ListPageResult<unknown>>;
  debounceMs?: number;
  initialPageSize?: PageSize;
}

export interface UsePagedListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: PageSize;
  loading: boolean;
  error: string | null;
  source: 'cloud' | 'local' | null;
  setPage: (page: number) => void;
  setPageSize: (size: PageSize) => void;
  refetch: () => void;
}

export function usePagedList<T, TFilters>(
  options: UsePagedListOptions<TFilters>,
): UsePagedListResult<T> {
  const {
    entity,
    filters,
    filterKey,
    fetchPage,
    debounceMs = 300,
    initialPageSize = DEFAULT_PAGE_SIZE,
  } = options;

  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState<PageSize>(initialPageSize);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'cloud' | 'local' | null>(null);
  const [tick, setTick] = useState(0);

  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const reqId = useRef(0);

  // Reset to page 1 when filters or page size change
  const prevFilterKey = useRef(filterKey);
  const prevPageSize = useRef(pageSize);
  useEffect(() => {
    if (prevFilterKey.current !== filterKey) {
      prevFilterKey.current = filterKey;
      setPageState(1);
    }
  }, [filterKey]);
  useEffect(() => {
    if (prevPageSize.current !== pageSize) {
      prevPageSize.current = pageSize;
      setPageState(1);
    }
  }, [pageSize]);

  useEffect(() => {
    return onListInvalidated((evEntity) => {
      if (evEntity === 'all' || evEntity === entity) {
        setTick((t) => t + 1);
      }
    });
  }, [entity]);

  useEffect(() => {
    let cancelled = false;
    const id = ++reqId.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetchRef
        .current({ page, pageSize, filters: filtersRef.current })
        .then((result) => {
          if (cancelled || id !== reqId.current) return;
          setItems(result.items as T[]);
          setTotal(result.total);
          setSource(result.source);
          setError(null);
          if (result.page !== page) setPageState(result.page);
        })
        .catch((err: unknown) => {
          if (cancelled || id !== reqId.current) return;
          setError(err instanceof Error ? err.message : 'Không tải được danh sách');
          setItems([]);
          setTotal(0);
        })
        .finally(() => {
          if (!cancelled && id === reqId.current) setLoading(false);
        });
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [page, pageSize, filterKey, debounceMs, tick]);

  const setPage = useCallback((next: number) => {
    setPageState(Math.max(1, next));
  }, []);

  const setPageSize = useCallback((size: PageSize) => {
    setPageSizeState(size);
  }, []);

  const refetch = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  return {
    items,
    total,
    page,
    pageSize,
    loading,
    error,
    source,
    setPage,
    setPageSize,
    refetch,
  };
}
