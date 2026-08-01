/**
 * Barrel export — all model types, interfaces, and label constants.
 *
 * Usage:
 *   import { Expense, ExpenseCategory, EXPENSE_CATEGORY_LABELS } from '@/models';
 *   import { Revenue, OrderItem, OrderStatus, ORDER_STATUS_LABELS } from '@/models';
 *   import { Customer } from '@/models';
 *   import { ExpenseReport, RevenueReport, DashboardSummary } from '@/models';
 */

// ── Expense ───────────────────────────────────────────────────────────────────

export {
  type Expense,
  type ExpenseCategory,
  type ExpenseStatus,
  type PaymentMethod,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from './expense';

// ── Revenue ───────────────────────────────────────────────────────────────────

export {
  type Revenue,
  type OrderItem,
  type OrderStatus,
  type DeliveryStatus,
  ORDER_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
} from './revenue';

// ── Customer ──────────────────────────────────────────────────────────────────

export { type Customer } from './customer';

// ── Report ────────────────────────────────────────────────────────────────────

export {
  type DateRange,
  type MonthlySummary,
  type ExpenseReport,
  type RevenueReport,
  type ProfitReport,
  type ExpenseByCategory,
  type ExpenseByMonth,
  type RevenueByMonth,
  type ProfitSummary,
  type DashboardSummary,
} from './report';
