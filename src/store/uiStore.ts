/**
 * UI Store — global UI state (sidebar, tabs, toasts, FAB, dialogs).
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

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

export type RecordDetailKind = 'expense' | 'revenue';

interface UIState {
  sidebarOpen: boolean;
  activeTab: string;
  toasts: ToastItem[];
  fabOpen: boolean;
  globalDialog: DialogConfig | null;
  recordDetailRequest: { kind: RecordDetailKind; id: string } | null;
}

export interface UIActions {
  toggleSidebar: () => void;
  setActiveTab: (tab: string) => void;
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
  toggleFab: () => void;
  setFabOpen: (open: boolean) => void;
  showDialog: (config: DialogConfig) => void;
  closeDialog: () => void;
  requestRecordDetail: (kind: RecordDetailKind, id: string) => void;
  clearRecordDetailRequest: () => void;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>()(
  immer((set, get) => ({
    sidebarOpen: true,
    activeTab: 'dashboard',
    toasts: [],
    fabOpen: false,
    globalDialog: null,
    recordDetailRequest: null,

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

    setFabOpen: (open) =>
      set((state) => {
        state.fabOpen = open;
      }),

    showDialog: (config) =>
      set((state) => {
        state.globalDialog = config;
      }),

    closeDialog: () =>
      set((state) => {
        state.globalDialog = null;
      }),

    requestRecordDetail: (kind, id) =>
      set((state) => {
        state.recordDetailRequest = { kind, id };
      }),

    clearRecordDetailRequest: () =>
      set((state) => {
        state.recordDetailRequest = null;
      }),
  })),
);
