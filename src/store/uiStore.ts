/**
 * UI Store — global UI state (sidebar, tabs, toasts, FAB, dialogs).
 *
 * Zustand 5 + Immer for safe mutable updates.
 *
 * Usage:
 *   const { sidebarOpen, activeTab } = useUIStore();
 *   const { toggleSidebar, addToast, showDialog } = useUIStore();
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export interface DialogConfig {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'warning';
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  dismissible?: boolean;
}

// ── State ─────────────────────────────────────────────────────────────────────

interface UIState {
  sidebarOpen: boolean;
  activeTab: string;
  toasts: ToastItem[];
  fabOpen: boolean;
  globalDialog: DialogConfig | null;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export interface UIActions {
  toggleSidebar: () => void;
  setActiveTab: (tab: string) => void;
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
  toggleFab: () => void;
  showDialog: (config: DialogConfig) => void;
  closeDialog: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ── Store ─────────────────────────────────────────────────────────────────────

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>()(
  immer((set, get) => ({
    sidebarOpen: true,
    activeTab: 'dashboard',
    toasts: [],
    fabOpen: false,
    globalDialog: null,

    // ── Mutations ──────────────────────────────────────────────────────────

    toggleSidebar: () =>
      set((state) => {
        state.sidebarOpen = !state.sidebarOpen;
      }),

    setActiveTab: (activeTab) =>
      set((state) => {
        state.activeTab = activeTab;
      }),

    addToast: (toast) => {
      const id = generateId();
      const duration = toast.duration ?? 4000;
      set((state) => {
        state.toasts.push({ ...toast, id });
      });
      // Auto-remove after duration
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    },

    removeToast: (id) =>
      set((state) => {
        state.toasts = state.toasts.filter((t: ToastItem) => t.id !== id);
      }),

    toggleFab: () =>
      set((state) => {
        state.fabOpen = !state.fabOpen;
      }),

    showDialog: (config) =>
      set((state) => {
        state.globalDialog = config;
      }),

    closeDialog: () =>
      set((state) => {
        state.globalDialog = null;
      }),
  })),
);
