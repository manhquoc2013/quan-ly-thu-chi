/**
 * DataEntryHelper — Preview extracted drafts before persist.
 * Supports single card and multi-row CSV table with kind toggle.
 */

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Pencil, Trash2, X } from 'lucide-react';
import { EXPENSE_CATEGORY_LABELS } from '@/models';
import { formatCurrency } from '@/utils/currency';
import {
  draftsHaveErrors,
  type DraftKind,
  type DraftRecord,
} from '@/services/draftTypes';

export interface ExtractedData {
  date: string;
  category: string;
  amount: string;
  description: string;
}

export interface DataEntryHelperProps {
  drafts: DraftRecord[];
  onConfirm: (drafts: DraftRecord[]) => void;
  onEdit?: (draft: DraftRecord) => void;
  onCancel: () => void;
  onChangeKind?: (kind: DraftKind) => void;
  onRemoveRow?: (id: string) => void;
  confirmLabel?: ReactNode;
  editLabel?: ReactNode;
  className?: string;
  busy?: boolean;
}

function FieldRow({
  label,
  value,
  badgeVariant,
}: {
  label: string;
  value: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}) {
  return (
    <div className="flex items-center justify-between py-[var(--s-xs)]">
      <span className="text-xs text-text-muted">{label}</span>
      {badgeVariant ? (
        <Badge variant={badgeVariant}>{value}</Badge>
      ) : (
        <span className="text-xs font-medium text-text-primary">{value}</span>
      )}
    </div>
  );
}

export function DataEntryHelper({
  drafts,
  onConfirm,
  onEdit,
  onCancel,
  onChangeKind,
  onRemoveRow,
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
  busy,
}: DataEntryHelperProps) {
  if (drafts.length === 0) return null;

  const blocked = draftsHaveErrors(drafts) || busy;
  const multi = drafts.length > 1;
  const kind = drafts[0]?.kind ?? 'expense';
  const ocrEngine = drafts[0]?.ocrEngine;

  return (
    <div
      className={[
        'bg-surface border border-border rounded-panel',
        'p-[var(--s-md)]',
        className ?? '',
      ].join(' ')}
      role="region"
      aria-label="Dữ liệu chờ xác nhận"
    >
      <div className="flex items-center justify-between mb-[var(--s-sm)] gap-2">
        <div className="flex items-center gap-[var(--s-xs)]">
          <span className="text-sm">📄</span>
          <h4 className="text-xs font-semibold text-text-secondary">
            {multi ? `${drafts.length} dòng chờ xác nhận` : 'Dữ liệu trích xuất'}
          </h4>
        </div>
        <div className="flex items-center gap-1">
          {ocrEngine && (
            <Badge variant="outline">
              {ocrEngine === 'gemini' ? 'Gemini OCR' : 'Tesseract'}
            </Badge>
          )}
          <Badge variant="default">{kind === 'expense' ? 'Chi phí' : 'Doanh thu'}</Badge>
        </div>
      </div>

      {onChangeKind && (
        <div className="flex gap-1 mb-[var(--s-sm)]">
          <button
            type="button"
            onClick={() => onChangeKind('expense')}
            className={[
              'text-[11px] px-2 py-1 rounded-field border',
              kind === 'expense'
                ? 'bg-accent-fg text-white border-accent-fg'
                : 'border-border text-text-muted',
            ].join(' ')}
          >
            Chi phí
          </button>
          <button
            type="button"
            onClick={() => onChangeKind('revenue')}
            className={[
              'text-[11px] px-2 py-1 rounded-field border',
              kind === 'revenue'
                ? 'bg-accent-fg text-white border-accent-fg'
                : 'border-border text-text-muted',
            ].join(' ')}
          >
            Doanh thu
          </button>
        </div>
      )}

      {!multi && (() => {
        const d = drafts[0]!;
        return (
          <div className="space-y-[var(--s-xs)]">
            <FieldRow label="Ngày" value={d.date} />
            {d.kind === 'expense' ? (
              <FieldRow
                label="Hạng mục"
                value={
                  d.category
                    ? EXPENSE_CATEGORY_LABELS[d.category] ?? d.category
                    : '—'
                }
                badgeVariant="default"
              />
            ) : (
              <FieldRow label="Khách" value={d.customerName || 'Walk-in'} />
            )}
            <FieldRow
              label="Số tiền"
              value={formatCurrency(d.amount)}
              badgeVariant="default"
            />
            <FieldRow label="Mô tả" value={d.description} />
            {d.rawFx && (
              <FieldRow
                label="FX"
                value={`${d.rawFx.original} ${d.rawFx.currency} × ${d.rawFx.rate.toLocaleString('vi-VN')}`}
              />
            )}
            {d.errors?.length ? (
              <p className="text-[11px] text-danger-fg">{d.errors.join(' · ')}</p>
            ) : null}
          </div>
        );
      })()}

      {multi && (
        <div className="max-h-48 overflow-auto border border-border-subtle rounded-field">
          <table className="min-w-full text-[11px]">
            <thead className="bg-surface-hover sticky top-0">
              <tr>
                <th className="text-left p-1.5 font-medium">Ngày</th>
                <th className="text-left p-1.5 font-medium">Mô tả</th>
                <th className="text-right p-1.5 font-medium">Tiền</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => (
                <tr
                  key={d.id}
                  className={d.errors?.length ? 'bg-danger-bg/40' : 'border-t border-border-subtle'}
                >
                  <td className="p-1.5 align-top">{d.date}</td>
                  <td className="p-1.5 align-top">
                    {d.description}
                    {d.errors?.length ? (
                      <div className="text-danger-fg">{d.errors.join(', ')}</div>
                    ) : null}
                  </td>
                  <td className="p-1.5 text-right align-top whitespace-nowrap">
                    {formatCurrency(d.amount)}
                  </td>
                  <td className="p-1 align-top">
                    {onRemoveRow && (
                      <button
                        type="button"
                        onClick={() => onRemoveRow(d.id)}
                        className="text-text-muted hover:text-danger-fg"
                        aria-label="Xóa dòng"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-[var(--s-xs)] mt-[var(--s-md)] flex-wrap">
        <Button disabled={!!blocked} onClick={() => onConfirm(drafts)}>
          {confirmLabel}
        </Button>
        {!multi && onEdit && (
          <Button variant="outline" onClick={() => onEdit(drafts[0]!)}>
            {editLabel}
          </Button>
        )}
        <Button variant="ghost" onClick={onCancel} aria-label="Hủy">
          <X size={14} /> Hủy
        </Button>
      </div>
    </div>
  );
}
