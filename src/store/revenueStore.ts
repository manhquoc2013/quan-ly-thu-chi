/**
 * Revenue Store — records, filtering, sorting, selection for revenue/orders.
 *
 * Zustand 5 + Immer for safe mutable updates.
 * Import types from '@/models';
 *
 * Usage:
 *   const { records, filteredRecords } = useRevenueStore();
 *   const { addRecord, deleteRecords, toggleSelect } = useRevenueStore();
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Revenue, OrderStatus, PaymentStatus } from '@/models';
import { cacheSet } from '@/services/cacheManager';

const CACHE_KEY = 'revenues';

function persistRevenues(get: () => { records: Revenue[] }): void {
  const snapshot = get().records.map((r) => ({ ...r, items: r.items.map((i) => ({ ...i })) }));
  void cacheSet(CACHE_KEY, snapshot).catch((err) =>
    console.error('Failed to persist revenues:', err),
  );
}

// ── Filter shape ──────────────────────────────────────────────────────────────

export interface RevenueFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
  orderStatus: OrderStatus | undefined;
  paymentStatus: PaymentStatus | undefined;
  customerId: string | undefined;
  /** true = chỉ đơn ưu tiên */
  priorityOnly?: boolean;
}

export interface RevenueSortConfig {
  sortBy: 'date' | 'amount' | 'orderStatus';
  sortDir: 'asc' | 'desc';
}

const defaultFilters: RevenueFilters = {
  search: '',
  dateFrom: '',
  dateTo: '',
  orderStatus: undefined,
  paymentStatus: undefined,
  customerId: undefined,
  priorityOnly: false,
};

const defaultSort: RevenueSortConfig = {
  sortBy: 'date',
  sortDir: 'desc',
};

// ── State ─────────────────────────────────────────────────────────────────────

interface RevenueState {
  records: Revenue[];
  filters: RevenueFilters;
  selectedIds: Set<string>;
  sort: RevenueSortConfig;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export interface RevenueActions {
  // Record CRUD
  setRecords: (records: Revenue[]) => void;
  addRecord: (record: Revenue) => void;
  updateRecord: (id: string, patch: Partial<Omit<Revenue, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  deleteRecords: (ids: string[]) => void;

  // Filters & sorting
  setFilters: (filters: Partial<RevenueFilters>) => void;
  setSortBy: (sortBy: RevenueSortConfig['sortBy']) => void;
  setSortDir: (sortDir: RevenueSortConfig['sortDir']) => void;

  // Selection
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
}

// ── Computed selectors ────────────────────────────────────────────────────────

export interface RevenueSelectors {
  filteredRecords: Revenue[];
  selectedRecords: Revenue[];
  totalSelected: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function applyFiltersAndSort(
  records: Revenue[],
  filters: RevenueFilters,
  sort: RevenueSortConfig,
): Revenue[] {
  let result = [...records];

  // Search (order code, notes, item names)
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (r) =>
        r.orderCode.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q) ||
        r.items.some((i) => i.name.toLowerCase().includes(q)),
    );
  }

  // Date range
  if (filters.dateFrom) {
    result = result.filter((r) => r.date >= filters.dateFrom);
  }
  if (filters.dateTo) {
    result = result.filter((r) => r.date <= filters.dateTo);
  }

  // Order status
  if (filters.orderStatus) {
    result = result.filter((r) => r.orderStatus === filters.orderStatus);
  }

  if (filters.paymentStatus) {
    result = result.filter((r) => r.paymentStatus === filters.paymentStatus);
  }

  // Customer ID
  if (filters.customerId) {
    result = result.filter((r) => r.customerId === filters.customerId);
  }

  if (filters.priorityOnly) {
    result = result.filter((r) => r.priority === true);
  }

  // Sort — priority orders always first, then configured column
  const { sortBy, sortDir } = sort;
  const dir = sortDir === 'asc' ? 1 : -1;
  result.sort((a, b) => {
    const pa = a.priority ? 1 : 0;
    const pb = b.priority ? 1 : 0;
    if (pa !== pb) return pb - pa;
    if (pa && pb) {
      const at = a.priorityAt ?? '';
      const bt = b.priorityAt ?? '';
      if (at !== bt) return bt.localeCompare(at);
    }
    let cmp = 0;
    switch (sortBy) {
      case 'date':
        cmp = a.date > b.date ? 1 : a.date < b.date ? -1 : 0;
        break;
      case 'amount':
        cmp = a.finalAmount - b.finalAmount;
        break;
      case 'orderStatus':
        cmp = a.orderStatus.localeCompare(b.orderStatus);
        break;
    }
    return cmp * dir;
  });

  return result;
}

// ── Store ─────────────────────────────────────────────────────────────────────

type RevenueStore = RevenueState & RevenueActions & RevenueSelectors;

export const useRevenueStore = create<RevenueStore>()(
  immer((set, get) => ({
    records: [],
    filters: { ...defaultFilters },
    selectedIds: new Set<string>(),
    sort: { ...defaultSort },

    // ── Mutations ──────────────────────────────────────────────────────────

    setRecords: (records) =>
      set((state) => {
        state.records = records;
        state.selectedIds = new Set();
      }),

    addRecord: (record) => {
      set((state) => {
        state.records.unshift(record);
      });
      persistRevenues(get);
    },

    updateRecord: (id, patch) => {
      set((state) => {
        const idx = state.records.findIndex((r: Revenue) => r.id === id);
        if (idx !== -1) {
          Object.assign(state.records[idx]!, patch, { updatedAt: new Date().toISOString() });
        }
      });
      persistRevenues(get);
    },

    deleteRecords: (ids) => {
      set((state) => {
        state.records = state.records.filter((r: Revenue) => !ids.includes(r.id));
        state.selectedIds = new Set(
          [...state.selectedIds].filter((sid) => !ids.includes(sid)),
        );
      });
      persistRevenues(get);
    },

    setFilters: (partial) =>
      set((state) => {
        state.filters = { ...state.filters, ...partial };
      }),

    setSortBy: (sortBy) =>
      set((state) => {
        state.sort = { ...state.sort, sortBy };
      }),

    setSortDir: (sortDir) =>
      set((state) => {
        state.sort = { ...state.sort, sortDir };
      }),

    toggleSelect: (id) =>
      set((state) => {
        if (state.selectedIds.has(id)) {
          state.selectedIds.delete(id);
        } else {
          state.selectedIds.add(id);
        }
      }),

    selectAll: () =>
      set((state) => {
        const filtered = get().filteredRecords;
        state.selectedIds = new Set(filtered.map((r) => r.id));
      }),

    clearSelection: () =>
      set((state) => {
        state.selectedIds = new Set();
      }),

    // ── Computed selectors (Zustand v5 getter pattern) ───────────────────

    get filteredRecords() {
      const { records, filters, sort } = get();
      return applyFiltersAndSort(records, filters, sort);
    },

    get selectedRecords() {
      const { records, selectedIds } = get();
      return records.filter((r) => selectedIds.has(r.id));
    },

    get totalSelected() {
      return get().selectedIds.size;
    },
  })),
);
