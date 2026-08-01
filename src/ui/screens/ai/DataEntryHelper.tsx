/**
 * DataEntryHelper — Shows extracted OCR data for user confirmation.
 *
 * Displays extracted fields (date, category, amount, description) in
 * a read-only card with confirm and edit buttons.
 *
 * Props:
 *   data — extracted fields from OCR
 *   onConfirm — callback when user confirms data
 *   onEdit — callback when user wants to edit data
 */

import type { ReactNode } from 'react';
import { Button } from '@components/Button';
import { Badge } from '@components/Badge';
import {
  CheckCircle,
  Pencil,
  Loader2 as _Loader2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ExtractedData {
  date: string;
  category: string;
  amount: string;
  description: string;
}

export interface DataEntryHelperProps {
  data: ExtractedData;
  onConfirm: () => void;
  onEdit: () => void;
  confirmLabel?: ReactNode;
  editLabel?: ReactNode;
  className?: string;
}

// ── Field Row ──────────────────────────────────────────────────────────────────

function FieldRow({
  label,
  value,
  badgeVariant,
}: {
  label: string;
  value: string;
  badgeVariant?: 'success' | 'warning' | 'error' | 'neutral' | 'accent';
}) {
  return (
    <div className="flex items-center justify-between py-[var(--s-xs)]">
      <span className="text-xs text-text-muted">{label}</span>
      {badgeVariant ? (
        <Badge variant={badgeVariant}>{value}</Badge>
      ) : (
        <span className="text-xs font-medium text-text-primary">
          {value}
        </span>
      )}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * DataEntryHelper — Renders extracted OCR data for review.
 *
 * States:
 *   - Default: read-only display with confirm/edit buttons
 *   - Busy (via Button busy prop): loading state on confirm
 */
export function DataEntryHelper({
  data,
  onConfirm,
  onEdit,
  confirmLabel = (
    <>
      <CheckCircle size={14} aria-hidden="true" /> Xác nhận
    </>
  ),
  editLabel = (
    <>
      <Pencil size={14} aria-hidden="true" /> Chỉnh sửa
    </>
  ),
  className,
}: DataEntryHelperProps) {
  return (
    <div
      className={[
        'bg-surface border border-border rounded-panel',
        'p-[var(--s-md)]',
        className ?? '',
      ].join(' ')}
      role="region"
      aria-label="Dữ liệu trích xuất từ OCR"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-[var(--s-sm)]">
        <div className="flex items-center gap-[var(--s-xs)]">
          <span className="text-sm">📄</span>
          <h4 className="text-xs font-semibold text-text-secondary">
            Dữ liệu trích xuất
          </h4>
        </div>
        <Badge variant="accent">OCR</Badge>
      </div>

      {/* Fields */}
      <div className="space-y-[var(--s-xs)]">
        <FieldRow label="Ngày" value={data.date} />
        <FieldRow
          label="Hạng mục"
          value={data.category}
          badgeVariant="accent"
        />
        <FieldRow
          label="Số tiền"
          value={data.amount}
          badgeVariant="success"
        />
        <FieldRow label="Mô tả" value={data.description} />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-[var(--s-xs)] mt-[var(--s-md)]">
        <Button onClick={onConfirm}>{confirmLabel}</Button>
        <Button variant="neutral" onClick={onEdit}>
          {editLabel}
        </Button>
      </div>
    </div>
  );
}
