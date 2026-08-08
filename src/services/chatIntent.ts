/**
 * Chat intent types — structured actions the LLM/regex produce for tools.
 */

import type {
  ExpenseCategory,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ShippingPayer,
} from '@/models';
import { EXPENSE_CATEGORY_LABELS } from '@/models';
import { newDraftId, todayIso, type DraftRecord } from './draftTypes';

export type ChatIntentKind =
  | 'create_expense'
  | 'create_revenue'
  | 'create_product'
  | 'create_customer'
  | 'create_platform'
  | 'update_expense'
  | 'update_revenue'
  | 'update_product'
  | 'update_customer'
  | 'update_platform'
  | 'delete_expense'
  | 'delete_revenue'
  | 'delete_product'
  | 'delete_customer'
  | 'delete_platform'
  | 'update_order_status'
  | 'lookup'
  | 'chat';

export interface ChatIntent {
  intent: ChatIntentKind;
  amount?: number;
  unitPrice?: number;
  quantity?: number;
  description?: string;
  category?: ExpenseCategory;
  customerName?: string;
  /** Resolved after entity pick */
  customerId?: string;
  productId?: string;
  platformName?: string;
  platformId?: string;
  depositAmount?: number;
  shippingFee?: number;
  shippingPayer?: ShippingPayer;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  forceNewCustomer?: boolean;
  forceNewProduct?: boolean;
  forceNewPlatform?: boolean;
  orderStatus?: OrderStatus;
  /** Free text to find a record (order code, description fragment) */
  targetHint?: string;
  query?: string;
  confidence: number;
  /** Slots still required before execute */
  missing: string[];
  /** Short Vietnamese summary of what was understood */
  summaryVi?: string;
  /** Optional mascot line from LLM extract */
  mascotSay?: string;
  mascotEmotion?: string;
}

export interface PendingChatState {
  intent: ChatIntent;
  /** Waiting for user to type xác nhận before delete */
  awaitingDeleteConfirm?: boolean;
  /** Waiting for numbered pick of customer/product */
  awaitingEntityPick?: {
    kind: 'customer' | 'product' | 'platform';
    query: string;
    options: Array<{ id: string; label: string }>;
  };
  updatedAt: number;
}

const CATEGORIES = new Set(Object.keys(EXPENSE_CATEGORY_LABELS));
const ORDER_STATUSES = new Set([
  'new',
  'confirmed',
  'processing',
  'completed',
  'cancelled',
]);

export function emptyIntent(intent: ChatIntentKind = 'chat'): ChatIntent {
  return { intent, confidence: 0, missing: [] };
}

/** Normalize raw LLM JSON into ChatIntent */
export function normalizeIntent(raw: unknown): ChatIntent | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const intent = String(o.intent ?? 'chat') as ChatIntentKind;
  const allowed: ChatIntentKind[] = [
    'create_expense',
    'create_revenue',
    'create_product',
    'create_customer',
    'create_platform',
    'update_expense',
    'update_revenue',
    'update_product',
    'update_customer',
    'update_platform',
    'delete_expense',
    'delete_revenue',
    'delete_product',
    'delete_customer',
    'delete_platform',
    'update_order_status',
    'lookup',
    'chat',
  ];
  if (!allowed.includes(intent)) return null;

  const num = (v: unknown): number | undefined => {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.round(v);
    if (typeof v === 'string') {
      const n = Number(v.replace(/[^\d.]/g, ''));
      return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
    }
    return undefined;
  };

  const str = (v: unknown): string | undefined => {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t.length ? t : undefined;
  };

  const categoryRaw = str(o.category);
  const category =
    categoryRaw && CATEGORIES.has(categoryRaw)
      ? (categoryRaw as ExpenseCategory)
      : undefined;

  const statusRaw = str(o.orderStatus);
  const orderStatus =
    statusRaw && ORDER_STATUSES.has(statusRaw)
      ? (statusRaw as OrderStatus)
      : undefined;

  const missingRaw = Array.isArray(o.missing)
    ? o.missing.filter((x): x is string => typeof x === 'string')
    : [];

  const confidence =
    typeof o.confidence === 'number'
      ? Math.min(1, Math.max(0, o.confidence))
      : 0.5;

  const payerRaw = str(o.shippingPayer);
  const shippingPayer: ShippingPayer | undefined =
    payerRaw === 'shop' || payerRaw === 'customer' ? payerRaw : undefined;

  const payStatusRaw = str(o.paymentStatus);
  const paymentStatus: PaymentStatus | undefined =
    payStatusRaw === 'paid' || payStatusRaw === 'unpaid' ? payStatusRaw : undefined;

  const payMethodRaw = str(o.paymentMethod);
  const paymentMethods = new Set([
    'cash',
    'bank_transfer',
    'credit_card',
    'e_wallet',
  ]);
  const paymentMethod: PaymentMethod | undefined =
    payMethodRaw && paymentMethods.has(payMethodRaw)
      ? (payMethodRaw as PaymentMethod)
      : undefined;

  const intentObj: ChatIntent = {
    intent,
    amount: num(o.amount),
    unitPrice: num(o.unitPrice),
    quantity: num(o.quantity) ? Math.max(1, num(o.quantity)!) : undefined,
    description: str(o.description),
    category,
    customerName: str(o.customerName),
    platformName: str(o.platformName),
    depositAmount: num(o.depositAmount),
    shippingFee: num(o.shippingFee),
    shippingPayer,
    paymentStatus,
    paymentMethod,
    orderStatus,
    targetHint: str(o.targetHint),
    query: str(o.query),
    confidence,
    missing: missingRaw,
    summaryVi: str(o.summaryVi),
    mascotSay: str(o.mascot_say) ?? str(o.mascotSay),
    mascotEmotion: str(o.mascot_emotion) ?? str(o.mascotEmotion),
  };

  return fillMissingSlots(intentObj);
}

/** Recompute missing slots from fields */
export function fillMissingSlots(intent: ChatIntent): ChatIntent {
  const missing: string[] = [];
  switch (intent.intent) {
    case 'create_expense':
      if (!(intent.amount && intent.amount > 0)) missing.push('amount');
      if (!intent.description || intent.description.length < 2) missing.push('description');
      break;
    case 'create_product': {
      const price = intent.unitPrice ?? intent.amount;
      if (!(price && price > 0)) missing.push('amount');
      if (!intent.description || intent.description.length < 2) missing.push('description');
      if (price && price > 0) {
        intent.unitPrice = price;
        intent.amount = price;
      }
      break;
    }
    case 'create_customer':
      if (!intent.customerName || intent.customerName.length < 2) missing.push('customerName');
      break;
    case 'create_platform':
      if (!intent.platformName || intent.platformName.length < 2) missing.push('platformName');
      break;
    case 'create_revenue': {
      const qty = intent.quantity ?? 1;
      const hasTotal = intent.amount && intent.amount > 0;
      const hasUnit = intent.unitPrice && intent.unitPrice > 0;
      if (!hasTotal && !hasUnit) missing.push('amount');
      if (!intent.description || intent.description.length < 2) missing.push('description');
      if (hasUnit && !hasTotal) {
        intent.amount = intent.unitPrice! * qty;
      }
      break;
    }
    case 'update_expense':
    case 'update_revenue':
    case 'update_product':
    case 'update_customer':
    case 'update_platform':
    case 'delete_expense':
    case 'delete_revenue':
    case 'delete_product':
    case 'delete_customer':
    case 'delete_platform':
    case 'update_order_status':
      if (!intent.targetHint && !intent.description && !intent.amount && !intent.customerName && !intent.platformName) {
        missing.push('targetHint');
      }
      if (intent.intent === 'update_order_status' && !intent.orderStatus) {
        missing.push('orderStatus');
      }
      break;
    case 'lookup':
      if (!intent.query && !intent.targetHint) missing.push('query');
      break;
    default:
      break;
  }
  return { ...intent, missing };
}

/** Merge a partial update (from clarify reply) onto pending intent */
export function mergeIntent(base: ChatIntent, patch: ChatIntent): ChatIntent {
  return fillMissingSlots({
    intent: patch.intent !== 'chat' ? patch.intent : base.intent,
    amount: patch.amount ?? base.amount,
    unitPrice: patch.unitPrice ?? base.unitPrice,
    quantity: patch.quantity ?? base.quantity,
    description: patch.description ?? base.description,
    category: patch.category ?? base.category,
    customerName: patch.customerName ?? base.customerName,
    customerId: patch.customerId ?? base.customerId,
    productId: patch.productId ?? base.productId,
    platformName: patch.platformName ?? base.platformName,
    platformId: patch.platformId ?? base.platformId,
    depositAmount: patch.depositAmount ?? base.depositAmount,
    shippingFee: patch.shippingFee ?? base.shippingFee,
    shippingPayer: patch.shippingPayer ?? base.shippingPayer,
    paymentStatus: patch.paymentStatus ?? base.paymentStatus,
    paymentMethod: patch.paymentMethod ?? base.paymentMethod,
    forceNewCustomer: patch.forceNewCustomer ?? base.forceNewCustomer,
    forceNewProduct: patch.forceNewProduct ?? base.forceNewProduct,
    forceNewPlatform: patch.forceNewPlatform ?? base.forceNewPlatform,
    orderStatus: patch.orderStatus ?? base.orderStatus,
    targetHint: patch.targetHint ?? base.targetHint,
    query: patch.query ?? base.query,
    confidence: Math.max(base.confidence, patch.confidence),
    missing: [],
    summaryVi: patch.summaryVi ?? base.summaryVi,
    mascotSay: patch.mascotSay ?? base.mascotSay,
    mascotEmotion: patch.mascotEmotion ?? base.mascotEmotion,
  });
}

/** Heuristic merge when user only types a short clarify reply (no LLM) */
export function mergeClarifyReply(base: ChatIntent, reply: string): ChatIntent {
  const t = reply.trim();
  const lower = t.toLowerCase();
  const patch: ChatIntent = { ...emptyIntent(base.intent), confidence: 0.7, missing: [] };

  // money
  const moneyMatch = lower.match(/(\d[\d.,]*)\s*(k|nghìn|ngàn|tr|triệu|m)?/i);
  if (moneyMatch && base.missing.includes('amount')) {
    let n = parseFloat(moneyMatch[1]!.replace(/\./g, '').replace(',', '.'));
    const u = (moneyMatch[2] || '').toLowerCase();
    if (u === 'k' || u === 'nghìn' || u === 'ngàn') n *= 1000;
    else if (u === 'tr' || u === 'triệu' || u === 'm') n *= 1_000_000;
    else if (n > 0 && n < 1000) n *= 1000;
    if (base.missing.includes('amount') && /giá/.test(lower)) {
      patch.unitPrice = Math.round(n);
    } else {
      patch.amount = Math.round(n);
    }
  }

  // quantity alone
  if (/^\d{1,4}$/.test(t) && base.missing.includes('quantity')) {
    patch.quantity = parseInt(t, 10);
  }

  // order status keywords
  const statusMap: Record<string, OrderStatus> = {
    'mới': 'new',
    'mới tạo': 'new',
    'xác nhận': 'confirmed',
    'đã xác nhận': 'confirmed',
    'xử lý': 'processing',
    'đang xử lý': 'processing',
    'hoàn thành': 'completed',
    'hủy': 'cancelled',
    'huỷ': 'cancelled',
  };
  for (const [k, v] of Object.entries(statusMap)) {
    if (lower === k || lower.includes(k)) {
      patch.orderStatus = v;
      break;
    }
  }

  // description / customer / target
  if (base.missing.includes('description') && t.length >= 2 && !moneyMatch) {
    patch.description = t;
  } else if (base.missing.includes('customerName') && t.length >= 2) {
    patch.customerName = t.replace(/^(cho|khách)\s+/i, '');
  } else if (base.missing.includes('targetHint') && t.length >= 2) {
    patch.targetHint = t;
  } else if (base.missing.includes('query') && t.length >= 2) {
    patch.query = t;
  } else if (
    !moneyMatch &&
    t.length >= 2 &&
    !patch.description &&
    !patch.customerName &&
    !patch.targetHint
  ) {
    // generic fill first missing text slot
    const slot = base.missing.find((s) =>
      ['description', 'customerName', 'targetHint', 'query'].includes(s),
    );
    if (slot === 'description') patch.description = t;
    if (slot === 'customerName') patch.customerName = t;
    if (slot === 'targetHint') patch.targetHint = t;
    if (slot === 'query') patch.query = t;
  }

  return mergeIntent(base, patch);
}

export function intentToDraft(intent: ChatIntent, source: DraftRecord['source'] = 'text'): DraftRecord | null {
  if (intent.intent === 'create_expense') {
    if (!intent.amount || !intent.description) return null;
    return {
      id: newDraftId(),
      kind: 'expense',
      date: todayIso(),
      amount: intent.amount,
      description: intent.description,
      category: intent.category ?? 'other',
      source,
      confidence: intent.confidence,
    };
  }
  if (intent.intent === 'create_revenue') {
    const qty = intent.quantity ?? 1;
    let amount = intent.amount;
    let unitPrice = intent.unitPrice;
    if (unitPrice && !amount) amount = unitPrice * qty;
    if (amount && !unitPrice) unitPrice = Math.round(amount / qty);
    if (!amount || !intent.description) return null;
    return {
      id: newDraftId(),
      kind: 'revenue',
      date: todayIso(),
      amount,
      unitPrice,
      quantity: qty,
      description:
        qty > 1 && !/×/.test(intent.description)
          ? `${qty} × ${intent.description}`
          : intent.description,
      customerName: intent.customerName,
      customerId: intent.customerId,
      productId: intent.productId,
      platformId: intent.platformId,
      platformName: intent.platformName,
      depositAmount: intent.depositAmount,
      depositedAt: intent.depositAmount ? todayIso() : undefined,
      shippingFee: intent.shippingFee,
      shippingPayer: intent.shippingFee
        ? intent.shippingPayer ?? 'customer'
        : undefined,
      paymentStatus: intent.paymentStatus ?? 'unpaid',
      paymentMethod: intent.paymentMethod,
      source,
      confidence: intent.confidence,
    };
  }
  return null;
}

export function clarifyQuestion(intent: ChatIntent): string {
  const labels: Record<string, string> = {
    amount: 'số tiền',
    description: 'mô tả / tên sản phẩm',
    customerName: 'tên khách hàng',
    targetHint: 'mã đơn hoặc mô tả bản ghi cần thao tác',
    orderStatus: 'trạng thái đơn (mới / xác nhận / xử lý / hoàn thành / hủy)',
    query: 'nội dung cần tra cứu',
    quantity: 'số lượng',
  };
  const bits = intent.missing.map((m) => labels[m] ?? m);
  const head = intent.summaryVi
    ? `Mình hiểu: *${intent.summaryVi}*. `
    : '';
  return `${head}Còn thiếu: **${bits.join(', ')}**. Bạn bổ sung giúp nhé (hoặc gõ \`hủy\` để bỏ).`;
}

export function isCancelMessage(message: string): boolean {
  const t = message.trim().toLowerCase();
  return /^(hủy|huỷ|cancel|thôi|bỏ|không)$/i.test(t);
}

export function isConfirmMessage(message: string): boolean {
  const t = message.trim().toLowerCase();
  return /^(xác nhận|xac nhan|confirm|ok|đồng ý|dong y|yes|y)$/i.test(t);
}

/** Parse "0" / "1" / "2." style entity pick replies. Returns null if not a pick. */
export function parseEntityPickIndex(message: string): number | null {
  const t = message.trim();
  const m = /^(?:chọn\s*)?(\d+)\s*[.)]?$/i.exec(t);
  if (!m) return null;
  return parseInt(m[1]!, 10);
}

/** Build create_revenue intent from a text draft (regex intake). */
export function draftToCreateIntent(draft: DraftRecord): ChatIntent {
  if (draft.kind === 'product') {
    return fillMissingSlots({
      intent: 'create_product',
      amount: draft.amount,
      unitPrice: draft.amount,
      description: draft.description,
      confidence: draft.confidence ?? 0.9,
      missing: [],
    });
  }
  if (draft.kind === 'expense') {
    return fillMissingSlots({
      intent: 'create_expense',
      amount: draft.amount,
      description: draft.description,
      category: draft.category,
      confidence: draft.confidence ?? 0.9,
      missing: [],
    });
  }
  return fillMissingSlots({
    intent: 'create_revenue',
    amount: draft.amount,
    unitPrice: draft.unitPrice,
    quantity: draft.quantity,
    description: draft.description,
    customerName: draft.customerName,
    customerId: draft.customerId,
    productId: draft.productId,
    platformId: draft.platformId,
    platformName: draft.platformName,
    depositAmount: draft.depositAmount,
    shippingFee: draft.shippingFee,
    shippingPayer: draft.shippingPayer,
    paymentStatus: draft.paymentStatus,
    paymentMethod: draft.paymentMethod,
    confidence: draft.confidence ?? 0.9,
    missing: [],
  });
}
