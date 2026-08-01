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
  parseTextToDraft,
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
import { EXPENSE_CATEGORY_LABELS } from '@/models';
import { formatCurrency } from '@/utils/currency';

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
  const draft = parseTextToDraft(message, source);
  if (!draft) return null;

  const kindLabel = draft.kind === 'expense' ? 'chi phí' : 'doanh thu';
  const fxNote = draft.rawFx
    ? ` (${draft.rawFx.original} ${draft.rawFx.currency} × ${draft.rawFx.rate.toLocaleString('vi-VN')})`
    : '';

  return {
    text: `Đã nhận diện ${kindLabel}: **${draft.description}** — ${draft.amount.toLocaleString('vi-VN')}₫${fxNote}`,
    source: 'local',
    drafts: [draft],
  };
}

export function buildFinanceContext(): string {
  const expenses = useExpenseStore.getState().records;
  const revenues = useRevenueStore.getState().records;
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
  const totalRevenue = revenues.reduce((s, r) => s + r.finalAmount, 0);
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
  ).length;

  return `DỮ LIỆU THỰC TẾ (dùng để phân tích/tra cứu):
Tổng chi: ${formatCurrency(totalExpense)} (${expenses.length} khoản)
Tổng thu: ${formatCurrency(totalRevenue)} (${revenues.length} đơn)
Lợi nhuận: ${formatCurrency(totalRevenue - totalExpense)}
Đơn đang xử lý: ${pendingOrders}
Chi tiết chi theo danh mục:
${categorySummary || '  (chưa có)'}`;
}

export function shouldAttachFinanceContext(message: string): boolean {
  return looksLikeAnalysisIntent(message);
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
        const record = await createExpense({
          date: draft.date,
          category: (draft.category ?? 'other') as ExpenseCategory,
          amount: draft.amount,
          description: draft.description,
          status: 'pending' as ExpenseStatus,
          paymentMethod: 'cash' as PaymentMethod,
          tags: [],
        });
        created.push({
          kind: 'expense',
          id: record.id,
          description: record.description,
          amount: record.amount,
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

  return { ok, failed, created };
}

async function persistRevenueDraft(draft: DraftRecord) {
  let customerId = 'walk-in';
  if (draft.customerName) {
    const { useCustomerStore } = await import('@/store/customerStore');
    const { generateId } = await import('@/utils/id');
    const customers = useCustomerStore.getState().customers;
    const existing = customers.find(
      (c) => c.name.toLowerCase() === draft.customerName!.toLowerCase(),
    );
    if (existing) {
      customerId = existing.id;
    } else {
      customerId = generateId();
      useCustomerStore.getState().addCustomer({
        id: customerId,
        name: draft.customerName,
        phone: '',
        email: '',
        address: '',
        createdAt: new Date().toISOString(),
      });
    }
  }

  const { createRevenue } = await import('./revenueService');
  const { generateId } = await import('@/utils/id');
  const itemId = generateId();
  return createRevenue({
    date: draft.date,
    customerId,
    items: [
      {
        id: itemId,
        name: draft.description || 'Sản phẩm',
        quantity: 1,
        unitPrice: draft.amount,
        total: draft.amount,
      },
    ],
    discount: 0,
    orderStatus: 'new',
    deliveryStatus: 'pending',
    paymentMethod: 'cash' as PaymentMethod,
    notes: draft.customerName ? `Khách: ${draft.customerName}` : undefined,
  });
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
