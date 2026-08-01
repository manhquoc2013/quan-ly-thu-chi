/**
 * Customer (Khách hàng) — data type.
 * See docs/02-data-models.md § 4
 */

export interface Customer {
  /** UUID v4 */
  id: string;

  /** Họ tên khách hàng (2–100 ký tự) */
  name: string;

  /** Số điện thoại (bắt buộc, regex: ^(0|\+84)[0-9]{9,10}$) */
  phone: string;

  /** Email (tùy chọn, nếu có: regex email chuẩn) */
  email?: string;

  /** Địa chỉ (tùy chọn, 5–200 ký tự) */
  address?: string;

  /** Thời điểm tạo (ISO 8601) */
  createdAt: string;
}
