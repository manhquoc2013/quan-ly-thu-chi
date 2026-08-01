/**
 * OrderRowCard — Expandable order row with items list, totals, payment method,
 * quick status change buttons.
 *
 * Used inside RevenueGrid expanded rows.
 *
 * Uses @models (ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS),
 * @store (useRevenueStore), @utils (formatCurrency), @ui/components.
 */

import type { Revenue, OrderStatus } from '@/models';
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/models';
import { formatCurrency } from '@/utils/currency';
import { Badge } from '@ui/components/Badge';
import { Button } from '@ui/components/Button';
import { useRevenueStore } from '@/store/revenueStore';

/* ─── Props ─── */

export interface OrderRowCardProps {
  row: Revenue;
  /** Called when a quick-status button is clicked */
  onStatusChange?: (id: string, status: OrderStatus) => void;
}

/* ─── Quick status options ─── */

const QUICK_STATUS_OPTIONS: Array<{ status: OrderStatus; label: string }> = [
  { status: 'confirmed', label: 'Xác nhận' },
  { status: 'processing', label: 'Xử lý' },
  { status: 'completed', label: 'Hoàn thành' },
  { status: 'cancelled', label: 'Hủy' },
];

/* ─── Component ─── */

export function OrderRowCard({ row, onStatusChange }: OrderRowCardProps) {
  const updateRecord = useRevenueStore((s) => s.updateRecord);

  const handleQuickStatus = (status: OrderStatus) => {
    updateRecord(row.id, { orderStatus: status });
    onStatusChange?.(row.id, status);
  };

  return (
    <div
      className="ml-[var(--s-xl)] p-[var(--s-md)] rounded-panel border border-border-subtle bg-surface"
      role="row"
      aria-label={`Chi tiết đơn ${row.orderCode}`}
    >
      {/* Summary line */}
      <div className="flex items-center gap-[var(--s-md)] mb-[var(--s-md)] pb-[var(--s-sm)] border-b border-border-subtle">
        <span className="text-xs font-mono font-semibold text-text-primary">
          {row.orderCode}
        </span>
        <span className="text-xs text-text-muted">{row.date}</span>
        <span className="text-xs text-text-primary font-medium">{row.customerId}</span>
        <span className="ml-auto text-sm font-bold text-text-primary">
          {formatCurrency(row.finalAmount)}
        </span>
        <Badge variant="neutral" size="sm">
          {ORDER_STATUS_LABELS[row.orderStatus]}
        </Badge>
      </div>

      {/* Items table */}
      <div className="mb-[var(--s-md)]">
        <h4 className="text-xs font-semibold text-text-secondary mb-2">
          Sản phẩm / Dịch vụ
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left py-1 px-2 font-medium text-text-muted">Tên</th>
                <th className="text-right py-1 px-2 font-medium text-text-muted w-[60px]">SL</th>
                <th className="text-right py-1 px-2 font-medium text-text-muted w-[120px]">Đơn giá</th>
                <th className="text-right py-1 px-2 font-medium text-text-muted w-[120px]">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {row.items.map((item, idx) => (
                <tr
                  key={item.id}
                  className={idx % 2 === 0 ? '' : 'bg-surface-hover'}
                >
                  <td className="py-1 px-2 text-text-primary">{item.name}</td>
                  <td className="py-1 px-2 text-right text-text-secondary">{item.quantity}</td>
                  <td className="py-1 px-2 text-right text-text-secondary font-mono">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="py-1 px-2 text-right text-text-primary font-semibold font-mono">
                    {formatCurrency(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div className="flex flex-col items-end gap-1 mb-[var(--s-md)]">
        <div className="flex justify-between gap-[var(--s-3xl)] text-xs w-full max-w-[280px]">
          <span className="text-text-muted">Tổng tiền:</span>
          <span className="text-text-primary font-mono">{formatCurrency(row.totalAmount)}</span>
        </div>
        {row.discount > 0 && (
          <div className="flex justify-between gap-[var(--s-3xl)] text-xs w-full max-w-[280px]">
            <span className="text-text-muted">Giảm giá:</span>
            <span className="text-danger-fg font-mono">- {formatCurrency(row.discount)}</span>
          </div>
        )}
        <div className="flex justify-between gap-[var(--s-3xl)] text-sm w-full max-w-[280px] border-t border-border-subtle pt-1">
          <span className="font-semibold text-text-primary">Thành tiền:</span>
          <span className="font-bold text-run-bg font-mono">{formatCurrency(row.finalAmount)}</span>
        </div>
      </div>

      {/* Payment method */}
      <div className="text-xs text-text-secondary mb-[var(--s-md)]">
        <span className="text-text-muted">Phương thức thanh toán: </span>
        <span className="font-medium text-text-primary">
          {PAYMENT_METHOD_LABELS[row.paymentMethod]}
        </span>
      </div>

      {/* Notes */}
      {row.notes && (
        <div className="mb-[var(--s-md)]">
          <h4 className="text-xs font-semibold text-text-secondary mb-1">Ghi chú</h4>
          <p className="text-xs text-text-primary bg-neutral-bg p-2 rounded-field">
            {row.notes}
          </p>
        </div>
      )}

      {/* Quick status change buttons */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-text-muted">Thay đổi trạng thái:</span>
        <div className="flex gap-1 flex-wrap">
          {QUICK_STATUS_OPTIONS.map(({ status, label }) => (
            <Button
              key={status}
              variant={row.orderStatus === status ? 'run' : 'neutral'}
              onClick={() => handleQuickStatus(status)}
              className="!px-2 !py-0.5 !text-[10px]"
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
