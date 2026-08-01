/**
 * OrderPlatform — catalog of order channels / marketplaces.
 */

export interface OrderPlatform {
  /** UUID v4 (seeded defaults use stable ids) */
  id: string;

  /** Tên hiển thị (2–80 ký tự) */
  name: string;

  /** Mã nội bộ (unique, optional) e.g. direct, shopee */
  code?: string;

  /** Đang dùng trong dropdown tạo đơn */
  active: boolean;

  /** Thời điểm tạo */
  createdAt: string;
}

/** Stable id for default “Trực tiếp” platform */
export const PLATFORM_DIRECT_ID = 'platform-direct';

export const DEFAULT_PLATFORM_SEEDS: Array<Omit<OrderPlatform, 'createdAt'>> = [
  { id: PLATFORM_DIRECT_ID, name: 'Trực tiếp', code: 'direct', active: true },
  { id: 'platform-facebook', name: 'Facebook', code: 'facebook', active: true },
  { id: 'platform-zalo', name: 'Zalo', code: 'zalo', active: true },
  { id: 'platform-shopee', name: 'Shopee', code: 'shopee', active: true },
  { id: 'platform-tiktok', name: 'TikTok', code: 'tiktok', active: true },
  { id: 'platform-website', name: 'Website', code: 'website', active: true },
  { id: 'platform-other', name: 'Khác', code: 'other', active: true },
];
