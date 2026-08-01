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
} from "./expense";

// ── Revenue ───────────────────────────────────────────────────────────────────

export {
  type Revenue,
  type OrderItem,
  type OrderStatus,
  type DeliveryStatus,
  type PaymentStatus,
  type ShippingPayer,
  ORDER_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  SHIPPING_PAYER_LABELS,
} from "./revenue";

// ── Customer ──────────────────────────────────────────────────────────────────

export { type Customer } from "./customer";

export { type Product } from "./product";

export {
  type OrderPlatform,
  PLATFORM_DIRECT_ID,
  DEFAULT_PLATFORM_SEEDS,
} from "./platform";

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
  type CustomerReportRow,
  type ProductReportRow,
  type PlatformReportRow,
} from "./report";
