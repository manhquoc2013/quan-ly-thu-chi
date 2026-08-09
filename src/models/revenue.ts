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

export type PaymentStatus =
  | 'unpaid'          // Chưa thanh toán
  | 'paid';           // Đã thanh toán

/** Ai chịu phí ship: khách (cộng vào đơn) | shop (ghi chi phí) */
export type ShippingPayer = 'customer' | 'shop';

// ── Entities ──────────────────────────────────────────────────────────────────

export interface OrderItem {
  /** UUID v4 */
  id: string;

  /** FK → Product (optional; legacy lines may omit) */
  productId?: string;

  /** Tên sản phẩm/dịch vụ */
  name: string;

  /** Số lượng (≥ 1) */
  quantity: number;

  /** Đơn giá (VND) (> 0) — giá thực tế trên đơn, có thể khác default catalog */
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

  /** Trạng thái thu tiền */
  paymentStatus: PaymentStatus;

  /** Số tiền đã cọc (VND); cặp với depositedAt */
  depositAmount?: number;

  /** Ngày cọc (yyyy-MM-dd); bắt buộc khi depositAmount > 0 */
  depositedAt?: string;

  /** Số tiền ghi nhận doanh thu ngày thanh toán; mặc định = còn lại sau cọc */
  paidAmount?: number;

  /** Ngày thanh toán (yyyy-MM-dd); bắt buộc khi paymentStatus = paid */
  paidAt?: string;

  /** Phí ship (VND); 0 / thiếu = không có ship */
  shippingFee?: number;

  /** Người chịu ship; mặc định customer khi shippingFee > 0 */
  shippingPayer?: ShippingPayer;

  /** FK → Expense khi shop chịu ship */
  shippingExpenseId?: string;

  /** FK → OrderPlatform (kênh / nền tảng đặt hàng) */
  platformId?: string;

  /** Ghi chú (tùy chọn) */
  notes?: string;

  /** true khi đã trừ tồn kho cho đơn (paid, chưa huỷ) */
  stockApplied?: boolean;

  /** Đơn ưu tiên — đẩy lên đầu danh sách / dashboard */
  priority?: boolean;

  /** Thời điểm gắn ưu tiên (ISO); dùng để sort ổn định giữa các đơn ưu tiên */
  priorityAt?: string;

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

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Chưa thanh toán',
  paid: 'Đã thanh toán',
};

export const SHIPPING_PAYER_LABELS: Record<ShippingPayer, string> = {
  customer: 'Khách chịu',
  shop: 'Shop chịu',
};
