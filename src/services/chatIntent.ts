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
  | 'navigate'
  | 'chat';

export interface ChatIntent {
  intent: ChatIntentKind;
  amount?: number;
  unitPrice?: number;
  quantity?: number;
  description?: string;
  category?: ExpenseCategory;
  customerName?: string;
  /** Customer phone (0xxxxxxxxx) */
  phone?: string;
  /** Resolved after entity pick */
  customerId?: string;
  productId?: string;
  platformName?: string;
  platformId?: string;
  /** Platform active flag for update_platform */
  platformActive?: boolean;
  depositAmount?: number;
  shippingFee?: number;
  shippingPayer?: ShippingPayer;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  forceNewCustomer?: boolean;
  forceNewProduct?: boolean;
  forceNewPlatform?: boolean;
  orderStatus?: OrderStatus;
  /** Product/order unit label e.g. cái, con, hộp */
  unit?: string;
  /** Free text to find a record (order code, description fragment) */
  targetHint?: string;
  query?: string;
  /** App route for navigate intent e.g. /expense */
  route?: string;
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
    'navigate',
    'chat',
  ];
  if (!allowed.includes(intent)) return null;

  const num = (v: unknown, allowZero = false): number | undefined => {
    const ok = (n: number) =>
      Number.isFinite(n) && (allowZero ? n >= 0 : n > 0);
    if (typeof v === 'number' && ok(v)) return Math.round(v);
    if (typeof v === 'string') {
      const n = Number(v.replace(/[^\d.]/g, ''));
      return ok(n) ? Math.round(n) : undefined;
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
    amount: num(o.amount, true),
    unitPrice: num(o.unitPrice, true),
    quantity: num(o.quantity) ? Math.max(1, num(o.quantity)!) : undefined,
    description: str(o.description),
    category,
    customerName: str(o.customerName),
    phone: str(o.phone),
    platformName: str(o.platformName),
    platformActive:
      typeof o.platformActive === 'boolean'
        ? o.platformActive
        : typeof o.active === 'boolean'
          ? o.active
          : undefined,
    depositAmount: num(o.depositAmount),
    shippingFee: num(o.shippingFee),
    shippingPayer,
    paymentStatus,
    paymentMethod,
    orderStatus,
    unit: str(o.unit),
    targetHint: str(o.targetHint),
    query: str(o.query),
    route: str(o.route),
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
      const hasTotal = typeof intent.amount === 'number' && intent.amount >= 0;
      const hasUnit = typeof intent.unitPrice === 'number' && intent.unitPrice >= 0;
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
      if (
        !intent.targetHint &&
        !intent.description &&
        !intent.amount &&
        !intent.customerName &&
        !intent.platformName &&
        !intent.unit
      ) {
        missing.push('targetHint');
      }
      if (intent.intent === 'update_order_status' && !intent.orderStatus) {
        missing.push('orderStatus');
      }
      if (intent.intent === 'update_product' && intent.unit && !intent.targetHint && !intent.description) {
        // unit-only update still needs who/what to change
        missing.push('targetHint');
      }
      break;
    case 'lookup':
      if (!intent.query && !intent.targetHint) missing.push('query');
      break;
    case 'navigate':
      if (!intent.route && !intent.query && !intent.targetHint && !intent.description) {
        missing.push('query');
      }
      break;
    default:
      break;
  }
  return { ...intent, missing };
}

/** Merge a partial update (from clarify reply) onto pending intent */
export function mergeIntent(base: ChatIntent, patch: ChatIntent): ChatIntent {
  const nextIntent = patch.intent !== 'chat' ? patch.intent : base.intent;
  let description = patch.description ?? base.description;
  const customerName = patch.customerName ?? base.customerName;
  // After flipping expense→revenue with 0đ, ensure we have a product/order label.
  if (
    nextIntent === 'create_revenue' &&
    (!description || description.length < 2) &&
    customerName
  ) {
    description = `Đơn ${customerName}`;
  }
  return fillMissingSlots({
    intent: nextIntent,
    amount: patch.amount !== undefined ? patch.amount : base.amount,
    unitPrice: patch.unitPrice !== undefined ? patch.unitPrice : base.unitPrice,
    quantity: patch.quantity ?? base.quantity,
    unit: patch.unit ?? base.unit,
    description,
    category: patch.category ?? base.category,
    customerName,
    phone: patch.phone ?? base.phone,
    customerId: patch.customerId ?? base.customerId,
    productId: patch.productId ?? base.productId,
    platformName: patch.platformName ?? base.platformName,
    platformActive: patch.platformActive ?? base.platformActive,
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
    route: patch.route ?? base.route,
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

  // Explicit zero / "không cần số tiền" for unpaid TBD orders
  if (base.missing.includes('amount') && isZeroMoneyReply(t)) {
    patch.amount = 0;
    patch.unitPrice = 0;
    // Slot-fill often mis-labels orders as create_expense — 0đ belongs on revenue.
    if (base.intent === 'create_expense') {
      patch.intent = 'create_revenue';
    }
  }

  // money (including 0đ)
  const moneyMatch = lower.match(/(\d[\d.,]*)\s*(k|nghìn|ngàn|tr|triệu|m|đ|₫|đồng|vnd)?/i);
  if (moneyMatch && base.missing.includes('amount') && patch.amount === undefined) {
    let n = parseFloat(moneyMatch[1]!.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(n)) n = NaN;
    const u = (moneyMatch[2] || '').toLowerCase();
    if (n === 0) {
      patch.amount = 0;
      patch.unitPrice = 0;
    } else if (Number.isFinite(n)) {
      if (u === 'k' || u === 'nghìn' || u === 'ngàn') n *= 1000;
      else if (u === 'tr' || u === 'triệu' || u === 'm') n *= 1_000_000;
      else if (!u && n > 0 && n < 1000) n *= 1000;
      if (/giá/.test(lower) && !/giá\s*(tiền\s*)?(là\s*)?0\b/i.test(lower)) {
        patch.unitPrice = Math.round(n);
      } else {
        patch.amount = Math.round(n);
      }
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
    const qty = intent.quantity ?? 1;
    let amount = intent.amount;
    let unitPrice = intent.unitPrice;
    if (unitPrice && qty > 1 && amount === unitPrice) amount = unitPrice * qty;
    if (amount && !unitPrice && qty > 1) unitPrice = Math.round(amount / qty);
    return {
      id: newDraftId(),
      kind: 'expense',
      date: todayIso(),
      amount,
      unitPrice,
      quantity: qty > 1 || intent.category === 'supplies' ? qty : intent.quantity,
      description: intent.description,
      category: intent.category ?? 'other',
      productId: intent.productId,
      paymentMethod: intent.paymentMethod,
      source,
      confidence: intent.confidence,
    };
  }
  if (intent.intent === 'create_revenue') {
    const qty = intent.quantity ?? 1;
    let amount = intent.amount;
    let unitPrice = intent.unitPrice;
    if (typeof unitPrice === 'number' && amount == null) amount = unitPrice * qty;
    if (typeof amount === 'number' && unitPrice == null) {
      unitPrice = qty > 0 ? Math.round(amount / qty) : 0;
    }
    if (typeof amount !== 'number' || amount < 0 || !intent.description) return null;
    const noteBits = [
      amount === 0 ? 'Đơn 0đ — cập nhật giá khi có' : undefined,
    ].filter(Boolean);
    return {
      id: newDraftId(),
      kind: 'revenue',
      date: todayIso(),
      amount,
      unitPrice: unitPrice ?? 0,
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
      notes: noteBits.length ? noteBits.join(' · ') : undefined,
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

/** User started a new order/expense command — abandon stuck slot-fill. */
export function isNewLedgerRequest(message: string): boolean {
  const t = message.trim();
  return (
    /^(tạo|thêm|ghi|làm)\s*(lại\s*)?(đơn|order|doanh\s*thu|chi(\s*phí)?)\b/i.test(t) ||
    /^đơn\s*(hàng\s*)?(cho|của)\b/i.test(t) ||
    /tạo\s*lại\s*(cho\s*tôi\s*)?đơn\b/i.test(t)
  );
}

export function isZeroMoneyReply(message: string): boolean {
  const lower = message.trim().toLowerCase();
  return /không\s*cần\s*(số\s*)?tiền|giá\s*(tiền\s*)?(là\s*)?0\b|^(0\s*(đ|₫|đồng|vnd)?)$|số\s*tiền\s*(là\s*)?0\b/i.test(
    lower,
  );
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
