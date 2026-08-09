/**
 * TransactionDetailModal — show full details for an expense or revenue record,
 * with inline editing and delete confirmation.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dropdown, optionsFromLabels } from '@/ui/components/Dropdown';
import { formatCurrency } from '@/utils/currency';
import {
  type Expense,
  type Revenue,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  EXPENSE_CATEGORY_LABELS,
  ORDER_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
} from '@/models';
import { useCustomerStore } from '@/store/customerStore';
import { updateExpense, deleteExpenses } from '@/services/expenseService';
import { updateRevenue, deleteRevenues } from '@/services/revenueService';
import { todayISO } from '@/utils/date';
import {
  getRemainingBalance,
  paymentSummaryLabel,
} from '@/utils/revenueMetrics';
import { shippingLabel } from '@/utils/orderTotals';
import { notify } from '@/utils/notify';

// ── Types ─────────────────────────────────────────────────────────────────────

type TransactionDetailModalProps = {
  open: boolean;
  onClose: () => void;
  readOnly?: boolean;
} & (
  | { type: 'expense'; record: Expense }
  | { type: 'revenue'; record: Revenue }
);

// ── Shared state shape ────────────────────────────────────────────────────────

type ExpenseLocal = {
  paymentMethod: Expense['paymentMethod'];
  notes: Expense['notes'];
  supplier: Expense['supplier'];
};

type RevenueLocal = {
  orderStatus: Revenue['orderStatus'];
  deliveryStatus: Revenue['deliveryStatus'];
  notes: Revenue['notes'];
};

// ── Helper: format ISO date to DD/MM/YYYY ─────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${date} ${time}`;
  } catch {
    return iso;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TransactionDetailModal(props: TransactionDetailModalProps) {
  const { open, onClose, readOnly = false } = props;

  // ── Expense state ─────────────────────────────────────────────────────────
  const [expenseLocal, setExpenseLocal] = useState<ExpenseLocal>({
    paymentMethod: 'cash',
    notes: '',
    supplier: '',
  });
  const [savingExpense, setSavingExpense] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);

  // ── Revenue state ─────────────────────────────────────────────────────────
  const [revenueLocal, setRevenueLocal] = useState<RevenueLocal>({
    orderStatus: 'new',
    deliveryStatus: 'pending',
    notes: '',
  });
  const [savingRevenue, setSavingRevenue] = useState(false);
  const [deleteAlertOpenRev, setDeleteAlertOpenRev] = useState(false);

  // Initialize local state when record changes
  useEffect(() => {
    if (!open) return;
    if (props.type === 'expense' && 'record' in props) {
      const r = (props as { type: 'expense'; record: Expense }).record;
      setExpenseLocal({
        paymentMethod: r.paymentMethod,
        notes: r.notes ?? '',
        supplier: r.supplier ?? '',
      });
    } else if (props.type === 'revenue' && 'record' in props) {
      const r = (props as { type: 'revenue'; record: Revenue }).record;
      setRevenueLocal({
        orderStatus: r.orderStatus,
        deliveryStatus: r.deliveryStatus,
        notes: r.notes ?? '',
      });
    }
  }, [open, props.type, props.record?.id]);

  // ── Expense handlers ──────────────────────────────────────────────────────

  const handleExpenseSave = async () => {
    if (props.type !== 'expense') return;
    const rec = props.record as Expense;
    setSavingExpense(true);
    try {
      await updateExpense(rec.id, {
        paymentMethod: expenseLocal.paymentMethod,
        notes: expenseLocal.notes,
        supplier: expenseLocal.supplier,
      });
      onClose();
    } finally {
      setSavingExpense(false);
    }
  };

  const handleExpenseDelete = async () => {
    if (props.type !== 'expense') return;
    const rec = props.record as Expense;
    await deleteExpenses([rec.id]);
    setDeleteAlertOpen(false);
    onClose();
  };

  // ── Revenue handlers ──────────────────────────────────────────────────────

  const handleRevenueSave = async () => {
    if (props.type !== 'revenue') return;
    const rec = props.record as Revenue;
    setSavingRevenue(true);
    try {
      await updateRevenue(rec.id, {
        orderStatus: revenueLocal.orderStatus,
        deliveryStatus: revenueLocal.deliveryStatus,
        notes: revenueLocal.notes,
      });
      onClose();
    } finally {
      setSavingRevenue(false);
    }
  };

  const handleRevenueDelete = async () => {
    if (props.type !== 'revenue') return;
    const rec = props.record as Revenue;
    await deleteRevenues([rec.id]);
    setDeleteAlertOpenRev(false);
    onClose();
  };

  const handleMarkPaid = async () => {
    if (props.type !== 'revenue') return;
    const rec = props.record as Revenue;
    try {
      await updateRevenue(rec.id, {
        paymentStatus: 'paid',
        paidAt: todayISO(),
        paidAmount: getRemainingBalance(rec),
      });
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Không cập nhật thanh toán');
    }
  };

  const customerName = (() => {
    if (props.type !== 'revenue') return '';
    const rec = props.record as Revenue;
    if (rec.customerId === 'walk-in') return 'Khách vãng lai';
    const found = useCustomerStore.getState().customers.find((c) => c.id === rec.customerId)?.name;
    if (found) return found;
    const fromNotes = rec.notes?.replace(/^Khách:\s*/i, '').trim();
    return fromNotes || '—';
  })();

  // ── Dialog open tracking ──────────────────────────────────────────────────

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className={`max-h-[85vh] !flex !flex-col overflow-hidden p-0 gap-0 h-auto ${
            props.type === 'revenue' ? 'max-w-lg sm:max-w-xl' : 'max-w-2xl'
          }`}
        >
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {props.type === 'expense' ? 'Chi tiết chi phí' : 'Chi tiết đơn hàng'}
              {props.type === 'expense' && (
                <Badge variant="secondary">{(props.record as Expense).description}</Badge>
              )}
              {props.type === 'revenue' && (
                <Badge variant="secondary">{(props.record as Revenue).orderCode}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto px-6 py-4 max-h-[calc(85vh-9rem)]">
            {/* ── EXPENSE section ──────────────────────────────────────────── */}
            {props.type === 'expense' && (
              <div className="space-y-4">
                <div>
                  {/* Payment method */}
                  <div className="space-y-2">
                    <label className="text-xs text-text-muted font-medium">Phương thức thanh toán</label>
                    {readOnly ? (
                      <div className="text-sm text-text-primary">{PAYMENT_METHOD_LABELS[expenseLocal.paymentMethod]}</div>
                    ) : (
                    <Dropdown
                      options={optionsFromLabels(PAYMENT_METHOD_LABELS)}
                      value={expenseLocal.paymentMethod}
                      onChange={(v) => setExpenseLocal((p) => ({ ...p, paymentMethod: v as Expense['paymentMethod'] }))}
                      aria-label="Phương thức thanh toán"
                      className="w-full"
                    />
                    )}
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-text-muted font-medium">Nhà cung cấp</label>
                    {readOnly ? (
                      <div className="text-sm text-text-primary">{expenseLocal.supplier || '—'}</div>
                    ) : (
                    <Input
                      value={expenseLocal.supplier}
                      onChange={(e) => setExpenseLocal((p) => ({ ...p, supplier: e.target.value }))}
                    />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-text-muted font-medium">Số tiền</label>
                    <div className="text-sm font-semibold text-text-primary">
                      {formatCurrency(props.record.amount)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-text-muted font-medium">Danh mục</label>
                    <div className="text-sm text-text-primary">
                      {EXPENSE_CATEGORY_LABELS[props.record.category]}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-text-muted font-medium">Ngày</label>
                    <div className="text-sm text-text-primary">{formatDate(props.record.date)}</div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-xs text-text-muted font-medium">Mô tả</label>
                  <div className="text-sm text-text-primary">{props.record.description}</div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-xs text-text-muted font-medium">Ghi chú</label>
                  {readOnly ? (
                    <div className="text-sm text-text-primary">{expenseLocal.notes || '—'}</div>
                  ) : (
                  <Textarea
                    value={expenseLocal.notes}
                    onChange={(e) => setExpenseLocal((p) => ({ ...p, notes: e.target.value }))}
                    rows={3}
                  />
                  )}
                </div>

                {/* Invoice image */}
                {props.record.invoiceImageId && (
                  <div className="space-y-2">
                    <label className="text-xs text-text-muted font-medium">Hóa đơn</label>
                    <Badge variant="outline">Có hóa đơn (ID: {props.record.invoiceImageId})</Badge>
                  </div>
                )}

                {/* Tags */}
                {props.record.tags.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs text-text-muted font-medium">Thẻ</label>
                    <div className="flex flex-wrap gap-1">
                      {props.record.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="space-y-2 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-text-muted font-medium">Tạo lúc</label>
                      <div className="text-xs text-text-primary">{formatDateTime(props.record.createdAt)}</div>
                    </div>
                    <div>
                      <label className="text-xs text-text-muted font-medium">Cập nhật</label>
                      <div className="text-xs text-text-primary">{formatDateTime(props.record.updatedAt)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── REVENUE: readonly info + editable status/notes ─────────── */}
            {props.type === 'revenue' && (
              <div className="space-y-4">
                {/* Readonly summary */}
                <div className="rounded-panel border border-border-subtle bg-surface/60 p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wide text-text-muted">Khách hàng</p>
                      <p className="text-sm font-medium text-text-primary truncate">{customerName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wide text-text-muted">Ngày đơn</p>
                      <p className="text-sm text-text-primary">{formatDate(props.record.date)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wide text-text-muted">PTTT</p>
                      <p className="text-sm text-text-primary">
                        {PAYMENT_METHOD_LABELS[props.record.paymentMethod]}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wide text-text-muted">Thu tiền</p>
                      <p className="text-sm text-text-primary">
                        {PAYMENT_STATUS_LABELS[props.record.paymentStatus ?? 'unpaid']}
                        {props.record.depositedAt
                          ? ` · cọc ${props.record.depositedAt}`
                          : ''}
                        {props.record.paidAt ? ` · TT ${props.record.paidAt}` : ''}
                      </p>
                      {shippingLabel(
                        props.record.shippingFee ?? 0,
                        props.record.shippingPayer,
                      ) && (
                        <p className="text-xs text-text-secondary">
                          {shippingLabel(
                            props.record.shippingFee ?? 0,
                            props.record.shippingPayer,
                          )}
                        </p>
                      )}
                      {paymentSummaryLabel(props.record) && (
                        <p className="text-xs text-text-secondary">
                          {paymentSummaryLabel(props.record)}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wide text-text-muted">Mã đơn</p>
                      <p className="text-sm font-mono text-text-primary">{props.record.orderCode}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wide text-text-muted">Sản phẩm</p>
                    <div className="overflow-x-auto overflow-y-hidden rounded-field border border-border-subtle">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border-subtle text-text-muted bg-surface">
                            <th className="text-left py-1.5 px-2 font-medium">Sản phẩm</th>
                            <th className="text-right py-1.5 px-2 font-medium">SL</th>
                            <th className="text-right py-1.5 px-2 font-medium">Đơn giá</th>
                            <th className="text-right py-1.5 px-2 font-medium">Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody>
                          {props.record.items.map((item) => (
                            <tr key={item.id} className="border-b border-border-subtle/50 last:border-0">
                              <td className="py-1.5 px-2 text-text-primary">{item.name}</td>
                              <td className="py-1.5 px-2 text-right text-text-primary">{item.quantity}</td>
                              <td className="py-1.5 px-2 text-right text-text-primary tabular-nums">
                                {formatCurrency(item.unitPrice)}
                              </td>
                              <td className="py-1.5 px-2 text-right font-medium text-text-primary tabular-nums">
                                {formatCurrency(item.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted">Tổng tiền</span>
                      <span className="text-text-primary font-medium tabular-nums">
                        {formatCurrency(props.record.totalAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted">Giảm giá</span>
                      <span className="text-danger-fg font-medium tabular-nums">
                        −{formatCurrency(props.record.discount)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-text-primary">Thành tiền</span>
                      <span className="text-text-primary tabular-nums">
                        {formatCurrency(props.record.finalAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Editable fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-text-muted font-medium">Trạng thái đơn</label>
                    {readOnly ? (
                      <div className="text-sm text-text-primary">{ORDER_STATUS_LABELS[revenueLocal.orderStatus]}</div>
                    ) : (
                      <Dropdown
                        options={optionsFromLabels(ORDER_STATUS_LABELS).map((o) => ({
                          ...o,
                          disabled: o.value === 'completed' && revenueLocal.deliveryStatus !== 'delivered',
                        }))}
                        value={revenueLocal.orderStatus}
                        onChange={(v) => {
                          const next = v as Revenue['orderStatus'];
                          setRevenueLocal((p) => ({
                            ...p,
                            orderStatus: next,
                            deliveryStatus: next === 'processing' ? 'pending' : p.deliveryStatus,
                          }));
                        }}
                        aria-label="Trạng thái đơn"
                        className="w-full"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-text-muted font-medium">Trạng thái giao hàng</label>
                    {readOnly ? (
                      <div className="text-sm text-text-primary">{DELIVERY_STATUS_LABELS[revenueLocal.deliveryStatus]}</div>
                    ) : (
                      <Dropdown
                        options={optionsFromLabels(DELIVERY_STATUS_LABELS)}
                        value={revenueLocal.deliveryStatus}
                        onChange={(v) =>
                          setRevenueLocal((p) => ({
                            ...p,
                            deliveryStatus: v as Revenue['deliveryStatus'],
                          }))
                        }
                        aria-label="Trạng thái giao hàng"
                        className="w-full"
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-text-muted font-medium">Ghi chú</label>
                  {readOnly ? (
                    <div className="text-sm text-text-primary">{revenueLocal.notes || '—'}</div>
                  ) : (
                    <Textarea
                      value={revenueLocal.notes}
                      onChange={(e) => setRevenueLocal((p) => ({ ...p, notes: e.target.value }))}
                      rows={3}
                      placeholder="Ghi chú đơn hàng…"
                    />
                  )}
                </div>

                {!readOnly &&
                  props.record.paymentStatus !== 'paid' &&
                  props.record.orderStatus !== 'cancelled' && (
                    <Button type="button" variant="secondary" size="sm" onClick={handleMarkPaid}>
                      Đánh dấu đã thanh toán
                    </Button>
                  )}
              </div>
            )}
          </div>

          {/* ── Footer ─────────────────────────────────────────────────────── */}
          <DialogFooter className="px-6 py-3 border-t border-border shrink-0 bg-muted/30 gap-2">
            {readOnly ? (
              <Button variant="outline" onClick={onClose}>Đóng</Button>
            ) : (
              <>
            <Button variant="destructive" onClick={() => {
              if (props.type === 'expense') setDeleteAlertOpen(true);
              if (props.type === 'revenue') setDeleteAlertOpenRev(true);
            }}>
              Xóa
            </Button>
            <Button variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button onClick={() => {
              if (props.type === 'expense') handleExpenseSave();
              if (props.type === 'revenue') handleRevenueSave();
            }} disabled={savingExpense || savingRevenue}>
              {savingExpense || savingRevenue ? 'Đang lưu...' : 'Lưu'}
            </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Expense delete confirmation ──────────────────────────────────── */}
      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa khoản chi này? Thao tác này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExpenseDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Revenue delete confirmation ──────────────────────────────────── */}
      <AlertDialog open={deleteAlertOpenRev} onOpenChange={setDeleteAlertOpenRev}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa đơn hàng này? Thao tác này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevenueDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
