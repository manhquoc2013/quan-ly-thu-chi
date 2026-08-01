/**
 * Revenue / Order (Doanh thu / Đơn hàng) — data types and labels.
 * See docs/02-data-models.md § 3
 *
 * Re-exports PaymentMethod from expense.ts for use across revenue and expense.
 */

import { type PaymentMethod } from './expense';

// ── Enumerations ──────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'new'             // Mới tạo
  | 'confirmed'       // Đã xác nhận
  | 'processing'      // Đang xử lý
  | 'completed'       // Hoàn thành
  | 'cancelled';      // Đã hủy

export type DeliveryStatus =
  | 'pending'         // Chờ giao
  | 'shipping'        // Đang giao
  | 'delivered'       // Đã giao
  | 'returned';       // Hoàn trả

// ── Entities ──────────────────────────────────────────────────────────────────

export interface OrderItem {
  /** UUID v4 */
  id: string;

  /** Tên sản phẩm/dịch vụ */
  name: string;

  /** Số lượng (≥ 1) */
  quantity: number;

  /** Đơn giá (VND) (> 0) */
  unitPrice: number;

  /** Thành tiền = quantity × unitPrice (tự tính) */
  total: number;
}

export interface Revenue {
  /** UUID v4 */
  id: string;

  /** Ngày tạo đơn (ISO 8601 date-only) */
  date: string;

  /** Mã đơn hàng hiển thị (tự sinh: DH-YYYYMMDD-NNN) */
  orderCode: string;

  /** ID khách hàng (FK → Customer) */
  customerId: string;

  /** Danh sách sản phẩm (ít nhất 1 item) */
  items: OrderItem[];

  /** Tổng tiền trước giảm giá (tự tính = sum(items.total)) */
  totalAmount: number;

  /** Giảm giá (VND, ≥ 0, ≤ totalAmount) */
  discount: number;

  /** Tổng sau giảm giá (tự tính = totalAmount - discount) */
  finalAmount: number;

  /** Trạng thái đơn hàng */
  orderStatus: OrderStatus;

  /** Trạng thái giao hàng */
  deliveryStatus: DeliveryStatus;

  /** Phương thức thanh toán */
  paymentMethod: PaymentMethod;

  /** Ghi chú (tùy chọn) */
  notes?: string;

  /** Thời điểm tạo */
  createdAt: string;

  /** Thời điểm cập nhật */
  updatedAt: string;
}

// ── Vietnamese labels ─────────────────────────────────────────────────────────

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Mới tạo',
  confirmed: 'Đã xác nhận',
  processing: 'Đang xử lý',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: 'Chờ giao',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  returned: 'Hoàn trả',
};
