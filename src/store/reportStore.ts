/**
 * Report Store — dashboard data, aggregations, and report state.
 *
 * Zustand 5 + Immer for safe mutable updates.
 * Import types from '@/models';
 *
 * Usage:
 *   const { dateRange, dashboardSummary } = useReportStore();
 *   const { setDateRange, setDashboardSummary } = useReportStore();
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  DateRange,
  ExpenseByCategory,
  ExpenseByMonth,
  RevenueByMonth,
  ProfitSummary,
  DashboardSummary,
} from '@/models';

// ── State ─────────────────────────────────────────────────────────────────────

interface ReportState {
  dateRange: DateRange;
  expenseByCategory: ExpenseByCategory[];
  expenseByMonth: ExpenseByMonth[];
  revenueByMonth: RevenueByMonth[];
  profitSummary: ProfitSummary | null;
  dashboardSummary: DashboardSummary | null;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export interface ReportActions {
  setDateRange: (dateRange: DateRange) => void;
  setExpenseByCategory: (data: ExpenseByCategory[]) => void;
  setExpenseByMonth: (data: ExpenseByMonth[]) => void;
  setRevenueByMonth: (data: RevenueByMonth[]) => void;
  setProfitSummary: (data: ProfitSummary | null) => void;
  setDashboardSummary: (data: DashboardSummary | null) => void;
}

// ── Default date range (current month) ────────────────────────────────────────

function getCurrentMonthRange(): DateRange {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const from = `${year}-${month}-01`;
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  const to = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

// ── Store ─────────────────────────────────────────────────────────────────────

type ReportStore = ReportState & ReportActions;

export const useReportStore = create<ReportStore>()(
  immer((set) => ({
    dateRange: getCurrentMonthRange(),
    expenseByCategory: [],
    expenseByMonth: [],
    revenueByMonth: [],
    profitSummary: null,
    dashboardSummary: null,

    // ── Mutations ──────────────────────────────────────────────────────────

    setDateRange: (dateRange) =>
      set((state) => {
        state.dateRange = dateRange;
      }),

    setExpenseByCategory: (expenseByCategory) =>
      set((state) => {
        state.expenseByCategory = expenseByCategory;
      }),

    setExpenseByMonth: (expenseByMonth) =>
      set((state) => {
        state.expenseByMonth = expenseByMonth;
      }),

    setRevenueByMonth: (revenueByMonth) =>
      set((state) => {
        state.revenueByMonth = revenueByMonth;
      }),

    setProfitSummary: (profitSummary) =>
      set((state) => {
        state.profitSummary = profitSummary;
      }),

    setDashboardSummary: (dashboardSummary) =>
      set((state) => {
        state.dashboardSummary = dashboardSummary;
      }),
  })),
);
