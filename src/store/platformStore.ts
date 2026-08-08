/**
 * Order platform store.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { OrderPlatform } from '@/models';
import { cacheSet } from '@/services/cacheManager';

const CACHE_KEY = 'orderPlatforms';

function persist(get: () => { platforms: OrderPlatform[] }): void {
  void cacheSet(
    CACHE_KEY,
    get().platforms.map((p) => ({ ...p })),
  ).catch((err) => console.error('Failed to persist platforms:', err));
}

interface PlatformState {
  platforms: OrderPlatform[];
  searchQuery: string;
}

export interface PlatformActions {
  setPlatforms: (platforms: OrderPlatform[]) => void;
  addPlatform: (platform: OrderPlatform) => void;
  updatePlatform: (id: string, patch: Partial<Omit<OrderPlatform, 'id' | 'createdAt'>>) => void;
  deletePlatform: (id: string) => void;
  setSearchQuery: (q: string) => void;
}

type PlatformStore = PlatformState & PlatformActions;

export const usePlatformStore = create<PlatformStore>()(
  immer((set, get) => ({
    platforms: [],
    searchQuery: '',

    setPlatforms: (platforms) =>
      set((s) => {
        s.platforms = platforms;
      }),

    addPlatform: (platform) => {
      set((s) => {
        s.platforms.unshift(platform);
      });
      persist(get);
      void import('@/services/cloudSync')
        .then((m) => m.cloudUpsertPlatform(platform))
        .catch((err) => console.error('[cloud] platform add', err));
    },

    updatePlatform: (id, patch) => {
      set((s) => {
        const idx = s.platforms.findIndex((p) => p.id === id);
        if (idx !== -1) Object.assign(s.platforms[idx]!, patch);
      });
      persist(get);
      const platform = get().platforms.find((p) => p.id === id);
      if (platform) {
        void import('@/services/cloudSync')
          .then((m) => m.cloudUpsertPlatform(platform))
          .catch((err) => console.error('[cloud] platform update', err));
      }
    },

    deletePlatform: (id) => {
      set((s) => {
        s.platforms = s.platforms.filter((p) => p.id !== id);
      });
      persist(get);
      void import('@/services/cloudSync')
        .then((m) => m.cloudDeletePlatform(id))
        .catch((err) => console.error('[cloud] platform delete', err));
    },

    setSearchQuery: (searchQuery) =>
      set((s) => {
        s.searchQuery = searchQuery;
      }),
  })),
);
