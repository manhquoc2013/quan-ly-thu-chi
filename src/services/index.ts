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

export {
  getAllCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  findOrCreateCustomerByName,
} from './customerService';

// ── Product ──────────────────────────────────────────────────────────────────

export {
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
} from './productService';

export {
  getAllPlatforms,
  createPlatform,
  updatePlatform,
  deletePlatform,
  getDefaultPlatformId,
  getActivePlatforms,
} from './platformService';

export {
  resolveCustomerForOrder,
  resolveProductForOrder,
  resolvePlatformForOrder,
  formatEntityPickMessage,
  productQueryFromDescription,
} from './entityResolve';

// ── Report ───────────────────────────────────────────────────────────────────

export {
  getExpenseByCategory,
  getExpenseByMonth,
  getRevenueByMonth,
  getProfitSummary,
  getDashboardSummary,
} from './reportService';

// ── Bootstrap ────────────────────────────────────────────────────────────────

export { bootstrapAppData, reloadAppData, isAppDataReady } from './bootstrap';

// ── Supabase shared ledger ───────────────────────────────────────────────────

export { isSupabaseConfigured, getSupabase } from './supabaseClient';
export {
  signInSupabase,
  signUpSupabase,
  signOutSupabase,
  createHousehold,
  createInvite,
  redeemInvite,
  getMyHousehold,
} from './householdService';
export {
  hydrateStoresFromCloud,
  migrateLocalCacheToCloud,
  refreshHouseholdFromCloud,
  isCloudSyncActive,
} from './cloudSync';
export { uploadProductImage, getProductImageUrl, removeProductImage } from './productImageStorage';
export { bootstrapSessionAfterAuth } from './sessionBootstrap';
export { flushOutbox, startSyncEngine } from './syncEngine';
export { queueUserSettingsSync, queueProfileSync } from './userSettingsService';
export { enqueueOutbox, pendingCount, clearOutbox } from './syncOutbox';

// ── AI ───────────────────────────────────────────────────────────────────────

export { aiRouter } from './aiRouter';
export { geminiService } from './geminiService';
export { groqService } from './groqService';
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
export type { ChatIntent, ChatIntentKind } from './chatIntent';
export { executeChatIntent } from './chatTools';
