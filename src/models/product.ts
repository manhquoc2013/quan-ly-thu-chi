/**
 * Product (Sản phẩm) — catalog entity.
 */

export interface Product {
  /** UUID v4 */
  id: string;

  /** Tên sản phẩm / dịch vụ (2–100 ký tự) */
  name: string;

  /** Đơn giá mặc định (VND, ≥ 0) — chỉ là gợi ý khi tạo đơn */
  defaultUnitPrice: number;

  /** Đơn vị tính (vd: cái, kg, hộp) */
  unit: string;

  /** Mã SKU (tuỳ chọn) */
  sku?: string;

  /** Ghi chú (tuỳ chọn) */
  notes?: string;

  /** Đường dẫn ảnh trên Supabase Storage (tuỳ chọn) */
  imagePath?: string;

  /** Thời điểm tạo (ISO 8601) */
  createdAt: string;
}
