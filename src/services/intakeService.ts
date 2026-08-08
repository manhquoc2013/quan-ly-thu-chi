/**
 * Unified intake pipeline: normalize → extract drafts → persist on confirm.
 */

import type { ExpenseCategory, ExpenseStatus, PaymentMethod } from '@/models';
import { createExpense } from './expenseService';
import { geminiService } from './geminiService';
import { parseSpreadsheetFile } from './csvImportService';
import { ocrFileToDraft } from './ocrService';
import {
  looksLikeAnalysisIntent,
  looksLikeCreateIntent,
  parseTextToDrafts,
} from './textDraftParser';
import {
  ACCEPTED_INTAKE_MIME,
  MAX_INTAKE_FILE_BYTES,
  draftsHaveErrors,
  type DraftKind,
  type DraftRecord,
  type IntakeResult,
} from './draftTypes';
import { useExpenseStore } from '@/store/expenseStore';
import { useRevenueStore } from '@/store/revenueStore';
import { useCustomerStore } from '@/store/customerStore';
import { useProductStore } from '@/store/productStore';
import { EXPENSE_CATEGORY_LABELS } from '@/models';
import { formatCurrency } from '@/utils/currency';
import { notify } from '@/utils/notify';
import { sumPaidRevenue, sumUnpaidReceivable, isUnpaidReceivable } from '@/utils/revenueMetrics';
import {
  resolveCustomerForOrder,
  resolveProductForOrder,
  productQueryFromDescription,
} from './entityResolve';

export function isAcceptedIntakeFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const okExt =
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.pdf') ||
    name.endsWith('.csv') ||
    name.endsWith('.xls') ||
    name.endsWith('.xlsx');
  const okMime = (ACCEPTED_INTAKE_MIME as readonly string[]).includes(file.type) || file.type === '';
  if (!okExt && !okMime) {
    return 'Chỉ hỗ trợ JPG, PNG, PDF, CSV, XLS/XLSX';
  }
  if (file.size > MAX_INTAKE_FILE_BYTES) {
    return 'File tối đa 5MB';
  }
  return null;
}

export async function intakeFromFile(file: File): Promise<IntakeResult> {
  const err = isAcceptedIntakeFile(file);
  if (err) return { text: `⚠️ ${err}`, source: 'local' };

  const name = file.name.toLowerCase();
  const isSheet =
    name.endsWith('.csv') ||
    name.endsWith('.xls') ||
    name.endsWith('.xlsx') ||
    file.type === 'text/csv' ||
    file.type.includes('spreadsheet') ||
    file.type.includes('excel');

  if (isSheet) {
    const { drafts, guessedKind, error } = await parseSpreadsheetFile(file);
    if (error) {
      return { text: `⚠️ ${error}`, source: 'local', attachmentName: file.name };
    }
    return {
      text: `📄 Đã đọc **${drafts.length}** dòng từ \`${file.name}\` (gợi ý: ${guessedKind === 'expense' ? 'Chi phí' : 'Doanh thu'}). Kiểm tra rồi bấm Xác nhận.`,
      source: 'local',
      drafts,
      attachmentName: file.name,
    };
  }

  const { draft, error, engine } = await ocrFileToDraft(file);
  if (error || !draft) {
    return {
      text: `⚠️ ${error ?? 'Không trích xuất được dữ liệu từ ảnh/PDF'}`,
      source: engine === 'gemini' ? 'cloud' : 'tesseract',
      attachmentName: file.name,
    };
  }

  const warn =
    engine === 'tesseract'
      ? '\n\n⚠️ OCR offline (Tesseract) — độ chính xác với tiếng Việt có thể thấp. Hãy kiểm tra kỹ.'
      : '';

  return {
    text: `🖼️ Đã đọc hóa đơn bằng **${engine === 'gemini' ? 'Gemini Vision' : 'Tesseract'}**. Kiểm tra rồi bấm Xác nhận.${warn}`,
    source: engine === 'gemini' ? 'cloud' : 'tesseract',
    drafts: [draft],
    attachmentName: file.name,
  };
}

export function intakeFromText(message: string, source: 'text' | 'voice' = 'text'): IntakeResult | null {
  const drafts = parseTextToDrafts(message, source);
  if (!drafts.length) return null;

    const lines = drafts.map((d) => {
    const kindLabel =
      d.kind === 'expense' ? 'chi phí' : d.kind === 'revenue' ? 'doanh thu' : 'sản phẩm';
    const cust = d.kind === 'revenue' && d.customerName ? ` · ${d.customerName}` : '';
    return `• ${kindLabel}: **${d.description}** — ${d.amount.toLocaleString('vi-VN')}₫${cust}`;
  });

  const singleKind =
    drafts[0]!.kind === 'expense'
      ? 'chi phí'
      : drafts[0]!.kind === 'revenue'
        ? 'doanh thu'
        : 'sản phẩm';

  return {
    text:
      drafts.length === 1
        ? `Đã nhận diện ${singleKind}: **${drafts[0]!.description}** — ${drafts[0]!.amount.toLocaleString('vi-VN')}₫`
        : `Đã nhận diện **${drafts.length}** mục:\n${lines.join('\n')}`,
    source: 'local',
    drafts,
  };
}

export function buildFinanceContext(): string {
  const expenses = useExpenseStore.getState().records;
  const revenues = useRevenueStore.getState().records;
  const customers = useCustomerStore.getState().customers;
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
  const totalRevenue = sumPaidRevenue(revenues);
  const unpaid = sumUnpaidReceivable(revenues);
  const unpaidN = revenues.filter(isUnpaidReceivable).length;
  const byCategory: Record<string, number> = {};
  expenses.forEach((e) => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  });
  const categorySummary = Object.entries(byCategory)
    .map(
      ([cat, amt]) =>
        `  ${EXPENSE_CATEGORY_LABELS[cat as keyof typeof EXPENSE_CATEGORY_LABELS] || cat}: ${formatCurrency(amt)}`,
    )
    .join('\n');

  const pendingOrders = revenues.filter(
    (r) => r.orderStatus !== 'completed' && r.orderStatus !== 'cancelled',
  );

  const recentExp = [...expenses]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)
    .map((e) => `  - ${e.date} | ${e.description} | ${e.amount} | id=${e.id.slice(0, 8)}`)
    .join('\n');

  const recentRev = [...revenues]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)
    .map(
      (r) =>
        `  - ${r.orderCode} | ${r.date} | ${r.finalAmount} | ${r.orderStatus} | ${r.paymentStatus ?? 'unpaid'} | ${r.items.map((i) => i.name).join(', ')} | id=${r.id.slice(0, 8)}`,
    )
    .join('\n');

  const customerNames = customers
    .slice(0, 20)
    .map((c) => c.name)
    .join(', ');

  const products = useProductStore.getState().products;
  const productNames = products
    .slice(0, 20)
    .map((p) => `${p.name}${p.sku ? ` (${p.sku})` : ''}`)
    .join(', ');

  return `DỮ LIỆU THỰC TẾ (dùng để phân tích/tra cứu/thao tác):
Tổng chi: ${formatCurrency(totalExpense)} (${expenses.length} khoản)
Tổng thu (đã thanh toán): ${formatCurrency(totalRevenue)}
Công nợ (chưa thanh toán): ${formatCurrency(unpaid)} (${unpaidN} đơn)
Lợi nhuận: ${formatCurrency(totalRevenue - totalExpense)}
Đơn đang xử lý: ${pendingOrders.length}${pendingOrders
    .slice(0, 5)
    .map((r) => `\n  - ${r.orderCode} (${r.orderStatus})`)
    .join('')}
Khách hàng: ${customerNames || '(chưa có)'}
Sản phẩm: ${productNames || '(chưa có)'}
Chi theo danh mục:
${categorySummary || '  (chưa có)'}
Chi gần đây:
${recentExp || '  (trống)'}
Đơn gần đây:
${recentRev || '  (trống)'}`;
}

export function shouldAttachFinanceContext(message: string): boolean {
  // Do NOT attach for create — store entities bleed into small local models
  // (hallucinated customer/platform). Create only needs the user message.
  return (
    looksLikeAnalysisIntent(message) ||
    /\b(sửa|xóa|xoá|đổi|cập nhật|tra|tìm|liệt kê|cho biết|bao nhiêu|tổng quan|công nợ)\b/i.test(
      message,
    )
  );
}

export { looksLikeCreateIntent, looksLikeAnalysisIntent };

export async function persistConfirmed(
  drafts: DraftRecord[],
): Promise<{
  ok: number;
  failed: string[];
  created: Array<{ kind: DraftKind; id: string; description: string; amount: number; customerName?: string }>;
}> {
  if (draftsHaveErrors(drafts)) {
    return { ok: 0, failed: ['Còn dòng lỗi — sửa hoặc xóa trước khi xác nhận'], created: [] };
  }

  let ok = 0;
  const failed: string[] = [];
  const created: Array<{
    kind: DraftKind;
    id: string;
    description: string;
    amount: number;
    customerName?: string;
  }> = [];

  for (const draft of drafts) {
    try {
      if (draft.kind === 'expense') {
        const record = await createExpense(
          {
            date: draft.date,
            category: (draft.category ?? 'other') as ExpenseCategory,
            amount: draft.amount,
            description: draft.description,
            status: 'pending' as ExpenseStatus,
            paymentMethod: 'cash' as PaymentMethod,
            tags: [],
          },
          { silent: true },
        );
        created.push({
          kind: 'expense',
          id: record.id,
          description: record.description,
          amount: record.amount,
        });
      } else if (draft.kind === 'product') {
        const { createProduct } = await import('./productService');
        const record = await createProduct(
          {
            name: draft.description,
            defaultUnitPrice: draft.amount,
            unit: 'cái',
          },
          { silent: true },
        );
        created.push({
          kind: 'product',
          id: record.id,
          description: record.name,
          amount: record.defaultUnitPrice,
        });
      } else {
        const record = await persistRevenueDraft(draft);
        created.push({
          kind: 'revenue',
          id: record.id,
          description: draft.description,
          amount: draft.amount,
          customerName: draft.customerName,
        });
      }
      ok += 1;
    } catch (err) {
      failed.push(
        `${draft.description}: ${err instanceof Error ? err.message : 'Lỗi không rõ'}`,
      );
    }
  }

  if (ok > 0) {
    notify.success(ok > 1 ? `Đã lưu ${ok} khoản` : 'Đã lưu 1 khoản');
  }
  if (failed.length > 0 && ok === 0) {
    notify.error(failed[0] ?? 'Không lưu được dữ liệu');
  }

  return { ok, failed, created };
}

async function persistRevenueDraft(draft: DraftRecord) {
  // Prefer IDs already resolved by AI; otherwise resolve with auto-create
  // (OCR / draft UI confirm — if ambiguous, create under the typed name).
  let customerId = draft.customerId ?? 'walk-in';
  let customerName = draft.customerName;

  if (!draft.customerId && draft.customerName?.trim()) {
    let cust = await resolveCustomerForOrder(draft.customerName, { silent: true });
    if (cust.status === 'ambiguous') {
      cust = await resolveCustomerForOrder(draft.customerName, {
        forceCreate: true,
        silent: true,
      });
    }
    if (cust.status === 'resolved' || cust.status === 'walk-in') {
      customerId = cust.id;
      customerName = cust.name;
    }
  }

  let platformId = draft.platformId;
  if (!platformId) {
    const { resolvePlatformForOrder } = await import('./entityResolve');
    let plat = await resolvePlatformForOrder(draft.platformName, { silent: true });
    if (plat.status === 'ambiguous') {
      plat = await resolvePlatformForOrder(draft.platformName, {
        forceCreate: true,
        silent: true,
      });
    }
    if (plat.status === 'resolved') platformId = plat.id;
  }
  if (!platformId) {
    platformId = (await import('./platformService')).getDefaultPlatformId();
  }

  const { createRevenue } = await import('./revenueService');
  const { generateId } = await import('@/utils/id');

  type Line = {
    id: string;
    productId?: string;
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  };

  let items: Line[];

  if (draft.orderItems && draft.orderItems.length > 0) {
    items = [];
    for (const oi of draft.orderItems) {
      const quantity = Math.max(1, oi.quantity);
      const unitPrice = Math.max(1, oi.unitPrice);
      let productId: string | undefined;
      let itemName = oi.name;
      let prod = await resolveProductForOrder(oi.name, {
        suggestedPrice: unitPrice,
        silent: true,
      });
      if (prod.status === 'ambiguous') {
        prod = await resolveProductForOrder(oi.name, {
          forceCreate: true,
          suggestedPrice: unitPrice,
          silent: true,
        });
      }
      if (prod.status === 'resolved') {
        productId = prod.id;
        itemName = prod.name;
      }
      items.push({
        id: generateId(),
        productId,
        name: itemName || 'Sản phẩm',
        quantity,
        unitPrice,
        total: quantity * unitPrice,
      });
    }
  } else {
    const quantity = Math.max(1, draft.quantity ?? 1);
    let unitPrice = draft.unitPrice ?? Math.round(draft.amount / quantity);
    const lineTotal = unitPrice * quantity;
    const total = draft.unitPrice != null ? lineTotal : draft.amount;
    unitPrice = draft.unitPrice != null ? unitPrice : Math.round(total / quantity);

    let productId = draft.productId;
    let itemName = productQueryFromDescription(draft.description) || draft.description || 'Sản phẩm';

    if (!draft.productId) {
      let prod = await resolveProductForOrder(draft.description, {
        suggestedPrice: unitPrice,
        silent: true,
      });
      if (prod.status === 'ambiguous') {
        prod = await resolveProductForOrder(draft.description, {
          forceCreate: true,
          suggestedPrice: unitPrice,
          silent: true,
        });
      }
      if (prod.status === 'resolved') {
        productId = prod.id;
        itemName = prod.name;
        if (!draft.unitPrice && !(draft.amount > 0) && (prod.defaultUnitPrice ?? 0) > 0) {
          unitPrice = prod.defaultUnitPrice ?? 0;
        }
      }
    } else {
      const { useProductStore } = await import('@/store/productStore');
      const p = useProductStore.getState().products.find((x) => x.id === draft.productId);
      if (p) itemName = p.name;
    }

    const finalTotal = unitPrice * quantity;
    items = [
      {
        id: generateId(),
        productId,
        name: itemName || 'Sản phẩm',
        quantity,
        unitPrice,
        total: draft.unitPrice != null || draft.productId ? finalTotal : total,
      },
    ];
  }

  const noteBits = [
    customerName && customerId !== 'walk-in' ? `Khách: ${customerName}` : undefined,
    draft.notes,
  ].filter(Boolean);

  return createRevenue(
    {
      date: draft.date,
      customerId,
      platformId,
      items,
      discount: 0,
      shippingFee: draft.shippingFee ?? 0,
      shippingPayer: draft.shippingPayer ?? 'customer',
      depositAmount: draft.depositAmount,
      depositedAt: draft.depositAmount
        ? draft.depositedAt ?? draft.date
        : undefined,
      orderStatus: draft.orderStatus ?? 'new',
      deliveryStatus: 'pending',
      paymentMethod: (draft.paymentMethod ?? 'cash') as PaymentMethod,
      paymentStatus: draft.paymentStatus ?? 'unpaid',
      paidAt: draft.paymentStatus === 'paid' ? draft.date : undefined,
      notes: noteBits.join(' · ') || undefined,
    },
    { silent: true },
  );
}

/** Convert Gemini/WebLLM ```action block into a draft (no persist). */
export function actionJsonToDraft(
  action: {
    type: string;
    amount: number;
    description: string;
    category?: string;
    customerName?: string;
  },
  source: 'text' | 'voice' = 'text',
): DraftRecord | null {
  if (action.type === 'create_expense' && action.amount > 0 && action.description) {
    return {
      id: crypto.randomUUID(),
      kind: 'expense',
      date: new Date().toISOString().slice(0, 10),
      amount: action.amount,
      description: action.description,
      category: (action.category as ExpenseCategory) || 'other',
      source,
      confidence: 0.7,
    };
  }
  if (action.type === 'create_revenue' && action.amount > 0 && action.description) {
    return {
      id: crypto.randomUUID(),
      kind: 'revenue',
      date: new Date().toISOString().slice(0, 10),
      amount: action.amount,
      description: action.description,
      customerName: action.customerName,
      source,
      confidence: 0.7,
    };
  }
  return null;
}

export function ensureGeminiConfigured(): void {
  // no-op helper for callers that want to poke gemini readiness
  void geminiService.isConfigured;
}
