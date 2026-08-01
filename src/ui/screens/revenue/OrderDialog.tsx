/**
 * OrderDialog — Add/edit order form with items sub-table, auto-calculation,
 * searchable customer dropdown with quick-add.
 *
 * Auto-calculates: totalAmount = sum(items.total), finalAmount = totalAmount - discount.
 *
 * Uses @components (Dialog, Button, Badge, Dropdown, DatePicker),
 * @store (useCustomerStore, useRevenueStore), @models, @utils.
 */

import { useState, useCallback, useMemo } from 'react';
import type { Revenue, OrderItem, OrderStatus, DeliveryStatus, PaymentMethod } from '@/models';
import {
  ORDER_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@/models';
import { formatCurrency, formatCurrencyInput, parseCurrency } from '@/utils/currency';
import { generateId } from '@/utils/id';
import { useCustomerStore } from '@/store/customerStore';
import { useRevenueStore } from '@/store/revenueStore';
import { Dialog, Button } from '@ui/components';
import { Badge } from '@ui/components/Badge';
import { DatePicker } from '@ui/components/DatePicker';
import { Dropdown, type DropdownOption } from '@ui/components/Dropdown';

/* ─── Props ─── */

export interface OrderDialogProps {
  open: boolean;
  onClose: () => void;
  /** Existing revenue to edit (undefined = new order) */
  editRevenue?: Revenue | null;
}

/* ─── Form state ─── */

interface OrderFormState {
  date: string;
  customerId: string;
  customerSearch: string;
  items: OrderItem[];
  discount: number;
  paymentMethod: PaymentMethod;
  notes: string;
  orderStatus: OrderStatus;
  deliveryStatus: DeliveryStatus;
}

const emptyItem = (): OrderItem => ({
  id: generateId(),
  name: '',
  quantity: 1,
  unitPrice: 0,
  total: 0,
});

const defaultForm: OrderFormState = {
  date: new Date().toISOString().slice(0, 10),
  customerId: '',
  customerSearch: '',
  items: [emptyItem()],
  discount: 0,
  paymentMethod: 'bank_transfer',
  notes: '',
  orderStatus: 'new',
  deliveryStatus: 'pending',
};

/* ─── Payment method options ─── */

const PAYMENT_METHOD_OPTIONS: DropdownOption[] = (Object.keys(PAYMENT_METHOD_LABELS) as Array<keyof typeof PAYMENT_METHOD_LABELS>).map(
  (key) => ({ value: key, label: PAYMENT_METHOD_LABELS[key] }),
);

/* ─── Status options ─── */

const STATUS_OPTIONS: DropdownOption[] = (Object.entries(ORDER_STATUS_LABELS)).map(
  ([value, label]) => ({ value, label }),
);

/* ─── Delivery status options ─── */

const DELIVERY_OPTIONS: DropdownOption[] = (Object.entries(DELIVERY_STATUS_LABELS)).map(
  ([value, label]) => ({ value, label }),
);

/* ─── Component ─── */

export function OrderDialog({ open, onClose, editRevenue }: OrderDialogProps) {
  const addRecord = useRevenueStore((s) => s.addRecord);
  const updateRecord = useRevenueStore((s) => s.updateRecord);
  const customers = useCustomerStore((s) => s.customers);
  const addCustomer = useCustomerStore((s) => s.addCustomer);

  /* Local form state — initialised from editRevenue or defaults */
  const [form, setForm] = useState<OrderFormState>(() => {
    if (editRevenue) {
      return {
        date: editRevenue.date,
        customerId: editRevenue.customerId,
        customerSearch: '',
        items: [...editRevenue.items],
        discount: editRevenue.discount,
        paymentMethod: editRevenue.paymentMethod,
        notes: editRevenue.notes ?? '',
        orderStatus: editRevenue.orderStatus,
        deliveryStatus: editRevenue.deliveryStatus,
      };
    }
    return { ...defaultForm, items: [emptyItem()] };
  });

  /* Close resets form to defaults */
  const handleClose = useCallback(() => {
    onClose();
    setForm({ ...defaultForm, items: [emptyItem()] });
  }, [onClose]);

  /* ─── Auto-calculated totals ─── */
  const totalAmount = useMemo(
    () => form.items.reduce((sum, item) => sum + (item.total || 0), 0),
    [form.items],
  );

  const finalAmount = useMemo(
    () => Math.max(0, totalAmount - form.discount),
    [totalAmount, form.discount],
  );

  /* ─── Item management ─── */

  const updateItem = useCallback(
    (idx: number, field: keyof OrderItem, value: string | number) => {
      setForm((prev) => {
        const items = prev.items.map((item) => ({ ...item }) as OrderItem);
        const oldItem = items[idx];
        if (!oldItem) return { ...prev, items };

        const updated: OrderItem = {
          id: oldItem.id,
          name: oldItem.name,
          quantity: oldItem.quantity,
          unitPrice: oldItem.unitPrice,
          total: oldItem.total,
        };

        if (field === 'quantity' || field === 'unitPrice') {
          const qty = typeof value === 'number' ? value : parseInt(String(value), 10) || 1;
          const price = typeof value === 'number' ? value : parseCurrency(String(value)) || 0;
          if (field === 'quantity') updated.quantity = qty;
          if (field === 'unitPrice') updated.unitPrice = price;
          updated.total = (updated.quantity ?? 1) * (updated.unitPrice ?? 0);
        } else {
          const safe = updated as unknown as { [k: string]: unknown };
          safe[field] = value;
        }

        items[idx] = updated;
        return { ...prev, items };
      });
    },
    [],
  );

  const addItem = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, emptyItem()],
    }));
  }, []);

  const removeItem = useCallback(
    (idx: number) => {
      setForm((prev) => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== idx),
      }));
    },
    [],
  );

  /* ─── Customer search & quick-add ─── */

  const customerOptions = useMemo(() => {
    if (!form.customerSearch.trim()) return [];
    const q = form.customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(form.customerSearch) ||
        (c.email?.toLowerCase().includes(q) ?? false),
    ).slice(0, 10);
  }, [customers, form.customerSearch]);

  const handleCustomerSelect = useCallback((id: string) => {
    setForm((prev) => ({ ...prev, customerId: id, customerSearch: '' }));
  }, []);

  const handleQuickAddCustomer = useCallback(() => {
    const name = form.customerSearch.trim();
    if (!name) return;
    addCustomer({
      id: generateId(),
      name,
      phone: '',
      email: '',
      address: '',
      createdAt: new Date().toISOString(),
    });
    // Re-read customers to find the new one
    const newCustomers = useCustomerStore.getState().customers;
    const latest = newCustomers.find((c) => c.name === name);
    if (latest) {
      setForm((p) => ({ ...p, customerId: latest.id, customerSearch: '' }));
    }
  }, [form.customerSearch, addCustomer]);

  /* ─── Submit ─── */

  const handleSubmit = useCallback(() => {
    /* Validate */
    if (!form.date) return;
    if (!form.customerId) return;
    if (form.items.some((i) => !i.name.trim() || !i.quantity || (i.unitPrice ?? 0) <= 0)) return;

    const now = new Date().toISOString();

    if (editRevenue) {
      /* Update existing */
      updateRecord(editRevenue.id, {
        date: form.date,
        customerId: form.customerId,
        items: form.items,
        totalAmount,
        discount: form.discount,
        finalAmount,
        orderStatus: form.orderStatus,
        deliveryStatus: form.deliveryStatus,
        paymentMethod: form.paymentMethod,
        notes: form.notes || undefined,
      });
    } else {
      /* Create new */
      const newRecord: Revenue = {
        id: generateId(),
        date: form.date,
        orderCode: `DH-${form.date.replace(/-/g, '')}-${String(Date.now() % 1000).padStart(3, '0')}`,
        customerId: form.customerId,
        items: form.items,
        totalAmount,
        discount: form.discount,
        finalAmount,
        orderStatus: form.orderStatus,
        deliveryStatus: form.deliveryStatus,
        paymentMethod: form.paymentMethod,
        notes: form.notes || undefined,
        createdAt: now,
        updatedAt: now,
      };
      addRecord(newRecord);
    }
    handleClose();
  }, [form, totalAmount, finalAmount, editRevenue, addRecord, updateRecord, handleClose]);

  /* ─── Render ─── */

  const isEditing = !!editRevenue;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={isEditing ? 'Chỉnh sửa đơn hàng' : 'Tạo đơn hàng mới'}
      width={640}
      footer={
        <>
          <Button variant="neutral" onClick={handleClose}>Hủy</Button>
          <Button variant="run" onClick={handleSubmit}>
            {isEditing ? 'Cập nhật' : 'Tạo đơn'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[var(--s-md)]">
        {/* Date + Status row */}
        <div className="flex items-center gap-[var(--s-md)]">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-muted">Ngày đơn hàng</label>
            <DatePicker
              value={form.date}
              onChange={(v) => setForm((p) => ({ ...p, date: v }))}
            />
          </div>

          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs font-medium text-text-muted">Trạng thái</label>
            <Dropdown
              options={STATUS_OPTIONS}
              value={form.orderStatus}
              onChange={(v) => setForm((p) => ({ ...p, orderStatus: v as OrderStatus }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-muted">Trạng thái giao</label>
            <Dropdown
              options={DELIVERY_OPTIONS}
              value={form.deliveryStatus}
              onChange={(v) => setForm((p) => ({ ...p, deliveryStatus: v as DeliveryStatus }))}
            />
          </div>
        </div>

        {/* Customer search + quick-add */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-muted">Khách hàng</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={form.customerSearch}
                onChange={(e) => setForm((p) => ({ ...p, customerSearch: e.target.value }))}
                placeholder="Tìm tên, SĐT, email khách hàng..."
                className={
                  'w-full h-7 px-3 text-xs ' +
                  'bg-input-bg ' +
                  'border border-input-border rounded-field ' +
                  'text-text-primary placeholder-input-placeholder ' +
                  'focus:outline-none focus:ring-2 focus:ring-input-focus-ring ' +
                  'transition-colors duration-[var(--d-fast)]'
                }
                aria-label="Tìm khách hàng"
              />
            </div>
            {form.customerSearch.trim() && (
              <Button
                variant="accent"
                onClick={handleQuickAddCustomer}
                className="!px-2 !py-0.5 !text-[10px]"
              >
                + Thêm nhanh
              </Button>
            )}
          </div>

          {/* Customer search results dropdown */}
          {customerOptions.length > 0 && (
            <div className="max-h-40 overflow-y-auto border border-border-subtle rounded-field bg-surface">
              {customerOptions.map((c) => (
                <div
                  key={c.id}
                  className="px-3 py-1.5 text-xs cursor-pointer hover:bg-surface-hover transition-colors"
                  onClick={() => handleCustomerSelect(c.id)}
                  role="option"
                  aria-selected={form.customerId === c.id}
                >
                  <span className="font-medium text-text-primary">{c.name}</span>
                  <span className="text-text-muted ml-2">— {c.phone}</span>
                </div>
              ))}
            </div>
          )}

          {form.customerId && (
            <div className="flex items-center gap-1 mt-1">
              <Badge variant="success" size="sm">
                {customers.find((c) => c.id === form.customerId)?.name ?? form.customerId}
              </Badge>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, customerId: '' }))}
                className="text-xs text-text-muted hover:text-text-primary"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Items sub-table */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-text-muted">Sản phẩm / Dịch vụ</label>
            <Button variant="accent" onClick={addItem} className="!px-2 !py-0.5 !text-[10px]">
              + Thêm dòng
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="text-left py-1 px-2 font-medium text-text-muted">Tên</th>
                  <th className="text-right py-1 px-2 font-medium text-text-muted w-[60px]">SL</th>
                  <th className="text-right py-1 px-2 font-medium text-text-muted w-[120px]">Đơn giá (₫)</th>
                  <th className="text-right py-1 px-2 font-medium text-text-muted w-[120px]">Thành tiền</th>
                  <th className="w-[32px]" />
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, idx) => (
                  <tr key={item.id} className="border-b border-border-subtle">
                    <td className="py-1 px-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(idx, 'name', e.target.value)}
                        placeholder="Tên SP/dịch vụ"
                        className={
                          'w-full h-7 px-2 text-xs ' +
                          'bg-input-bg ' +
                          'border border-input-border rounded-field ' +
                          'text-text-primary ' +
                          'focus:outline-none focus:ring-2 focus:ring-input-focus-ring'
                        }
                        aria-label={`Tên sản phẩm dòng ${idx + 1}`}
                      />
                    </td>
                    <td className="py-1 px-2">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity ?? 1}
                        onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                        className={
                          'w-full h-7 px-2 text-xs text-right ' +
                          'bg-input-bg ' +
                          'border border-input-border rounded-field ' +
                          'text-text-primary font-mono ' +
                          'focus:outline-none focus:ring-2 focus:ring-input-focus-ring'
                        }
                        aria-label={`Số lượng dòng ${idx + 1}`}
                      />
                    </td>
                    <td className="py-1 px-2">
                      <input
                        type="text"
                        value={item.unitPrice ? formatCurrencyInput(String(item.unitPrice)) : ''}
                        onChange={(e) => updateItem(idx, 'unitPrice', parseCurrency(e.target.value))}
                        placeholder="0"
                        className={
                          'w-full h-7 px-2 text-xs text-right ' +
                          'bg-input-bg ' +
                          'border border-input-border rounded-field ' +
                          'text-text-primary font-mono ' +
                          'focus:outline-none focus:ring-2 focus:ring-input-focus-ring'
                        }
                        aria-label={`Đơn giá dòng ${idx + 1}`}
                      />
                    </td>
                    <td className="py-1 px-2 text-right text-text-primary font-semibold font-mono whitespace-nowrap">
                      {formatCurrency(item.total)}
                    </td>
                    <td className="py-1 px-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-text-muted hover:text-danger-fg transition-colors text-sm"
                        aria-label={`Xóa dòng ${idx + 1}`}
                        disabled={form.items.length === 1}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Auto-calculated totals */}
          <div className="flex flex-col items-end gap-1 pt-2 border-t border-border-subtle">
            <div className="flex justify-between gap-[var(--s-3xl)] text-xs w-full max-w-[280px]">
              <span className="text-text-muted">Tổng tiền:</span>
              <span className="text-text-primary font-mono">{formatCurrency(totalAmount)}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Giảm giá:</span>
              <input
                type="text"
                value={form.discount > 0 ? formatCurrencyInput(String(form.discount)) : ''}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    discount: Math.min(parseCurrency(e.target.value), totalAmount),
                  }))
                }
                placeholder="0"
                className={
                  'w-[120px] h-7 px-2 text-xs text-right ' +
                  'bg-input-bg ' +
                  'border border-input-border rounded-field ' +
                  'text-text-primary font-mono ' +
                  'focus:outline-none focus:ring-2 focus:ring-input-focus-ring'
                }
                aria-label="Số tiền giảm giá"
              />
            </div>

            <div className="flex justify-between gap-[var(--s-3xl)] text-sm w-full max-w-[280px] border-t border-border-subtle pt-1">
              <span className="font-semibold text-text-primary">Thành tiền:</span>
              <span className="font-bold text-run-bg font-mono">{formatCurrency(finalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Payment method */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-muted">Phương thức thanh toán</label>
          <Dropdown
            options={PAYMENT_METHOD_OPTIONS}
            value={form.paymentMethod}
            onChange={(v) => setForm((p) => ({ ...p, paymentMethod: v as PaymentMethod }))}
          />
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-muted">Ghi chú</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Ghi chú thêm (tùy chọn)..."
            rows={2}
            className={
              'w-full px-3 py-2 text-xs ' +
              'bg-input-bg ' +
              'border border-input-border rounded-field ' +
              'text-text-primary placeholder-input-placeholder ' +
              'focus:outline-none focus:ring-2 focus:ring-input-focus-ring ' +
              'resize-none'
            }
            aria-label="Ghi chú đơn hàng"
          />
        </div>
      </div>
    </Dialog>
  );
}
