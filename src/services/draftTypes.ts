/**
 * Shared draft types for multimodal AI intake (preview before persist).
 */

import type { ExpenseCategory } from '@/models';

export type DraftKind = 'expense' | 'revenue';
export type DraftSource = 'text' | 'voice' | 'ocr' | 'csv';

export interface DraftRecord {
  id: string;
  kind: DraftKind;
  date: string;
  amount: number;
  description: string;
  category?: ExpenseCategory;
  customerName?: string;
  source: DraftSource;
  confidence?: number;
  ocrEngine?: 'gemini' | 'tesseract';
  rawFx?: { currency: string; original: number; rate: number };
  errors?: string[];
}

export interface IntakeResult {
  text: string;
  source: 'local' | 'cloud' | 'tesseract';
  drafts?: DraftRecord[];
  attachmentName?: string;
}

export const MAX_INTAKE_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 200;

export const ACCEPTED_INTAKE_MIME = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export function validateDraft(draft: DraftRecord): DraftRecord {
  const errors: string[] = [];
  if (!draft.date || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
    errors.push('Ngày không hợp lệ');
  }
  if (!(draft.amount > 0)) {
    errors.push('Số tiền phải > 0');
  }
  if (!draft.description || draft.description.trim().length < 2) {
    errors.push('Mô tả quá ngắn');
  }
  if (draft.kind === 'expense' && !draft.category) {
    errors.push('Thiếu danh mục');
  }
  return { ...draft, errors: errors.length ? errors : undefined };
}

export function draftsHaveErrors(drafts: DraftRecord[]): boolean {
  return drafts.some((d) => (d.errors?.length ?? 0) > 0);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function newDraftId(): string {
  return crypto.randomUUID();
}
