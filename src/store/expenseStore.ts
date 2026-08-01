/**
 * Expense Store — records, filtering, sorting, selection, and computed totals.
 *
 * Zustand 5 + Immer for safe mutable updates.
 * Import types from '@/models';
 *
 * Usage:
 *   const { records, filteredRecords, selectedRecords, categoryTotals } = useExpenseStore();
 *   const { addRecord, deleteRecords, setFilters, toggleSelect } = useExpenseStore();
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import type {
  Expense,
  ExpenseCategory,
  ExpenseStatus,
} from '@/models';
import { cacheSet } from '@/services/cacheManager';

enableMapSet();

const CACHE_KEY = 'expenses';

function persistExpenses(get: () => { records: Expense[] }): void {
  const snapshot = get().records.map((r) => ({ ...r, tags: [...r.tags] }));
  void cacheSet(CACHE_KEY, snapshot).catch((err) =>
    console.error('Failed to persist expenses:', err),
  );
}

// ── Filter shape ──────────────────────────────────────────────────────────────

export interface ExpenseFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
  category: ExpenseCategory | undefined;
  status: ExpenseStatus | undefined;
}

export interface ExpenseSortConfig {
  sortBy: 'date' | 'amount' | 'category' | 'status';
  sortDir: 'asc' | 'desc';
}

const defaultFilters: ExpenseFilters = {
  search: '',
  dateFrom: '',
  dateTo: '',
  category: undefined,
  status: undefined,
};

const defaultSort: ExpenseSortConfig = {
  sortBy: 'date',
  sortDir: 'desc',
};

// ── State ─────────────────────────────────────────────────────────────────────

interface ExpenseState {
  records: Expense[];
  filters: ExpenseFilters;
  selectedIds: Set<string>;
  sort: ExpenseSortConfig;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export interface ExpenseActions {
  // Record CRUD
  setRecords: (records: Expense[]) => void;
  addRecord: (record: Expense) => void;
  updateRecord: (id: string, patch: Partial<Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  deleteRecords: (ids: string[]) => void;

  // Filters & sorting
  setFilters: (filters: Partial<ExpenseFilters>) => void;
  setSearch: (search: string) => void;
  setSortBy: (sortBy: ExpenseSortConfig['sortBy']) => void;
  setSortDir: (sortDir: ExpenseSortConfig['sortDir']) => void;

  // Selection
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
}

// ── Computed selectors ────────────────────────────────────────────────────────

export interface ExpenseSelectors {
  filteredRecords: Expense[];
  selectedRecords: Expense[];
  totalSelected: number;
  categoryTotals: Record<string, { total: number; count: number }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function applyFiltersAndSort(
  records: Expense[],
  filters: ExpenseFilters,
  sort: ExpenseSortConfig,
): Expense[] {
  let result = [...records];

  // Search (description, supplier, tags)
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (r) =>
        r.description.toLowerCase().includes(q) ||
        (r.supplier && r.supplier.toLowerCase().includes(q)) ||
        r.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  // Date range
  if (filters.dateFrom) {
    result = result.filter((r) => r.date >= filters.dateFrom);
  }
  if (filters.dateTo) {
    result = result.filter((r) => r.date <= filters.dateTo);
  }

  // Category
  if (filters.category) {
    result = result.filter((r) => r.category === filters.category);
  }

  // Status
  if (filters.status) {
    result = result.filter((r) => r.status === filters.status);
  }

  // Sort
  const { sortBy, sortDir } = sort;
  const dir = sortDir === 'asc' ? 1 : -1;
  result.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'date':
        cmp = a.date > b.date ? 1 : a.date < b.date ? -1 : 0;
        break;
      case 'amount':
        cmp = a.amount - b.amount;
        break;
      case 'category':
        cmp = a.category.localeCompare(b.category);
        break;
      case 'status':
        cmp = a.status.localeCompare(b.status);
        break;
    }
    return cmp * dir;
  });

  return result;
}

function computeCategoryTotals(
  records: Expense[],
): Record<string, { total: number; count: number }> {
  const map: Record<string, { total: number; count: number }> = {};
  for (const r of records) {
    const entry = map[r.category] ?? { total: 0, count: 0 };
    entry.total += r.amount;
    entry.count += 1;
    map[r.category] = entry;
  }
  return map;
}

// ── Store ─────────────────────────────────────────────────────────────────────

type ExpenseStore = ExpenseState & ExpenseActions & ExpenseSelectors;

export const useExpenseStore = create<ExpenseStore>()(
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
      persistExpenses(get);
    },

    updateRecord: (id, patch) => {
      set((state) => {
        const idx = state.records.findIndex((r: Expense) => r.id === id);
        if (idx !== -1) {
          Object.assign(state.records[idx]!, patch, {
            updatedAt: new Date().toISOString(),
          });
        }
      });
      persistExpenses(get);
    },

    deleteRecords: (ids) => {
      set((state) => {
        state.records = state.records.filter((r: Expense) => !ids.includes(r.id));
        state.selectedIds = new Set(
          [...state.selectedIds].filter((sid) => !ids.includes(sid)),
        );
      });
      persistExpenses(get);
    },

    setFilters: (partial) =>
      set((state) => {
        state.filters = { ...state.filters, ...partial };
      }),

    setSearch: (search) =>
      set((state) => {
        state.filters = { ...state.filters, search };
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

    get categoryTotals() {
      const filtered = get().filteredRecords;
      return computeCategoryTotals(filtered);
    },
  })),
);
