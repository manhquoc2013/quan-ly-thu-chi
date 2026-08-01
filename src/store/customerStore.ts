/**
 * Customer Store — customer list with search filtering.
 *
 * Zustand 5 + Immer for safe mutable updates.
 * Import types from '@/models';
 *
 * Usage:
 *   const { customers, filteredCustomers } = useCustomerStore();
 *   const { addCustomer, updateCustomer, deleteCustomer } = useCustomerStore();
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Customer } from '@/models';

// ── State ─────────────────────────────────────────────────────────────────────

interface CustomerState {
  customers: Customer[];
  searchQuery: string;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export interface CustomerActions {
  setCustomers: (customers: Customer[]) => void;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, patch: Partial<Omit<Customer, 'id' | 'createdAt'>>) => void;
  deleteCustomer: (id: string) => void;
  setSearchQuery: (searchQuery: string) => void;
}

// ── Computed selectors ────────────────────────────────────────────────────────

export interface CustomerSelectors {
  filteredCustomers: Customer[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fuzzyMatch(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

// ── Store ─────────────────────────────────────────────────────────────────────

type CustomerStore = CustomerState & CustomerActions & CustomerSelectors;

export const useCustomerStore = create<CustomerStore>()(
  immer((set, get) => ({
    customers: [],
    searchQuery: '',

    // ── Mutations ──────────────────────────────────────────────────────────

    setCustomers: (customers) =>
      set((state) => {
        state.customers = customers;
      }),

    addCustomer: (customer) =>
      set((state) => {
        state.customers.unshift(customer);
      }),

    updateCustomer: (id, patch) =>
      set((state) => {
        const idx = state.customers.findIndex((c: Customer) => c.id === id);
        if (idx !== -1) {
          Object.assign(state.customers[idx]!, patch);
        }
      }),

    deleteCustomer: (id) =>
      set((state) => {
        state.customers = state.customers.filter((c: Customer) => c.id !== id);
      }),

    setSearchQuery: (searchQuery) =>
      set((state) => {
        state.searchQuery = searchQuery;
      }),

    // ── Computed selectors (Zustand v5 getter pattern) ───────────────────

    get filteredCustomers() {
      const { customers, searchQuery } = get();
      if (!searchQuery) return customers;
      return customers.filter(
        (c) =>
          fuzzyMatch(c.name, searchQuery) ||
          fuzzyMatch(c.phone, searchQuery) ||
          (c.email && fuzzyMatch(c.email, searchQuery)),
      );
    },
  })),
);
