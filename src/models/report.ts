/**
 * Report Models (Báo cáo) — data types for aggregated views.
 * See docs/02-data-models.md § 5
 *
 * Re-exports shared types from expense.ts.
 */

import { type ExpenseCategory, type PaymentMethod } from './expense';

// ── Shared primitives ─────────────────────────────────────────────────────────

export interface DateRange {
  /** ISO date string (start, inclusive) */
  from: string;

  /** ISO date string (end, inclusive) */
  to: string;
}

export interface MonthlySummary {
  /** "2026-07" */
  month: string;

  /** Tổng tiền */
  total: number;

  /** Số lượng bản ghi */
  count: number;
}

// ── Expense reports ───────────────────────────────────────────────────────────

export interface ExpenseReport {
  /** Khoảng thời gian báo cáo */
  dateRange: DateRange;

  /** Tổng chi phí trong khoảng thời gian */
  totalExpense: number;

  /** Chi phí theo danh mục */
  byCategory: CategorySummary[];

  /** Chi phí theo tháng */
  byMonth: MonthlySummary[];

  /** Chi phí theo phương thức thanh toán */
  byPaymentMethod: PaymentMethodSummary[];
}

interface CategorySummary {
  category: ExpenseCategory;
  total: number;
  count: number;
  percentage: number;
}

interface PaymentMethodSummary {
  method: PaymentMethod;
  total: number;
  count: number;
}

// ── Revenue reports ───────────────────────────────────────────────────────────

export interface RevenueReport {
  /** Khoảng thời gian báo cáo */
  dateRange: DateRange;

  /** Tổng doanh thu */
  totalRevenue: number;

  /** Tổng số đơn hàng */
  totalOrders: number;

  /** Giá trị trung bình mỗi đơn hàng */
  averageOrderValue: number;

  /** Doanh thu theo tháng */
  byMonth: MonthlySummary[];

  /** Sản phẩm bán chạy nhất */
  topProducts: ProductSummary[];

  /** Khách hàng thân thiết nhất */
  topCustomers: CustomerSummary[];

  /** Đơn hàng theo trạng thái */
  byOrderStatus: StatusSummary[];
}

interface ProductSummary {
  name: string;
  totalQuantity: number;
  totalRevenue: number;
}

interface CustomerSummary {
  customerId: string;
  customerName: string;
  totalOrders: number;
  totalRevenue: number;
}

interface StatusSummary {
  status: string;
  count: number;
  total: number;
}

// ── Profit reports ────────────────────────────────────────────────────────────

export interface ProfitReport {
  /** Khoảng thời gian báo cáo */
  dateRange: DateRange;

  /** Tổng doanh thu */
  totalRevenue: number;

  /** Tổng chi phí */
  totalExpense: number;

  /** Lợi nhuận gộp */
  grossProfit: number;

  /** Biên lợi nhuận (%) */
  profitMargin: number;

  /** Lợi nhuận theo tháng */
  byMonth: MonthlyProfitSummary[];
}

interface MonthlyProfitSummary {
  month: string;
  revenue: number;
  expense: number;
  profit: number;
}

// ── Dashboard / summary models ────────────────────────────────────────────────

export interface ExpenseByCategory {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

export interface ExpenseByMonth {
  month: string;
  total: number;
  count: number;
}

export interface RevenueByMonth {
  month: string;
  total: number;
  count: number;
}

export interface ProfitSummary {
  totalRevenue: number;
  totalExpense: number;
  profit: number;
  margin: number;
  period: string;
}

export interface DashboardSummary {
  totalExpense: number;
  totalRevenue: number;
  profit: number;
  pendingOrders: number;
  recentTransactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    type: 'expense' | 'revenue';
  }>;
}
