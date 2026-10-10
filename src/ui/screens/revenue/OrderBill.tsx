/**
 * OrderBill — A6 (105×148mm) printable order slip. Ink-first, modern.
 */

import type { Revenue } from '@/models';
import { PAYMENT_STATUS_LABELS } from '@/models';
import { formatCurrency } from '@/utils/currency';
import {
  getDepositAmount,
  getRemainingBalance,
} from '@/utils/revenueMetrics';

export interface OrderBillStoreInfo {
  storeName: string;
  phone?: string;
  address?: string;
}

export interface OrderBillProps {
  revenue: Revenue;
  customerName: string;
  store: OrderBillStoreInfo;
  /** Extra class for on-screen preview card */
  className?: string;
  /** When true, marks the DOM node used by @media print */
  forPrint?: boolean;
}

export function OrderBill({
  revenue,
  customerName,
  store,
  className = '',
  forPrint = false,
}: OrderBillProps) {
  const deposit = getDepositAmount(revenue);
  const remaining = getRemainingBalance(revenue);
  const ship = revenue.shippingFee ?? 0;
  const isPaid = revenue.paymentStatus === 'paid';
  const isPartial = deposit > 0 && remaining > 0;

  return (
    <article
      id={forPrint ? 'order-bill-print-root' : undefined}
      className={`order-bill ${className}`.trim()}
      aria-label={`Phiếu đơn ${revenue.orderCode}`}
    >
      <header className="order-bill__header">
        <div className="flex justify-between items-start">
          <div className="min-w-0 flex-1">
            <p className="order-bill__brand">{store.storeName || 'Cửa hàng'}</p>
            {(store.phone || store.address) && (
              <p className="order-bill__meta">
                {[store.phone, store.address].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          {/* Status stamp */}
          <div
            className={[
              'order-bill__stamp shrink-0',
              isPaid
                ? 'order-bill__stamp--paid'
                : isPartial
                  ? 'order-bill__stamp--partial'
                  : 'order-bill__stamp--unpaid',
            ].join(' ')}
          >
            {isPaid ? 'ĐÃ THANH TOÁN' : isPartial ? 'ĐÃ CỌC' : 'CHƯA THANH TOÁN'}
          </div>
        </div>
        <div className="order-bill__rule" />
      </header>

      <div className="order-bill__identity">
        <div>
          <p className="order-bill__code">{revenue.orderCode}</p>
          <p className="order-bill__date">Ngày tạo: {revenue.date}</p>
        </div>
      </div>

      <div className="order-bill__customer-box">
        <span className="order-bill__label">Khách hàng:</span>
        <span className="font-semibold">{customerName}</span>
      </div>

      <table className="order-bill__items">
        <thead>
          <tr>
            <th scope="col">Tên món</th>
            <th scope="col" className="num">
              SL
            </th>
            <th scope="col" className="num">
              Đơn giá
            </th>
            <th scope="col" className="num">
              Thành tiền
            </th>
          </tr>
        </thead>
        <tbody>
          {revenue.items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td className="num">{item.quantity}</td>
              <td className="num">{formatCurrency(item.unitPrice)}</td>
              <td className="num font-semibold">{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="order-bill__totals">
        <div className="order-bill__row">
          <span>Tạm tính ({revenue.items.reduce((s, i) => s + i.quantity, 0)} món)</span>
          <span className="num">{formatCurrency(revenue.totalAmount)}</span>
        </div>
        {revenue.discount > 0 && (
          <div className="order-bill__row">
            <span>Chiết khấu / Giảm giá</span>
            <span className="num">−{formatCurrency(revenue.discount)}</span>
          </div>
        )}
        {ship > 0 && (
          <div className="order-bill__row">
            <span>Phí vận chuyển</span>
            <span className="num">{formatCurrency(ship)}</span>
          </div>
        )}
        <div className="order-bill__row order-bill__row--hero">
          <span>Tổng thanh toán</span>
          <span className="num">{formatCurrency(revenue.finalAmount)}</span>
        </div>
      </div>

      <div className="order-bill__pay">
        <div className="flex justify-between items-center py-0.5">
          <span>Trạng thái:</span>
          <span className="font-medium text-text-primary">
            {PAYMENT_STATUS_LABELS[revenue.paymentStatus] ?? revenue.paymentStatus}
          </span>
        </div>
        {deposit > 0 && (
          <div className="flex justify-between items-center py-0.5">
            <span>Tiền đã cọc:</span>
            <span className="num font-medium text-text-primary">{formatCurrency(deposit)}</span>
          </div>
        )}
        {remaining > 0 && deposit > 0 && (
          <div className="flex justify-between items-center py-0.5 font-bold text-text-primary">
            <span>Còn phải thu:</span>
            <span className="num">{formatCurrency(remaining)}</span>
          </div>
        )}
      </div>

      {revenue.notes?.trim() ? (
        <p className="order-bill__notes">
          <span className="font-medium">Ghi chú: </span>
          {revenue.notes.trim()}
        </p>
      ) : null}

      {/* QR Code and Footer note */}
      <div className="order-bill__qr-section">
        <svg
          className="order-bill__qr-svg"
          viewBox="0 0 45 45"
          width="42"
          height="42"
          fill="currentColor"
          aria-hidden="true"
        >
          {/* Stylized QR Matrix */}
          <rect x="2" y="2" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <rect x="5.5" y="5.5" width="6" height="6" fill="currentColor" />
          <rect x="30" y="2" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <rect x="33.5" y="5.5" width="6" height="6" fill="currentColor" />
          <rect x="2" y="30" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <rect x="5.5" y="33.5" width="6" height="6" fill="currentColor" />
          <rect x="20" y="4" width="4" height="4" fill="currentColor" />
          <rect x="20" y="12" width="4" height="4" fill="currentColor" />
          <rect x="20" y="20" width="4" height="4" fill="currentColor" />
          <rect x="12" y="20" width="4" height="4" fill="currentColor" />
          <rect x="28" y="20" width="4" height="4" fill="currentColor" />
          <rect x="20" y="28" width="4" height="4" fill="currentColor" />
          <rect x="20" y="36" width="4" height="4" fill="currentColor" />
          <rect x="28" y="30" width="6" height="4" fill="currentColor" />
          <rect x="36" y="26" width="5" height="5" fill="currentColor" />
          <rect x="30" y="36" width="11" height="5" fill="currentColor" />
        </svg>
        <div className="text-[8px] text-text-muted leading-tight">
          <p className="font-semibold text-text-primary uppercase tracking-wide">Quét mã kiểm tra đơn</p>
          <p className="font-mono">{revenue.orderCode}</p>
        </div>
      </div>

      <footer className="order-bill__footer">
        <p className="order-bill__thanks">Cảm ơn & Hẹn gặp lại Quý khách!</p>
      </footer>
    </article>
  );
}
