/**
 * OrderRowCard — Order detail content for the revenue detail dialog.
 */

import type { ReactNode } from 'react';
import type { Revenue, OrderStatus } from '@/models';
import { ORDER_STATUS_LABELS, DELIVERY_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '@/models';
import { formatCurrency } from '@/utils/currency';
import { todayISO } from '@/utils/date';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Play, Package, X, User, CreditCard, Truck, Banknote, Star } from 'lucide-react';
import { useCustomerStore } from '@/store/customerStore';
import { updateRevenue } from '@/services/revenueService';
import { notify } from '@/utils/notify';
import {
  getRemainingBalance,
  paymentSummaryLabel,
} from '@/utils/revenueMetrics';
import { shippingLabel } from '@/utils/orderTotals';

export interface OrderRowCardProps {
  row: Revenue;
  /** Hide mark-paid / status action buttons (detail peek) */
  readOnly?: boolean;
  onStatusChange?: (id: string, status: OrderStatus) => void;
}

const QUICK_STATUS_OPTIONS: Array<{ status: OrderStatus; label: string; icon: ReactNode }> = [
  { status: 'confirmed', label: 'Xác nhận', icon: <CheckCircle2 size={12} /> },
  { status: 'processing', label: 'Xử lý', icon: <Play size={12} /> },
  { status: 'completed', label: 'Hoàn thành', icon: <Package size={12} /> },
  { status: 'cancelled', label: 'Hủy', icon: <X size={12} /> },
];

function statusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-success-bg text-success-fg border-success-bg';
    case 'cancelled':
      return 'bg-danger-bg text-danger-fg border-danger-bg';
    case 'processing':
    case 'confirmed':
      return 'bg-accent-bg text-accent-fg border-accent-bg';
    default:
      return '';
  }
}

export function OrderRowCard({ row, readOnly = false, onStatusChange }: OrderRowCardProps) {
  const customers = useCustomerStore((s) => s.customers);

  const customerName =
    row.customerId === 'walk-in'
      ? 'Khách vãng lai'
      : customers.find((c) => c.id === row.customerId)?.name ||
        row.notes?.replace(/^Khách:\s*/i, '') ||
        '—';

  const handleQuickStatus = async (status: OrderStatus) => {
    await updateRevenue(row.id, { orderStatus: status });
    onStatusChange?.(row.id, status);
  };

  const handleMarkPaid = async () => {
    try {
      await updateRevenue(row.id, {
        paymentStatus: 'paid',
        paidAt: todayISO(),
        paidAmount: getRemainingBalance(row),
      });
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Không cập nhật thanh toán');
    }
  };

  const handleTogglePriority = async () => {
    const next = !row.priority;
    await updateRevenue(row.id, {
      priority: next,
      priorityAt: next ? new Date().toISOString() : undefined,
    });
  };

  const canMarkPaid =
    row.paymentStatus !== 'paid' && row.orderStatus !== 'cancelled';
  const paySummary = paymentSummaryLabel(row);
  const shipSummary = shippingLabel(row.shippingFee ?? 0, row.shippingPayer);

  return (
    <div className="space-y-4" role="region" aria-label={`Chi tiết đơn ${row.orderCode}`}>
      {row.priority ? (
        <div className="flex items-center gap-2 rounded-field bg-warning-bg text-warning-fg px-3 py-2 text-xs font-semibold">
          <Star size={14} fill="currentColor" className="shrink-0" />
          Đơn ưu tiên
          {row.priorityAt ? (
            <span className="font-normal text-warning-fg/80 ml-auto tabular-nums">
              {new Date(row.priorityAt).toLocaleString('vi-VN')}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Meta grid — no UUID, no duplicate order code */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-panel border border-border-subtle bg-surface p-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-text-muted mb-0.5">Khách hàng</p>
          <p className="text-sm font-medium text-text-primary truncate flex items-center gap-1">
            <User size={12} className="shrink-0 text-text-muted" />
            {customerName}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-text-muted mb-0.5">Thành tiền</p>
          <p className="text-sm font-bold text-accent-fg font-mono">{formatCurrency(row.finalAmount)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-text-muted mb-0.5">Trạng thái</p>
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="outline" className={`text-xs ${statusBadgeClass(row.orderStatus)}`}>
              {ORDER_STATUS_LABELS[row.orderStatus]}
            </Badge>
            {row.priority ? (
              <Badge variant="outline" className="text-[10px] bg-warning-bg text-warning-fg border-transparent">
                Ưu tiên
              </Badge>
            ) : null}
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-text-muted mb-0.5">Giao hàng</p>
          <p className="text-xs text-text-primary flex items-center gap-1">
            <Truck size={12} className="text-text-muted" />
            {DELIVERY_STATUS_LABELS[row.deliveryStatus]}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge
          variant="outline"
          className={
            row.paymentStatus === 'paid'
              ? 'bg-success-bg text-success-fg border-transparent'
              : 'bg-warning-bg text-warning-fg border-transparent'
          }
        >
          {PAYMENT_STATUS_LABELS[row.paymentStatus ?? 'unpaid']}
        </Badge>
        {row.depositedAt && (
          <span className="text-text-muted">Ngày cọc: {row.depositedAt}</span>
        )}
        {row.paidAt && <span className="text-text-muted">Ngày TT: {row.paidAt}</span>}
        {shipSummary && <span className="text-text-secondary w-full">{shipSummary}</span>}
        {paySummary && <span className="text-text-secondary w-full">{paySummary}</span>}
      </div>

      {/* Items */}
      <div>
        <h4 className="text-xs font-semibold text-text-secondary mb-2">Sản phẩm / Dịch vụ</h4>
        <div className="overflow-x-auto overflow-y-hidden rounded-field border border-border-subtle">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-hover border-b border-border-subtle">
                <th className="text-left py-2 px-3 font-medium text-text-muted">Tên</th>
                <th className="text-right py-2 px-3 font-medium text-text-muted w-14">SL</th>
                <th className="text-right py-2 px-3 font-medium text-text-muted w-28">Đơn giá</th>
                <th className="text-right py-2 px-3 font-medium text-text-muted w-28">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {row.items.map((item, idx) => (
                <tr key={item.id} className={idx % 2 === 0 ? 'bg-surface' : 'bg-surface-hover/50'}>
                  <td className="py-2 px-3 text-text-primary">{item.name}</td>
                  <td className="py-2 px-3 text-right text-text-secondary">{item.quantity}</td>
                  <td className="py-2 px-3 text-right text-text-secondary font-mono">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="py-2 px-3 text-right text-text-primary font-semibold font-mono">
                    {formatCurrency(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div className="flex flex-col items-end gap-1">
        <div className="flex justify-between gap-8 text-xs w-full max-w-xs">
          <span className="text-text-muted">Tổng tiền</span>
          <span className="font-mono text-text-primary">{formatCurrency(row.totalAmount)}</span>
        </div>
        {row.discount > 0 && (
          <div className="flex justify-between gap-8 text-xs w-full max-w-xs">
            <span className="text-text-muted">Giảm giá</span>
            <span className="font-mono text-danger-fg">−{formatCurrency(row.discount)}</span>
          </div>
        )}
        <div className="flex justify-between gap-8 text-sm w-full max-w-xs border-t border-border-subtle pt-2">
          <span className="font-semibold text-text-primary">Thành tiền</span>
          <span className="font-bold text-accent-fg font-mono">{formatCurrency(row.finalAmount)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
        <span className="inline-flex items-center gap-1">
          <CreditCard size={12} className="text-text-muted" />
          {PAYMENT_METHOD_LABELS[row.paymentMethod]}
        </span>
        {row.notes && (
          <span className="text-text-muted truncate max-w-full">Ghi chú: {row.notes}</span>
        )}
      </div>

      {!readOnly ? (
        <div className="pt-2 border-t border-border-subtle space-y-3">
          <Button
            variant={row.priority ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => void handleTogglePriority()}
          >
            <Star size={12} fill={row.priority ? 'currentColor' : 'none'} />
            {row.priority ? 'Bỏ ưu tiên' : 'Đánh dấu ưu tiên'}
          </Button>
          {canMarkPaid && (
            <Button variant="default" size="sm" className="h-8 text-xs gap-1" onClick={handleMarkPaid}>
              <Banknote size={12} />
              Đánh dấu đã thanh toán
            </Button>
          )}
          <div>
            <p className="text-xs font-medium text-text-muted mb-2">Thay đổi trạng thái</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_STATUS_OPTIONS.map(({ status, label, icon }) => (
                <Button
                  key={status}
                  variant={row.orderStatus === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleQuickStatus(status)}
                  className="h-8 text-xs gap-1"
                >
                  {icon}
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
