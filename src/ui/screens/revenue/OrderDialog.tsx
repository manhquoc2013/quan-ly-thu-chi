/**
 * OrderDialog — Add/edit order form with items sub-table, auto-calculation,
 * searchable customer dropdown with quick-add.
 *
 * Auto-calculates: totalAmount = sum(items.total), finalAmount = totalAmount - discount.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import type {
  Revenue,
  OrderItem,
  OrderStatus,
  DeliveryStatus,
  PaymentMethod,
  PaymentStatus,
  ShippingPayer,
} from '@/models';
import {
  ORDER_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  SHIPPING_PAYER_LABELS,
} from '@/models';
import { formatCurrency, formatCurrencyInput, parseCurrency } from '@/utils/currency';
import { generateId } from '@/utils/id';
import { todayISO } from '@/utils/date';
import { notify } from '@/utils/notify';
import { defaultPaidAmount } from '@/utils/revenueMetrics';
import { computeOrderTotals } from '@/utils/orderTotals';
import { X, Plus, Check } from 'lucide-react';
import { createRevenue, updateRevenue, buildOrderCode } from '@/services/revenueService';
import { createCustomer } from '@/services/customerService';
import { createProduct, searchProducts } from '@/services/productService';
import { getDefaultPlatformId, getActivePlatforms } from '@/services/platformService';
import { useRevenueStore } from '@/store/revenueStore';
import { useCustomerStore } from '@/store/customerStore';
import { useProductStore } from '@/store/productStore';
import { usePlatformStore } from '@/store/platformStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/ui/components/DatePicker';
import { Dropdown, optionsFromLabels } from '@/ui/components/Dropdown';

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
  orderCode: string;
  orderCodeManual: boolean;
  customerId: string;
  customerSearch: string;
  platformId: string;
  items: OrderItem[];
  discount: number;
  shippingFee: number;
  shippingPayer: ShippingPayer;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  depositAmount: number;
  depositedAt: string;
  paidAmount: number;
  paidAt: string;
  notes: string;
  orderStatus: OrderStatus;
  deliveryStatus: DeliveryStatus;
}

const emptyItem = (): OrderItem => ({
  id: generateId(),
  productId: undefined,
  name: '',
  quantity: 1,
  unitPrice: 0,
  total: 0,
});

const defaultForm: OrderFormState = {
  date: todayISO(),
  orderCode: '',
  orderCodeManual: false,
  customerId: '',
  customerSearch: '',
  platformId: '',
  items: [emptyItem()],
  discount: 0,
  shippingFee: 0,
  shippingPayer: 'customer',
  paymentMethod: 'bank_transfer',
  paymentStatus: 'unpaid',
  depositAmount: 0,
  depositedAt: '',
  paidAmount: 0,
  paidAt: '',
  notes: '',
  orderStatus: 'new',
  deliveryStatus: 'pending',
};

const PAYMENT_METHOD_OPTIONS = optionsFromLabels(PAYMENT_METHOD_LABELS);
const PAYMENT_STATUS_OPTIONS = optionsFromLabels(PAYMENT_STATUS_LABELS);
const SHIPPING_PAYER_OPTIONS = optionsFromLabels(SHIPPING_PAYER_LABELS);
const STATUS_OPTIONS = optionsFromLabels(ORDER_STATUS_LABELS);
const DELIVERY_OPTIONS = optionsFromLabels(DELIVERY_STATUS_LABELS);

/* ─── Component ─── */

export function OrderDialog({ open, onClose, editRevenue }: OrderDialogProps) {
  const customers = useCustomerStore((s) => s.customers);
  const products = useProductStore((s) => s.products);
  const platforms = usePlatformStore((s) => s.platforms);
  const revenues = useRevenueStore((s) => s.records);
  const [activeProductRow, setActiveProductRow] = useState<number | null>(null);

  const platformOptions = useMemo(
    () =>
      getActivePlatforms().map((p) => ({ value: p.id, label: p.name })),
    [platforms],
  );

  const [form, setForm] = useState<OrderFormState>({ ...defaultForm, items: [emptyItem()] });

  // Sync form whenever dialog opens / edit target changes
  useEffect(() => {
    if (!open) return;
    if (editRevenue) {
      const customer = useCustomerStore
        .getState()
        .customers.find((c) => c.id === editRevenue.customerId);
      const customerLabel =
        editRevenue.customerId === 'walk-in'
          ? 'Khách vãng lai'
          : customer?.name ||
            editRevenue.notes?.replace(/^Khách:\s*/i, '') ||
            '';
      setForm({
        date: editRevenue.date,
        orderCode: editRevenue.orderCode,
        orderCodeManual: true,
        customerId: editRevenue.customerId,
        customerSearch: customerLabel,
        platformId: editRevenue.platformId || getDefaultPlatformId(),
        items: editRevenue.items.map((i) => ({ ...i })),
        discount: editRevenue.discount,
        shippingFee: editRevenue.shippingFee ?? 0,
        shippingPayer: editRevenue.shippingPayer ?? 'customer',
        paymentMethod: editRevenue.paymentMethod,
        paymentStatus: editRevenue.paymentStatus ?? 'unpaid',
        depositAmount: editRevenue.depositAmount ?? 0,
        depositedAt: editRevenue.depositedAt ?? '',
        paidAmount:
          editRevenue.paidAmount ??
          defaultPaidAmount(
            editRevenue.finalAmount,
            editRevenue.depositAmount ?? 0,
          ),
        paidAt: editRevenue.paidAt ?? '',
        notes: editRevenue.notes ?? '',
        orderStatus: editRevenue.orderStatus,
        deliveryStatus: editRevenue.deliveryStatus,
      });
    } else {
      const date = todayISO();
      setForm({
        ...defaultForm,
        date,
        platformId: getDefaultPlatformId(),
        orderCode: buildOrderCode(date, useRevenueStore.getState().records),
        orderCodeManual: false,
        items: [emptyItem()],
      });
    }
  }, [open, editRevenue]);

  // Auto-refresh suggested code when date changes (create mode, not manually edited)
  useEffect(() => {
    if (!open || editRevenue || form.orderCodeManual) return;
    const next = buildOrderCode(form.date, revenues);
    setForm((p) => (p.orderCode === next ? p : { ...p, orderCode: next }));
  }, [form.date, form.orderCodeManual, open, editRevenue, revenues]);

  const handleClose = useCallback(() => {
    onClose();
    setForm({ ...defaultForm, items: [emptyItem()] });
  }, [onClose]);

  /* ─── Auto-calculated totals ─── */
  const totalAmount = useMemo(
    () => form.items.reduce((sum, item) => sum + (item.total || 0), 0),
    [form.items],
  );

  const orderTotals = useMemo(
    () =>
      computeOrderTotals(
        form.items,
        form.discount,
        form.shippingFee,
        form.shippingPayer,
      ),
    [form.items, form.discount, form.shippingFee, form.shippingPayer],
  );

  const finalAmount = orderTotals.finalAmount;

  const remainingAfterDeposit = useMemo(
    () => defaultPaidAmount(finalAmount, form.depositAmount || 0),
    [finalAmount, form.depositAmount],
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
        } else if (field === 'name') {
          updated.name = String(value);
          updated.productId = undefined;
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
    if (!form.customerSearch.trim() || form.customerId) return [];
    const q = form.customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(form.customerSearch) ||
        (c.email?.toLowerCase().includes(q) ?? false),
    ).slice(0, 10);
  }, [customers, form.customerSearch, form.customerId]);

  const handleCustomerSelect = useCallback((id: string) => {
    const name = useCustomerStore.getState().customers.find((c) => c.id === id)?.name ?? '';
    setForm((prev) => ({ ...prev, customerId: id, customerSearch: name }));
  }, []);

  const handleQuickAddCustomer = useCallback(async () => {
    const name = form.customerSearch.trim();
    if (!name) return;
    try {
      const created = await createCustomer({ name, phone: '' });
      setForm((p) => ({ ...p, customerId: created.id, customerSearch: created.name }));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Không thêm được khách');
    }
  }, [form.customerSearch]);

  const pickProduct = useCallback((idx: number, productId: string) => {
    const p = useProductStore.getState().products.find((x) => x.id === productId);
    if (!p) return;
    setForm((prev) => {
      const items = prev.items.map((item) => ({ ...item }));
      const row = items[idx];
      if (!row) return prev;
      const qty = row.quantity || 1;
      // Suggest catalog price only when row has no price yet
      const unitPrice = row.unitPrice > 0 ? row.unitPrice : p.defaultUnitPrice;
      items[idx] = {
        ...row,
        productId: p.id,
        name: p.name,
        unitPrice,
        total: qty * unitPrice,
      };
      return { ...prev, items };
    });
    setActiveProductRow(null);
  }, []);

  const quickAddProduct = useCallback(
    async (idx: number) => {
      const name = form.items[idx]?.name.trim();
      if (!name || name.length < 2) return;
      try {
        const created = await createProduct({
          name,
          defaultUnitPrice: form.items[idx]?.unitPrice || 0,
          unit: 'cái',
        });
        pickProduct(idx, created.id);
      } catch (err) {
        notify.error(err instanceof Error ? err.message : 'Không thêm được SP');
      }
    },
    [form.items, pickProduct],
  );

  /* ─── Submit ─── */

  const handleSubmit = useCallback(async () => {
    /* Validate */
    if (!form.date) return;
    if (!form.customerId) return;
    if (form.items.some((i) => !i.name.trim() || !i.quantity || (i.unitPrice ?? 0) <= 0)) return;

    try {
      const hasDeposit = (form.depositAmount || 0) > 0;
      const paymentPayload = {
        paymentStatus: form.paymentStatus,
        // 0 clears deposit on update
        depositAmount: hasDeposit ? form.depositAmount : 0,
        depositedAt: hasDeposit ? form.depositedAt || todayISO() : undefined,
        paidAt: form.paymentStatus === 'paid' ? form.paidAt || todayISO() : undefined,
        paidAmount:
          form.paymentStatus === 'paid'
            ? form.paidAmount > 0
              ? form.paidAmount
              : remainingAfterDeposit
            : undefined,
      };
      const code = form.orderCode.trim();
      if (!code) {
        notify.error('Vui lòng nhập mã đơn');
        return;
      }
      if (editRevenue) {
        await updateRevenue(editRevenue.id, {
          date: form.date,
          orderCode: code,
          customerId: form.customerId,
          platformId: form.platformId || undefined,
          items: form.items,
          discount: form.discount,
          shippingFee: form.shippingFee || 0,
          shippingPayer: form.shippingPayer,
          orderStatus: form.orderStatus,
          deliveryStatus: form.deliveryStatus,
          paymentMethod: form.paymentMethod,
          ...paymentPayload,
          notes: form.notes || undefined,
        });
      } else {
        await createRevenue({
          date: form.date,
          orderCode: code,
          customerId: form.customerId,
          platformId: form.platformId || getDefaultPlatformId(),
          items: form.items,
          discount: form.discount,
          shippingFee: form.shippingFee || 0,
          shippingPayer: form.shippingPayer,
          orderStatus: form.orderStatus,
          deliveryStatus: form.deliveryStatus,
          paymentMethod: form.paymentMethod,
          ...paymentPayload,
          notes: form.notes || undefined,
        });
      }
      handleClose();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Không lưu được đơn hàng');
    }
  }, [form, editRevenue, handleClose, remainingAfterDeposit]);

  /* ─── Render ─── */

  const isEditing = !!editRevenue;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="w-[min(960px,calc(100vw-2rem))] !max-w-[960px] sm:!max-w-[960px] max-h-[94vh] !flex !flex-col overflow-hidden p-0 gap-0" showCloseButton={false}>
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle>{isEditing ? 'Chỉnh sửa đơn hàng' : 'Tạo đơn hàng mới'}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-4">
          {/* Date + order code + Status row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">Ngày đơn hàng</label>
              <DatePicker
                value={form.date}
                onChange={(v) => setForm((p) => ({ ...p, date: v }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">Mã đơn</label>
              <input
                type="text"
                value={form.orderCode}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    orderCode: e.target.value,
                    orderCodeManual: true,
                  }))
                }
                placeholder="DH-YYYYMMDD-NNN"
                className={
                  'h-8 px-3 text-xs font-mono ' +
                  'bg-input-bg border border-input-border rounded-field ' +
                  'text-text-primary placeholder-input-placeholder ' +
                  'focus:outline-none focus:ring-2 focus:ring-input-focus-ring'
                }
                aria-label="Mã đơn hàng"
              />
              {!editRevenue && !form.orderCodeManual && (
                <p className="text-[10px] text-text-muted">Gợi ý tự động — có thể sửa</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">Trạng thái</label>
              <Dropdown
                options={STATUS_OPTIONS}
                value={form.orderStatus}
                onChange={(v) => setForm((p) => ({ ...p, orderStatus: v as OrderStatus }))}
                aria-label="Trạng thái đơn"
                className="h-8"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">Trạng thái giao</label>
              <Dropdown
                options={DELIVERY_OPTIONS}
                value={form.deliveryStatus}
                onChange={(v) => setForm((p) => ({ ...p, deliveryStatus: v as DeliveryStatus }))}
                aria-label="Trạng thái giao"
                className="h-8"
              />
            </div>
          </div>

          {/* Customer search + quick-add */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">Khách hàng</label>
            {form.customerId ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs bg-success-bg text-success-fg border-success-bg">
                  {form.customerId === 'walk-in'
                    ? 'Khách vãng lai'
                    : (customers.find((c) => c.id === form.customerId)?.name ?? form.customerSearch) || 'Đã chọn'}
                </Badge>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, customerId: '', customerSearch: '' }))}
                  className="text-xs text-text-muted hover:text-text-primary"
                  aria-label="Bỏ chọn khách hàng"
                >
                  ✕ Đổi
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.customerSearch}
                    onChange={(e) => setForm((p) => ({ ...p, customerSearch: e.target.value, customerId: '' }))}
                    placeholder="Tìm tên, SĐT, email khách hàng..."
                    className={
                      'flex-1 h-8 px-3 text-xs ' +
                      'bg-input-bg ' +
                      'border border-input-border rounded-field ' +
                      'text-text-primary placeholder-input-placeholder ' +
                      'focus:outline-none focus:ring-2 focus:ring-input-focus-ring ' +
                      'transition-colors duration-[var(--d-fast)]'
                    }
                    aria-label="Tìm khách hàng"
                  />
                  {form.customerSearch.trim() && (
                    <Button variant="secondary" size="xs" onClick={handleQuickAddCustomer}>
                      <Plus size={12} /> Thêm nhanh
                    </Button>
                  )}
                </div>
                {customerOptions.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border border-border-subtle rounded-field bg-surface">
                    {customerOptions.map((c) => (
                      <div
                        key={c.id}
                        className="px-3 py-1.5 text-xs cursor-pointer hover:bg-surface-hover transition-colors"
                        onClick={() => handleCustomerSelect(c.id)}
                        role="option"
                        aria-selected={false}
                      >
                        <span className="font-medium text-text-primary">{c.name}</span>
                        {c.phone ? <span className="text-text-muted ml-2">— {c.phone}</span> : null}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Items sub-table */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-text-muted">Sản phẩm / Dịch vụ</label>
              <Button variant="secondary" size="xs" onClick={addItem}>
                <Plus size={12} /> Thêm dòng
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
                  {form.items.map((item, idx) => {
                    const suggestions =
                      activeProductRow === idx && item.name.trim().length >= 1 && !item.productId
                        ? searchProducts(item.name, 8)
                        : [];
                    return (
                    <tr key={item.id} className="border-b border-border-subtle">
                      <td className="py-1 px-2 relative">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItem(idx, 'name', e.target.value)}
                          onFocus={() => setActiveProductRow(idx)}
                          onBlur={() => {
                            // delay so click on suggestion registers
                            window.setTimeout(() => {
                              setActiveProductRow((cur) => (cur === idx ? null : cur));
                            }, 150);
                          }}
                          placeholder="Gõ để chọn SP..."
                          className={
                            'w-full h-7 px-2 text-xs ' +
                            'bg-input-bg ' +
                            'border border-input-border rounded-field ' +
                            'text-text-primary ' +
                            'focus:outline-none focus:ring-2 focus:ring-input-focus-ring'
                          }
                          aria-label={`Tên sản phẩm dòng ${idx + 1}`}
                        />
                        {suggestions.length > 0 && (
                          <div className="absolute z-20 left-2 right-2 top-full mt-0.5 max-h-36 overflow-y-auto border border-border-subtle rounded-field bg-surface shadow-md">
                            {suggestions.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className="w-full text-left px-2 py-1.5 text-[11px] hover:bg-surface-hover"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => pickProduct(idx, p.id)}
                              >
                                <span className="font-medium">{p.name}</span>
                                <span className="text-text-muted ml-1">
                                  {formatCurrency(p.defaultUnitPrice)}/{p.unit}
                                </span>
                              </button>
                            ))}
                            {item.name.trim().length >= 2 &&
                              !products.some(
                                (p) => p.name.toLowerCase() === item.name.trim().toLowerCase(),
                              ) && (
                                <button
                                  type="button"
                                  className="w-full text-left px-2 py-1.5 text-[11px] text-accent-fg hover:bg-surface-hover border-t border-border-subtle"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => void quickAddProduct(idx)}
                                >
                                  + Thêm SP “{item.name.trim()}” vào catalog
                                </button>
                              )}
                          </div>
                        )}
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
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Auto-calculated totals */}
            <div className="flex flex-col items-end gap-1.5 pt-3 border-t border-border-subtle">
              <div className="flex justify-between items-center gap-8 text-xs w-full max-w-[260px]">
                <span className="text-text-muted">Tổng tiền</span>
                <span className="text-text-primary font-mono">{formatCurrency(totalAmount)}</span>
              </div>

              <div className="flex justify-between items-center gap-8 text-xs w-full max-w-[260px]">
                <span className="text-text-muted">Giảm giá</span>
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
                    'w-[110px] h-7 px-2 text-xs text-right ' +
                    'bg-input-bg ' +
                    'border border-input-border rounded-field ' +
                    'text-text-primary font-mono ' +
                    'focus:outline-none focus:ring-2 focus:ring-input-focus-ring'
                  }
                  aria-label="Số tiền giảm giá"
                />
              </div>

              <div className="flex justify-between items-center gap-8 text-xs w-full max-w-[260px]">
                <span className="text-text-muted">Phí ship</span>
                <input
                  type="text"
                  value={form.shippingFee > 0 ? formatCurrencyInput(String(form.shippingFee)) : ''}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      shippingFee: Math.max(0, parseCurrency(e.target.value) || 0),
                    }))
                  }
                  placeholder="0"
                  className={
                    'w-[110px] h-7 px-2 text-xs text-right ' +
                    'bg-input-bg ' +
                    'border border-input-border rounded-field ' +
                    'text-text-primary font-mono ' +
                    'focus:outline-none focus:ring-2 focus:ring-input-focus-ring'
                  }
                  aria-label="Phí ship"
                />
              </div>

              {form.shippingFee > 0 && (
                <div className="flex justify-between items-center gap-8 text-xs w-full max-w-[260px]">
                  <span className="text-text-muted">Người chịu ship</span>
                  <div className="w-[140px]">
                    <Dropdown
                      options={SHIPPING_PAYER_OPTIONS}
                      value={form.shippingPayer}
                      onChange={(v) =>
                        setForm((p) => ({ ...p, shippingPayer: v as ShippingPayer }))
                      }
                      aria-label="Người chịu phí ship"
                      className="h-7"
                    />
                  </div>
                </div>
              )}

              {form.shippingFee > 0 && (
                <p className="text-[11px] text-text-muted w-full max-w-[260px] text-right">
                  {form.shippingPayer === 'shop'
                    ? 'Shop chịu → ghi chi phí vận chuyển'
                    : 'Khách chịu → cộng vào thành tiền đơn'}
                </p>
              )}

              <div className="flex justify-between items-center gap-8 text-sm w-full max-w-[260px] border-t border-border-subtle pt-2">
                <span className="font-semibold text-text-primary">Thành tiền</span>
                <span className="font-bold text-accent-fg font-mono">{formatCurrency(finalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Payment status + method + platform */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">Nền tảng đặt hàng</label>
              <Dropdown
                options={
                  platformOptions.length
                    ? platformOptions
                    : [{ value: getDefaultPlatformId(), label: 'Trực tiếp' }]
                }
                value={form.platformId || getDefaultPlatformId()}
                onChange={(v) => setForm((p) => ({ ...p, platformId: v }))}
                aria-label="Nền tảng đặt hàng"
                className="h-8"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">Thanh toán</label>
              <Dropdown
                options={PAYMENT_STATUS_OPTIONS}
                value={form.paymentStatus}
                onChange={(v) => {
                  const next = v as PaymentStatus;
                  setForm((p) => {
                    const rem = defaultPaidAmount(finalAmount, p.depositAmount || 0);
                    return {
                      ...p,
                      paymentStatus: next,
                      paidAt: next === 'paid' ? p.paidAt || todayISO() : '',
                      paidAmount: next === 'paid' ? (p.paidAmount > 0 ? p.paidAmount : rem) : 0,
                    };
                  });
                }}
                aria-label="Trạng thái thanh toán"
                className="h-8"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">Phương thức</label>
              <Dropdown
                options={PAYMENT_METHOD_OPTIONS}
                value={form.paymentMethod}
                onChange={(v) => setForm((p) => ({ ...p, paymentMethod: v as PaymentMethod }))}
                aria-label="Phương thức thanh toán"
                className="h-8"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">Tiền cọc</label>
              <input
                type="text"
                inputMode="numeric"
                className="h-8 rounded-md border border-border-subtle bg-surface px-2 text-sm font-mono"
                value={form.depositAmount > 0 ? formatCurrencyInput(String(form.depositAmount)) : ''}
                placeholder="0"
                onChange={(e) => {
                  const n = parseCurrency(e.target.value) || 0;
                  setForm((p) => {
                    const depositAmount = Math.min(Math.max(0, n), finalAmount || n);
                    const rem = defaultPaidAmount(finalAmount, depositAmount);
                    return {
                      ...p,
                      depositAmount,
                      depositedAt:
                        depositAmount > 0 ? p.depositedAt || todayISO() : '',
                      paidAmount:
                        p.paymentStatus === 'paid' &&
                        (p.paidAmount === 0 ||
                          p.paidAmount === defaultPaidAmount(finalAmount, p.depositAmount || 0))
                          ? rem
                          : p.paidAmount,
                    };
                  });
                }}
                aria-label="Số tiền cọc"
              />
            </div>
            {(form.depositAmount || 0) > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-muted">Ngày cọc</label>
                <DatePicker
                  value={form.depositedAt || todayISO()}
                  onChange={(v) => setForm((p) => ({ ...p, depositedAt: v }))}
                />
              </div>
            )}
            {form.paymentStatus === 'paid' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-text-muted">Ngày thanh toán</label>
                  <DatePicker
                    value={form.paidAt || todayISO()}
                    onChange={(v) => setForm((p) => ({ ...p, paidAt: v }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-text-muted">
                    Số thanh toán
                    <span className="ml-1 font-normal text-text-muted">
                      (mặc định còn {formatCurrency(remainingAfterDeposit)})
                    </span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="h-8 rounded-md border border-border-subtle bg-surface px-2 text-sm font-mono"
                    value={form.paidAmount > 0 ? formatCurrencyInput(String(form.paidAmount)) : ''}
                    placeholder={formatCurrencyInput(String(remainingAfterDeposit))}
                    onChange={(e) => {
                      const n = parseCurrency(e.target.value) || 0;
                      setForm((p) => ({ ...p, paidAmount: Math.max(0, n) }));
                    }}
                    aria-label="Số tiền thanh toán"
                  />
                </div>
              </>
            )}
          </div>

          <p className="text-xs text-text-muted">
            {(form.depositAmount || 0) > 0 && (
              <>Đã cọc {formatCurrency(form.depositAmount)}</>
            )}
            {(form.depositAmount || 0) > 0 && form.paymentStatus === 'paid' && ' · '}
            {form.paymentStatus === 'paid' && (
              <>Đã TT {formatCurrency(form.paidAmount || remainingAfterDeposit)}</>
            )}
            {form.paymentStatus !== 'paid' && (
              <>
                {(form.depositAmount || 0) > 0 ? ' · ' : ''}
                Còn {formatCurrency(remainingAfterDeposit)}
              </>
            )}
          </p>

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
        </div>
        <DialogFooter className="px-6 py-3 border-t border-border shrink-0 bg-muted/30">
          <Button variant="outline" onClick={handleClose}><X size={14} /> Hủy</Button>
          <Button variant="default" onClick={handleSubmit}>
            {isEditing ? <><Check size={14} /> Cập nhật</> : <><Plus size={14} /> Tạo đơn</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
