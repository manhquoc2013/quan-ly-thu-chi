/**
 * Product Store — catalog list with search.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Product } from '@/models';
import { cacheSet } from '@/services/cacheManager';

const CACHE_KEY = 'products';

function persistProducts(get: () => { products: Product[] }): void {
  const snapshot = get().products.map((p) => ({ ...p }));
  void cacheSet(CACHE_KEY, snapshot).catch((err) =>
    console.error('Failed to persist products:', err),
  );
}

interface ProductState {
  products: Product[];
  searchQuery: string;
}

export interface ProductActions {
  setProducts: (products: Product[]) => void;
  addProduct: (product: Product) => void;
  updateProduct: (id: string, patch: Partial<Omit<Product, 'id' | 'createdAt'>>) => void;
  deleteProduct: (id: string) => void;
  setSearchQuery: (searchQuery: string) => void;
}

type ProductStore = ProductState & ProductActions;

export const useProductStore = create<ProductStore>()(
  immer((set, get) => ({
    products: [],
    searchQuery: '',

    setProducts: (products) =>
      set((state) => {
        state.products = products;
      }),

    addProduct: (product) => {
      set((state) => {
        state.products.unshift(product);
      });
      persistProducts(get);
    },

    updateProduct: (id, patch) => {
      set((state) => {
        const idx = state.products.findIndex((p: Product) => p.id === id);
        if (idx !== -1) Object.assign(state.products[idx]!, patch);
      });
      persistProducts(get);
    },

    deleteProduct: (id) => {
      set((state) => {
        state.products = state.products.filter((p: Product) => p.id !== id);
      });
      persistProducts(get);
    },

    setSearchQuery: (searchQuery) =>
      set((state) => {
        state.searchQuery = searchQuery;
      }),
  })),
);
