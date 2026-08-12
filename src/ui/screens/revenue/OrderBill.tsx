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
}

export function OrderBill({ revenue, customerName, store, className = '' }: OrderBillProps) {
  const deposit = getDepositAmount(revenue);
  const remaining = getRemainingBalance(revenue);
  const ship = revenue.shippingFee ?? 0;

  return (
    <article
      id="order-bill-print-root"
      className={`order-bill ${className}`.trim()}
      aria-label={`Phiếu đơn ${revenue.orderCode}`}
    >
      <header className="order-bill__header">
        <p className="order-bill__brand">{store.storeName || 'Cửa hàng'}</p>
        {(store.phone || store.address) && (
          <p className="order-bill__meta">
            {[store.phone, store.address].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className="order-bill__rule" />
      </header>

      <div className="order-bill__identity">
        <p className="order-bill__code">{revenue.orderCode}</p>
        <p className="order-bill__date">{revenue.date}</p>
      </div>

      <p className="order-bill__customer">
        <span className="order-bill__label">Khách</span>
        {customerName}
      </p>

      <table className="order-bill__items">
        <thead>
          <tr>
            <th scope="col">Món</th>
            <th scope="col" className="num">
              SL
            </th>
            <th scope="col" className="num">
              Đơn giá
            </th>
            <th scope="col" className="num">
              TT
            </th>
          </tr>
        </thead>
        <tbody>
          {revenue.items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td className="num">{item.quantity}</td>
              <td className="num">{formatCurrency(item.unitPrice)}</td>
              <td className="num">{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="order-bill__totals">
        <div className="order-bill__row">
          <span>Tạm tính</span>
          <span className="num">{formatCurrency(revenue.totalAmount)}</span>
        </div>
        {revenue.discount > 0 && (
          <div className="order-bill__row">
            <span>Giảm giá</span>
            <span className="num">−{formatCurrency(revenue.discount)}</span>
          </div>
        )}
        {ship > 0 && (
          <div className="order-bill__row">
            <span>Ship</span>
            <span className="num">{formatCurrency(ship)}</span>
          </div>
        )}
        <div className="order-bill__row order-bill__row--hero">
          <span>Thành tiền</span>
          <span className="num">{formatCurrency(revenue.finalAmount)}</span>
        </div>
      </div>

      <div className="order-bill__pay">
        <p>
          Thanh toán: {PAYMENT_STATUS_LABELS[revenue.paymentStatus] ?? revenue.paymentStatus}
        </p>
        {deposit > 0 && (
          <p>
            Đã cọc {formatCurrency(deposit)}
            {remaining > 0 ? ` · Còn ${formatCurrency(remaining)}` : ''}
          </p>
        )}
      </div>

      {revenue.notes?.trim() ? (
        <p className="order-bill__notes">{revenue.notes.trim()}</p>
      ) : null}

      <footer className="order-bill__footer">Cảm ơn quý khách!</footer>
    </article>
  );
}
