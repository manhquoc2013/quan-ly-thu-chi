/**
 * Data Standardizer — AI & Heuristic Data Cleaning & Normalization Engine.
 *
 * Scans, detects and normalizes non-standard Vietnamese data:
 * - Expenses: typos, diacritics, title casing, appropriate category re-classification.
 * - Customers: Proper Vietnamese Title Case names, standardized 0xxxxxxxxx phone, structured address.
 * - Products: Consistent unit normalization (cái, chiếc, hộp, kg...), capitalization.
 * - Revenues / Orders: Customer names, phone formatting, item unit unification.
 *
 * Powered by hybrid cascade: LLM (Kilo / Groq / Gemini / OpenRouter / SiliconFlow / Local WebLLM)
 * with robust offline heuristic fallback.
 */

import { getAllExpenses, updateExpense } from './expenseService';
import { getAllCustomers, updateCustomer } from './customerService';
import { getAllProducts, updateProduct } from './productService';
import { getAllRevenues, updateRevenue } from './revenueService';
import { callLlmCascade } from './llmCall';
import type { Expense, Customer, Product, Revenue, ExpenseCategory } from '@/models';
import { EXPENSE_CATEGORY_LABELS } from '@/models';

export type StandardizableEntity = Expense | Customer | Product | Revenue;
export type StandardizeEntityType = 'expense' | 'customer' | 'product' | 'revenue';

export interface FieldDiff {
  field: string;
  fieldLabel: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
}

export interface StandardizationCandidate {
  id: string;
  entityType: StandardizeEntityType;
  title: string;
  issues: string[];
  original: StandardizableEntity;
  suggested?: Record<string, unknown>;
  changes?: FieldDiff[];
  selected?: boolean;
  status: 'pending' | 'ready' | 'applied' | 'skipped' | 'error';
  errorMessage?: string;
  source?: string;
}

export interface StandardizationScanSummary {
  totalScanned: number;
  totalIssues: number;
  byType: Record<StandardizeEntityType, number>;
  candidates: StandardizationCandidate[];
}

/* ═══════════════════════════════════════════════════════════════
   Standard Vietnamese Dictionaries & Heuristic Helpers
   ═══════════════════════════════════════════════════════════════ */

export const STANDARD_UNITS: Record<string, string> = {
  cai: 'cái',
  'cái': 'cái',
  chiec: 'chiếc',
  'chiếc': 'chiếc',
  ch: 'chiếc',
  hop: 'hộp',
  'hộp': 'hộp',
  bo: 'bộ',
  'bộ': 'bộ',
  kg: 'kg',
  ky: 'kg',
  'ký': 'kg',
  kilo: 'kg',
  kilogram: 'kg',
  g: 'g',
  gam: 'g',
  gram: 'g',
  chai: 'chai',
  lon: 'lon',
  goi: 'gói',
  'gói': 'gói',
  bich: 'bịch',
  'bịch': 'bịch',
  thung: 'thùng',
  'thùng': 'thùng',
  con: 'con',
  ly: 'ly',
  bat: 'bát',
  'bát': 'bát',
  doi: 'đôi',
  'đôi': 'đôi',
  cuon: 'cuộn',
  'cuộn': 'cuộn',
  tam: 'tấm',
  'tấm': 'tấm',
  met: 'mét',
  'mét': 'mét',
  m: 'mét',
};

const CATEGORY_KEYWORDS: Record<ExpenseCategory, RegExp[]> = {
  office: [
    /v[ăa]n\s*ph[òo]ng/i,
    /gi[ấa]y\s*in/i,
    /b[úu]t/i,
    /m[ựu]c\s*in/i,
    /s[ổo]\s*s[áa]ch/i,
  ],
  rent: [
    /m[ặa]t\s*b[ằa]ng/i,
    /ti[ềe]n\s*nh[àa]/i,
    /thu[êe]\s*nh[àa]/i,
    /thu[êe]\s*m[ặa]t\s*b[ằa]ng/i,
    /thu[êe]\s*kho/i,
  ],
  utilities: [
    /ti[ềe]n\s*đi[ệe]n/i,
    /ti[ềe]n\s*n[ưd][ớo]c/i,
    /wifi/i,
    /internet/i,
    /m[ạa]ng/i,
    /r[áa]c/i,
    /vi[ễe]n\s*th[ôo]ng/i,
  ],
  salary: [
    /l[ưd][ơo]ng/i,
    /th[ưd][ởo]ng/i,
    /nh[âa]n\s*vi[êe]n/i,
    /tr[ợo]\s*c[ấa]p/i,
    /t[ạa]m\s*[ứu]ng/i,
  ],
  marketing: [
    /qu[ảa]ng\s*c[áa]o/i,
    /ads/i,
    /facebook\s*ads/i,
    /tiktok\s*ads/i,
    /google\s*ads/i,
    /in\s*ấn/i,
    /t[ờo]\s*r[ơo]i/i,
    /banner/i,
  ],
  supplies: [
    /c[àa]\s*ph[êe]/i,
    /cafe/i,
    /[ăa]n\s*(tr[ưua]|s[aá]ng|t[ốo]i|u[ốo]ng|v[ặa]t)/i,
    /ti[ệe]c/i,
    /tr[àa]\s*s[ữư]a/i,
    /c[ơo]m/i,
    /b[áa]nh/i,
    /nh[àa]\s*h[àa]ng/i,
    /qu[áa]n\s*[ăa]n/i,
    /nh[ậa]p\s*h[àa]ng/i,
    /mua\s*h[àa]ng/i,
    /nguy[êe]n\s*li[ệe]u/i,
    /v[ậa]t\s*t[ưd]/i,
    /l[ôo]\s*h[àa]ng/i,
    /nh[àa]\s*cung\s*c[ấa]p/i,
  ],
  transportation: [
    /x[ăa]ng/i,
    /xe\s*m[áa]y/i,
    /giao\s*h[àa]ng/i,
    /ship/i,
    /grab/i,
    /be\s*bike/i,
    /grap/i,
    /taxi/i,
    /v[ée]\s*xe/i,
    /b[ảa]o\s*d[ưd][ỡo]ng\s*xe/i,
    /r[ửu]a\s*xe/i,
  ],
  maintenance: [
    /b[ảa]o\s*tr[ìi]/i,
    /s[ửu]a\s*ch[ữư]a/i,
    /thay\s*m[ớo]i/i,
    /h[ỏo]ng/i,
  ],
  tax: [
    /thu[ếe]/i,
    /m[ôo]n\s*b[àa]i/i,
    /l[ệe]\s*ph[íi]/i,
  ],
  other: [],
};

export function normalizeVietnameseTitleCase(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export function normalizeVietnameseSentenceCase(str: string): string {
  if (!str) return '';
  const trimmed = str.trim().replace(/\s+/g, ' ');
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function normalizePhoneNumber(raw: string): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length >= 11) {
    digits = '0' + digits.slice(2);
  }
  if (!digits.startsWith('0') && digits.length === 9) {
    digits = '0' + digits;
  }
  return digits;
}

export function normalizeAddressHeuristic(raw: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bp\b\.?\s*(\d+)/gi, 'Phường $1')
    .replace(/\bq\b\.?\s*(\d+)/gi, 'Quận $1')
    .replace(/\btphcm\b|\btp\s*hcm\b|\bhcm\b/gi, 'TP. Hồ Chí Minh')
    .replace(/\bhn\b|\btp\s*hn\b/gi, 'Hà Nội')
    .replace(/\bđn\b|\bđà\s*nẵng\b/gi, 'Đà Nẵng');
}

/* ═══════════════════════════════════════════════════════════════
   1. Fast Scanner & Detection Engine
   ═══════════════════════════════════════════════════════════════ */

export async function scanForStandardization(
  targetKind: 'all' | StandardizeEntityType = 'all',
): Promise<StandardizationScanSummary> {
  const candidates: StandardizationCandidate[] = [];
  const byType: Record<StandardizeEntityType, number> = {
    expense: 0,
    customer: 0,
    product: 0,
    revenue: 0,
  };

  let totalScanned = 0;

  // 1. Scan Expenses
  if (targetKind === 'all' || targetKind === 'expense') {
    const expenses = await getAllExpenses();
    totalScanned += expenses.length;

    for (const exp of expenses) {
      const issues: string[] = [];
      const desc = exp.description || '';

      // Check casing & diacritics
      if (desc === desc.toLowerCase() && /[a-z]/.test(desc)) {
        issues.push('Mô tả viết hoàn toàn chữ thường');
      }

      // Check category mismatch if category is 'other' but keywords indicate specific category
      if (exp.category === 'other') {
        for (const [cat, patterns] of Object.entries(CATEGORY_KEYWORDS) as [ExpenseCategory, RegExp[]][]) {
          if (cat === 'other') continue;
          if (patterns.some((re) => re.test(desc))) {
            issues.push(`Có thể phân loại vào "${EXPENSE_CATEGORY_LABELS[cat]}" thay vì "Khác"`);
            break;
          }
        }
      }

      if (issues.length > 0) {
        byType.expense++;
        candidates.push({
          id: exp.id,
          entityType: 'expense',
          title: `Chi phí: ${exp.description}`,
          issues,
          original: exp,
          status: 'pending',
          selected: true,
        });
      }
    }
  }

  // 2. Scan Customers
  if (targetKind === 'all' || targetKind === 'customer') {
    const customers = await getAllCustomers();
    totalScanned += customers.length;

    for (const cust of customers) {
      const issues: string[] = [];
      const name = cust.name || '';
      const phone = cust.phone || '';
      const address = cust.address || '';

      // Check name casing
      if (name === name.toLowerCase() && /[a-z]/.test(name)) {
        issues.push('Họ tên chưa viết hoa danh từ riêng');
      } else if (name === name.toUpperCase() && name.length > 4) {
        issues.push('Họ tên viết hoa toàn bộ (ALL CAPS)');
      }

      // Check phone format
      if (phone) {
        const cleanPhone = normalizePhoneNumber(phone);
        if (cleanPhone !== phone || !/^0\d{9}$/.test(cleanPhone)) {
          issues.push('Số điện thoại chưa chuẩn định dạng 10 số (0xxxxxxxxx)');
        }
      }

      // Check address abbreviations
      if (address && /\b(p|q|hcm|tphcm)\b/i.test(address)) {
        issues.push('Địa chỉ chứa từ viết tắt (p, q, hcm)');
      }

      if (issues.length > 0) {
        byType.customer++;
        candidates.push({
          id: cust.id,
          entityType: 'customer',
          title: `Khách hàng: ${cust.name || 'Chưa đặt tên'}`,
          issues,
          original: cust,
          status: 'pending',
          selected: true,
        });
      }
    }
  }

  // 3. Scan Products
  if (targetKind === 'all' || targetKind === 'product') {
    const products = await getAllProducts();
    totalScanned += products.length;

    for (const prod of products) {
      const issues: string[] = [];
      const name = prod.name || '';
      const unit = (prod.unit || '').trim();

      // Check product name
      if (name === name.toLowerCase() && /[a-z]/.test(name)) {
        issues.push('Tên sản phẩm chưa viết hoa chuẩn');
      }

      // Check unit consistency
      const lowerUnit = unit.toLowerCase();
      if (STANDARD_UNITS[lowerUnit] && STANDARD_UNITS[lowerUnit] !== unit) {
        issues.push(`Đơn vị tính "${unit}" chưa đồng bộ chuẩn "${STANDARD_UNITS[lowerUnit]}"`);
      } else if (unit && !STANDARD_UNITS[lowerUnit] && !/^(cái|chiếc|hộp|bộ|kg|g|chai|lon|gói|bịch|con|ly)$/.test(unit)) {
        issues.push(`Đơn vị tính "${unit}" lạ hoặc chưa chuẩn hoá`);
      }

      if (issues.length > 0) {
        byType.product++;
        candidates.push({
          id: prod.id,
          entityType: 'product',
          title: `Sản phẩm: ${prod.name}`,
          issues,
          original: prod,
          status: 'pending',
          selected: true,
        });
      }
    }
  }

  // 4. Scan Revenues
  if (targetKind === 'all' || targetKind === 'revenue') {
    const revenues = await getAllRevenues();
    totalScanned += revenues.length;

    for (const rev of revenues) {
      const issues: string[] = [];
      const notes = rev.notes || '';

      if (notes && notes === notes.toLowerCase() && /[a-z]/.test(notes)) {
        issues.push('Ghi chú đơn hàng chưa viết hoa chuẩn');
      }

      if (rev.items && rev.items.some((it) => it.name && it.name === it.name.toLowerCase() && /[a-z]/.test(it.name))) {
        issues.push('Tên mặt hàng trong đơn chưa viết hoa');
      }

      if (issues.length > 0) {
        byType.revenue++;
        candidates.push({
          id: rev.id,
          entityType: 'revenue',
          title: `Đơn hàng: ${rev.orderCode}`,
          issues,
          original: rev,
          status: 'pending',
          selected: true,
        });
      }
    }
  }

  return {
    totalScanned,
    totalIssues: candidates.length,
    byType,
    candidates,
  };
}

/* ═══════════════════════════════════════════════════════════════
   2. Heuristic Local Normalizer (Offline Fallback)
   ═══════════════════════════════════════════════════════════════ */

export function heuristicStandardize(candidate: StandardizationCandidate): {
  suggested: Record<string, unknown>;
  changes: FieldDiff[];
} {
  const changes: FieldDiff[] = [];
  const suggested: Record<string, unknown> = { ...candidate.original };

  switch (candidate.entityType) {
    case 'expense': {
      const orig = candidate.original as Expense;
      let newDesc = orig.description || '';
      if (newDesc === newDesc.toLowerCase()) {
        newDesc = normalizeVietnameseSentenceCase(newDesc);
      }
      if (newDesc !== orig.description) {
        changes.push({
          field: 'description',
          fieldLabel: 'Mô tả chi phí',
          oldValue: orig.description,
          newValue: newDesc,
          reason: 'Viết hoa chuẩn tiếng Việt',
        });
        suggested.description = newDesc;
      }

      if (orig.category === 'other') {
        for (const [cat, patterns] of Object.entries(CATEGORY_KEYWORDS) as [ExpenseCategory, RegExp[]][]) {
          if (cat === 'other') continue;
          if (patterns.some((re) => re.test(orig.description))) {
            changes.push({
              field: 'category',
              fieldLabel: 'Danh mục',
              oldValue: 'other',
              newValue: cat,
              reason: `Phân loại phù hợp: ${EXPENSE_CATEGORY_LABELS[cat]}`,
            });
            suggested.category = cat;
            break;
          }
        }
      }
      break;
    }

    case 'customer': {
      const orig = candidate.original as Customer;
      if (orig.name) {
        const newName = normalizeVietnameseTitleCase(orig.name);
        if (newName !== orig.name) {
          changes.push({
            field: 'name',
            fieldLabel: 'Họ tên',
            oldValue: orig.name,
            newValue: newName,
            reason: 'Viết hoa danh từ riêng chuẩn tiếng Việt',
          });
          suggested.name = newName;
        }
      }

      if (orig.phone) {
        const cleanPhone = normalizePhoneNumber(orig.phone);
        if (cleanPhone !== orig.phone && cleanPhone.length === 10) {
          changes.push({
            field: 'phone',
            fieldLabel: 'Số điện thoại',
            oldValue: orig.phone,
            newValue: cleanPhone,
            reason: 'Định dạng 10 chữ số chuẩn (0xxxxxxxxx)',
          });
          suggested.phone = cleanPhone;
        }
      }

      if (orig.address) {
        const cleanAddress = normalizeAddressHeuristic(orig.address);
        if (cleanAddress !== orig.address) {
          changes.push({
            field: 'address',
            fieldLabel: 'Địa chỉ',
            oldValue: orig.address,
            newValue: cleanAddress,
            reason: 'Chuẩn hoá từ viết tắt hành chính',
          });
          suggested.address = cleanAddress;
        }
      }
      break;
    }

    case 'product': {
      const orig = candidate.original as Product;
      if (orig.name) {
        const newName = normalizeVietnameseTitleCase(orig.name);
        if (newName !== orig.name) {
          changes.push({
            field: 'name',
            fieldLabel: 'Tên sản phẩm',
            oldValue: orig.name,
            newValue: newName,
            reason: 'Viết hoa chuẩn tên sản phẩm',
          });
          suggested.name = newName;
        }
      }

      if (orig.unit) {
        const lower = orig.unit.trim().toLowerCase();
        const stdUnit = STANDARD_UNITS[lower] || lower;
        if (stdUnit !== orig.unit) {
          changes.push({
            field: 'unit',
            fieldLabel: 'Đơn vị tính',
            oldValue: orig.unit,
            newValue: stdUnit,
            reason: 'Chuẩn hoá danh mục đơn vị đồng bộ',
          });
          suggested.unit = stdUnit;
        }
      }
      break;
    }

    case 'revenue': {
      const orig = candidate.original as Revenue;
      if (orig.notes && orig.notes === orig.notes.toLowerCase()) {
        const newNotes = normalizeVietnameseSentenceCase(orig.notes);
        if (newNotes !== orig.notes) {
          changes.push({
            field: 'notes',
            fieldLabel: 'Ghi chú đơn',
            oldValue: orig.notes,
            newValue: newNotes,
            reason: 'Viết hoa chuẩn câu tiếng Việt',
          });
          suggested.notes = newNotes;
        }
      }

      if (orig.items && Array.isArray(orig.items)) {
        let hasItemChanges = false;
        const newItems = orig.items.map((it) => {
          if (it.name && it.name === it.name.toLowerCase() && /[a-z]/.test(it.name)) {
            hasItemChanges = true;
            return { ...it, name: normalizeVietnameseTitleCase(it.name) };
          }
          return it;
        });

        if (hasItemChanges) {
          changes.push({
            field: 'items',
            fieldLabel: 'Mặt hàng trong đơn',
            oldValue: `${orig.items.length} mặt hàng`,
            newValue: `${newItems.length} mặt hàng (đã chuẩn hoá tên)`,
            reason: 'Viết hoa chuẩn tên mặt hàng',
          });
          suggested.items = newItems;
        }
      }
      break;
    }
  }

  return { suggested, changes };
}

/* ═══════════════════════════════════════════════════════════════
   3. AI LLM Normalizer (Cascade: Kilo -> Groq -> Gemini -> Local)
   ═══════════════════════════════════════════════════════════════ */

export async function standardizeCandidatesWithAI(
  candidates: StandardizationCandidate[],
  onProgress?: (completed: number, total: number) => void,
): Promise<StandardizationCandidate[]> {
  if (candidates.length === 0) return [];

  const results: StandardizationCandidate[] = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);

    const compactBatch = batch.map((c) => ({
      id: c.id,
      entityType: c.entityType,
      issues: c.issues,
      currentData: {
        description: (c.original as Expense).description,
        category: (c.original as Expense).category,
        name: (c.original as Customer).name,
        phone: (c.original as Customer).phone,
        address: (c.original as Customer).address,
        unit: (c.original as Product).unit,
        notes: (c.original as Revenue).notes,
      },
    }));

    const prompt = `Bạn là trợ lý AI chuyên chuẩn hoá dữ liệu tiếng Việt cho phần mềm Quản lý thu chi.
Nhiệm vụ: Sửa lỗi chính tả, thêm dấu tiếng Việt đầy đủ, viết hoa chuẩn xác danh từ riêng, chuẩn hoá SĐT 10 số (0xxxxxxxxx), và chọn danh mục chi phí thích hợp.

Quy tắc:
1. Chi phí (expense): Viết hoa chữ cái đầu mô tả, thêm dấu tiếng Việt chuẩn xác. Nếu category là 'other', hãy phân loại lại vào đúng: office, rent, utilities, salary, marketing, supplies, transportation, maintenance, tax, other.
2. Khách hàng (customer): Viết hoa Họ tên chuẩn tiếng Việt. SĐT chuẩn hoá 10 số bắt đầu bằng 0. Địa chỉ viết hoa đường, phường, quận, tỉnh thành.
3. Sản phẩm (product): Viết hoa tên sản phẩm, đơn vị tính chuẩn hoá về từ thường (cái, chiếc, hộp, bộ, kg, g, chai, lon, gói...).
4. Doanh thu (revenue): Chuẩn hoá tên mặt hàng, ghi chú đơn.

Dữ liệu đầu vào:
${JSON.stringify(compactBatch, null, 2)}

Yêu cầu trả về DUY NHẤT một mảng JSON (không có markdown khác ngoài JSON) với cấu trúc:
[
  {
    "id": "ID_ban_ghi",
    "changes": [
      {
        "field": "tên_trường",
        "fieldLabel": "Tên tiếng Việt của trường",
        "oldValue": "giá trị cũ",
        "newValue": "giá trị mới chuẩn hoá",
        "reason": "Lý do chuẩn hoá"
      }
    ],
    "suggested": {
      "tên_trường": "giá trị mới"
    }
  }
]`;

    let batchSuccess = false;

    try {
      const llmRes = await callLlmCascade(prompt, 'raw', 'extract');
      if (llmRes?.text) {
        // Parse json array
        const jsonMatch = llmRes.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;
          for (const item of batch) {
            const found = parsed.find((p) => p.id === item.id);
            if (found && Array.isArray(found.changes) && found.changes.length > 0) {
              results.push({
                ...item,
                suggested: { ...item.original, ...((found.suggested as Record<string, unknown>) || {}) },
                changes: found.changes as FieldDiff[],
                status: 'ready',
                source: llmRes.source,
              });
            } else {
              // Heuristic fallback for this item if LLM omitted it
              const heur = heuristicStandardize(item);
              results.push({
                ...item,
                suggested: heur.suggested,
                changes: heur.changes,
                status: heur.changes.length > 0 ? 'ready' : 'skipped',
                source: 'heuristic',
              });
            }
          }
          batchSuccess = true;
        }
      }
    } catch (err) {
      console.warn('[dataStandardizer] AI call failed, falling back to heuristics:', err);
    }

    if (!batchSuccess) {
      // Offline / Heuristic fallback for whole batch
      for (const item of batch) {
        const heur = heuristicStandardize(item);
        results.push({
          ...item,
          suggested: heur.suggested,
          changes: heur.changes,
          status: heur.changes.length > 0 ? 'ready' : 'skipped',
          source: 'heuristic',
        });
      }
    }

    if (onProgress) {
      onProgress(Math.min(i + BATCH_SIZE, candidates.length), candidates.length);
    }
  }

  return results;
}

/* ═══════════════════════════════════════════════════════════════
   4. Apply Standardized Changes
   ═══════════════════════════════════════════════════════════════ */

export async function applyCandidateChanges(
  candidate: StandardizationCandidate,
): Promise<boolean> {
  if (!candidate.suggested || candidate.status !== 'ready') return false;

  try {
    switch (candidate.entityType) {
      case 'expense':
        await updateExpense(candidate.id, candidate.suggested as Partial<Expense>, { silent: true });
        break;
      case 'customer':
        await updateCustomer(candidate.id, candidate.suggested as Partial<Customer>, { silent: true });
        break;
      case 'product':
        await updateProduct(candidate.id, candidate.suggested as Partial<Product>, { silent: true });
        break;
      case 'revenue':
        await updateRevenue(candidate.id, candidate.suggested as Partial<Revenue>, { silent: true });
        break;
    }
    candidate.status = 'applied';
    return true;
  } catch (err) {
    console.error(`[dataStandardizer] Failed to update ${candidate.entityType} #${candidate.id}:`, err);
    candidate.status = 'error';
    candidate.errorMessage = err instanceof Error ? err.message : String(err);
    return false;
  }
}

export async function applyMultipleCandidates(
  candidates: StandardizationCandidate[],
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const item of candidates) {
    if (!item.selected || item.status !== 'ready') continue;
    const ok = await applyCandidateChanges(item);
    if (ok) success++;
    else failed++;
  }

  return { success, failed };
}
