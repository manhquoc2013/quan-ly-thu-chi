/**
 * OrderRowCard — Order detail content for the revenue detail dialog.
 */

import type { ReactNode } from 'react';
import type { Revenue, OrderStatus } from '@/models';
import { ORDER_STATUS_LABELS, DELIVERY_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/models';
import { formatCurrency } from '@/utils/currency';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Play, Package, X, User, CreditCard, Truck } from 'lucide-react';
import { useRevenueStore } from '@/store/revenueStore';
import { useCustomerStore } from '@/store/customerStore';

export interface OrderRowCardProps {
  row: Revenue;
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

export function OrderRowCard({ row, onStatusChange }: OrderRowCardProps) {
  const updateRecord = useRevenueStore((s) => s.updateRecord);
  const customers = useCustomerStore((s) => s.customers);

  const customerName =
    row.customerId === 'walk-in'
      ? 'Khách vãng lai'
      : customers.find((c) => c.id === row.customerId)?.name ||
        row.notes?.replace(/^Khách:\s*/i, '') ||
        '—';

  const handleQuickStatus = (status: OrderStatus) => {
    updateRecord(row.id, { orderStatus: status });
    onStatusChange?.(row.id, status);
  };

  return (
    <div className="space-y-4" role="region" aria-label={`Chi tiết đơn ${row.orderCode}`}>
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
          <Badge variant="outline" className={`text-xs ${statusBadgeClass(row.orderStatus)}`}>
            {ORDER_STATUS_LABELS[row.orderStatus]}
          </Badge>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-text-muted mb-0.5">Giao hàng</p>
          <p className="text-xs text-text-primary flex items-center gap-1">
            <Truck size={12} className="text-text-muted" />
            {DELIVERY_STATUS_LABELS[row.deliveryStatus]}
          </p>
        </div>
      </div>

      {/* Items */}
      <div>
        <h4 className="text-xs font-semibold text-text-secondary mb-2">Sản phẩm / Dịch vụ</h4>
        <div className="overflow-x-auto rounded-field border border-border-subtle">
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

      {/* Status actions */}
      <div className="pt-2 border-t border-border-subtle">
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
  );
}
