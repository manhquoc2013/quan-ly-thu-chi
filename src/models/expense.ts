/**
 * Expense (Chi phí) — data types and labels.
 * See docs/02-data-models.md § 2
 */

// ── Enumerations ──────────────────────────────────────────────────────────────

export type ExpenseCategory =
  | 'office'          // Văn phòng phẩm
  | 'rent'            // Thuê mặt bằng
  | 'utilities'       // Điện, nước, internet
  | 'salary'          // Lương nhân viên
  | 'marketing'       // Marketing, quảng cáo
  | 'supplies'        // Nguyên vật liệu
  | 'transportation'  // Vận chuyển, xăng xe
  | 'maintenance'     // Bảo trì, sửa chữa
  | 'tax'             // Thuế, phí
  | 'other';          // Khác

export type ExpenseStatus =
  | 'pending'         // Chờ thanh toán
  | 'paid'            // Đã thanh toán
  | 'cancelled';      // Đã hủy

export type PaymentMethod =
  | 'cash'            // Tiền mặt
  | 'bank_transfer'   // Chuyển khoản
  | 'credit_card'     // Thẻ tín dụng
  | 'e_wallet';       // Ví điện tử

// ── Entity ────────────────────────────────────────────────────────────────────

export interface Expense {
  /** UUID v4 */
  id: string;

  /** Ngày phát sinh chi phí (ISO 8601 date-only: "2026-07-15") */
  date: string;

  /** Danh mục chi phí */
  category: ExpenseCategory;

  /** Số tiền (VND, không âm) — stored as integer to avoid float rounding */
  amount: number;

  /** Mô tả ngắn gọn (5–500 ký tự) */
  description: string;

  /** Trạng thái thanh toán */
  status: ExpenseStatus;

  /** Google Drive file ID của ảnh hóa đơn (nếu có) */
  invoiceImageId?: string;

  /** Phương thức thanh toán */
  paymentMethod: PaymentMethod;

  /** Nhà cung cấp / người nhận (tùy chọn) */
  supplier?: string;

  /** Ghi chú thêm (tùy chọn) */
  notes?: string;

  /** Tags để phân loại thêm (2–30 ký tự, tối đa 10) */
  tags: string[];

  /** FK → Product khi chi phí là nhập hàng (cộng tồn) */
  stockProductId?: string;

  /** Số lượng đã cộng vào tồn khi tạo phiếu nhập (không đổi khi sửa SL) */
  stockQtyIn?: number;

  /** true khi đã cộng tồn cho phiếu này */
  stockApplied?: boolean;

  /** Thời điểm tạo bản ghi (ISO 8601) */
  createdAt: string;

  /** Thời điểm cập nhật gần nhất (ISO 8601) */
  updatedAt: string;
}

// ── Vietnamese labels ─────────────────────────────────────────────────────────

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  office: 'Văn phòng phẩm',
  rent: 'Thuê mặt bằng',
  utilities: 'Điện, nước, internet',
  salary: 'Lương nhân viên',
  marketing: 'Marketing, quảng cáo',
  supplies: 'Nguyên vật liệu',
  transportation: 'Vận chuyển, xăng xe',
  maintenance: 'Bảo trì, sửa chữa',
  tax: 'Thuế, phí',
  other: 'Khác',
};

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  cancelled: 'Đã hủy',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  credit_card: 'Thẻ tín dụng',
  e_wallet: 'Ví điện tử',
};
