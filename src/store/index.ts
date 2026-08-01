/**
 * Barrel export — all Zustand stores.
 *
 * Usage:
 *   import { useExpenseStore, useRevenueStore } from '@/store';
 *   import { useCustomerStore, useReportStore, useUIStore, useAuthStore } from '@/store';
 */

export { useExpenseStore } from './expenseStore';
export type {
  ExpenseFilters,
  ExpenseSortConfig,
  ExpenseActions,
  ExpenseSelectors,
} from './expenseStore';

export { useRevenueStore } from './revenueStore';
export type {
  RevenueFilters,
  RevenueSortConfig,
  RevenueActions,
  RevenueSelectors,
} from './revenueStore';

export { useCustomerStore } from './customerStore';
export type {
  CustomerActions,
  CustomerSelectors,
} from './customerStore';

export { useReportStore } from './reportStore';
export type { ReportActions } from './reportStore';

export { useUIStore } from './uiStore';
export type {
  ToastItem,
  DialogConfig,
  UIActions,
} from './uiStore';

export { useAuthStore } from './authStore';
export type {
  GoogleUser,
  AuthActions,
} from './authStore';
