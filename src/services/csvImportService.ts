/**
 * CSV / XLS import → DraftRecord[] (local parse, no AI required).
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ExpenseCategory } from '@/models';
import { guessCategory } from './categoryGuess';
import {
  MAX_CSV_ROWS,
  newDraftId,
  todayIso,
  validateDraft,
  type DraftKind,
  type DraftRecord,
} from './draftTypes';

const DATE_HEADERS = ['date', 'ngày', 'ngay', 'ngày tháng', 'invoice_date'];
const AMOUNT_HEADERS = ['amount', 'số tiền', 'so tien', 'tiền', 'tien', 'total', 'giá', 'gia'];
const DESC_HEADERS = ['description', 'mô tả', 'mo ta', 'desc', 'nội dung', 'noi dung', 'name', 'tên', 'ten'];
const CATEGORY_HEADERS = ['category', 'danh mục', 'danh muc', 'hạng mục', 'hang muc'];
const CUSTOMER_HEADERS = ['customer', 'khách', 'khach', 'customername', 'tên khách', 'ten khach'];
const KIND_HEADERS = ['kind', 'type', 'loại', 'loai'];

export const CSV_HEADER_SAMPLE =
  'ngày,số tiền,mô tả,danh mục\n2026-08-01,50000,Tiền điện,utilities';

interface ColumnMap {
  date?: string;
  amount?: string;
  description?: string;
  category?: string;
  customer?: string;
  kind?: string;
}

export async function parseSpreadsheetFile(file: File): Promise<{
  drafts: DraftRecord[];
  guessedKind: DraftKind;
  error?: string;
}> {
  const name = file.name.toLowerCase();
  let rows: Record<string, unknown>[];

  if (name.endsWith('.csv') || file.type === 'text/csv') {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });
    if (parsed.errors.length && !parsed.data.length) {
      return { drafts: [], guessedKind: 'expense', error: 'Không đọc được CSV' };
    }
    rows = parsed.data;
  } else {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]!];
    if (!sheet) {
      return { drafts: [], guessedKind: 'expense', error: 'File Excel không có sheet' };
    }
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  }

  if (rows.length === 0) {
    return {
      drafts: [],
      guessedKind: 'expense',
      error: `Không có dòng dữ liệu. Ví dụ header:\n${CSV_HEADER_SAMPLE}`,
    };
  }
  if (rows.length > MAX_CSV_ROWS) {
    return {
      drafts: [],
      guessedKind: 'expense',
      error: `Tối đa ${MAX_CSV_ROWS} dòng/lần import (file có ${rows.length} dòng)`,
    };
  }

  const headers = Object.keys(rows[0] ?? {}).map((h) => h.trim());
  const map = mapColumns(headers);
  if (!map.amount || !map.description) {
    return {
      drafts: [],
      guessedKind: 'expense',
      error: `Thiếu cột số tiền hoặc mô tả. Header mẫu:\n${CSV_HEADER_SAMPLE}`,
    };
  }

  const guessedKind = guessKind(headers, rows, map);
  const drafts = rows.map((row) => rowToDraft(row, map, guessedKind));
  return { drafts, guessedKind };
}

export function applyKindToDrafts(drafts: DraftRecord[], kind: DraftKind): DraftRecord[] {
  return drafts.map((d) =>
    validateDraft({
      ...d,
      kind,
      category: kind === 'expense' ? (d.category ?? guessCategory(d.description)) : undefined,
      customerName: kind === 'revenue' ? d.customerName : undefined,
    }),
  );
}

function mapColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  for (const h of headers) {
    const key = h.toLowerCase();
    if (!map.date && DATE_HEADERS.some((x) => key.includes(x))) map.date = h;
    else if (!map.amount && AMOUNT_HEADERS.some((x) => key.includes(x))) map.amount = h;
    else if (!map.description && DESC_HEADERS.some((x) => key.includes(x))) map.description = h;
    else if (!map.category && CATEGORY_HEADERS.some((x) => key.includes(x))) map.category = h;
    else if (!map.customer && CUSTOMER_HEADERS.some((x) => key.includes(x))) map.customer = h;
    else if (!map.kind && KIND_HEADERS.some((x) => key === x || key.includes(x))) map.kind = h;
  }
  return map;
}

function guessKind(
  headers: string[],
  rows: Record<string, unknown>[],
  map: ColumnMap,
): DraftKind {
  const joined = headers.join(' ').toLowerCase();
  if (joined.includes('doanh thu') || joined.includes('khách') || joined.includes('customer')) {
    return 'revenue';
  }
  if (map.customer) return 'revenue';
  if (map.kind) {
    const sample = String(rows[0]?.[map.kind] ?? '').toLowerCase();
    if (sample.includes('thu') || sample.includes('revenue')) return 'revenue';
  }
  return 'expense';
}

function rowToDraft(
  row: Record<string, unknown>,
  map: ColumnMap,
  kind: DraftKind,
): DraftRecord {
  const amountRaw = map.amount ? row[map.amount] : '';
  const amount = parseAmountCell(amountRaw);
  const description = String(map.description ? row[map.description] : '').trim() || 'Import';
  const date = normalizeDateCell(map.date ? row[map.date] : undefined) ?? todayIso();
  const categoryRaw = map.category ? String(row[map.category]).trim() : '';
  const customerName = map.customer ? String(row[map.customer]).trim() || undefined : undefined;

  let rowKind = kind;
  if (map.kind) {
    const k = String(row[map.kind]).toLowerCase();
    if (k.includes('thu') || k.includes('revenue')) rowKind = 'revenue';
    if (k.includes('chi') || k.includes('expense')) rowKind = 'expense';
  }

  const draft: DraftRecord = {
    id: newDraftId(),
    kind: rowKind,
    date,
    amount,
    description,
    category: rowKind === 'expense' ? (normalizeCategory(categoryRaw) ?? guessCategory(description)) : undefined,
    customerName: rowKind === 'revenue' ? customerName : undefined,
    source: 'csv',
    confidence: 0.85,
  };
  return validateDraft(draft);
}

function parseAmountCell(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.round(raw);
  const s = String(raw ?? '').replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
  // If Vietnamese thousands 50.000 → after removing dots empty decimal logic:
  const digits = String(raw ?? '').replace(/[^\d]/g, '');
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

function normalizeDateCell(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    // Excel serial date
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed) {
      const mm = String(parsed.m).padStart(2, '0');
      const dd = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${mm}-${dd}`;
    }
  }
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function normalizeCategory(raw: string): ExpenseCategory | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const keys: ExpenseCategory[] = [
    'office', 'rent', 'utilities', 'salary', 'marketing',
    'supplies', 'transportation', 'maintenance', 'tax', 'other',
  ];
  for (const k of keys) {
    if (lower === k) return k;
  }
  return guessCategory(raw);
}
