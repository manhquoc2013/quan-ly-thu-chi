/**
 * Barrel export — all services.
 *
 * Usage:
 *   import { cacheGet, getAllExpenses, createRevenue, getDashboardSummary } from '@/services';
 *   import { cacheGet } from '@/services/cacheManager';
 *   import { getAllExpenses } from '@/services/expenseService';
 */

// ── Cache ────────────────────────────────────────────────────────────────────

export { cacheGet, cacheSet, cacheDelete, cacheClear } from './cacheManager';

// ── Expense ──────────────────────────────────────────────────────────────────

export { getAllExpenses, createExpense, updateExpense, deleteExpenses } from './expenseService';

// ── Revenue ──────────────────────────────────────────────────────────────────

export { getAllRevenues, createRevenue, updateRevenue, deleteRevenues } from './revenueService';

// ── Customer ─────────────────────────────────────────────────────────────────

export { getAllCustomers, createCustomer, updateCustomer, deleteCustomer } from './customerService';

// ── Report ───────────────────────────────────────────────────────────────────

export {
  getExpenseByCategory,
  getExpenseByMonth,
  getRevenueByMonth,
  getProfitSummary,
  getDashboardSummary,
} from './reportService';

// ── Bootstrap ────────────────────────────────────────────────────────────────

export { bootstrapAppData, isAppDataReady } from './bootstrap';

// ── Google Drive ─────────────────────────────────────────────────────────────

export { connectGoogleDrive, syncFromDrive, syncToDrive, isDriveConnected, uploadInvoiceImage } from './googleDrive';

// ── AI ───────────────────────────────────────────────────────────────────────

export { aiRouter } from './aiRouter';
export { geminiService } from './geminiService';
export { webLLM } from './webLLM';
export { speechService } from './speechService';
export {
  intakeFromFile,
  intakeFromText,
  persistConfirmed,
  buildFinanceContext,
  isAcceptedIntakeFile,
} from './intakeService';
export type { DraftRecord, DraftKind, IntakeResult } from './draftTypes';
