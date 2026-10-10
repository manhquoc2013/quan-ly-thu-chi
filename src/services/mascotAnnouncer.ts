/**
 * Mascot Announcer — Voice announcements for store and order events.
 *
 * Automatically announces in Vietnamese when:
 * - A new order is created
 * - An order is marked as completed
 */

import { useMascotStore } from '@/store/mascotStore';
import type { Revenue } from '@/models';

const recentAnnouncements = new Map<string, number>();

function isRecent(key: string): boolean {
  const now = Date.now();
  const last = recentAnnouncements.get(key);
  if (last && now - last < 4000) {
    return true;
  }
  recentAnnouncements.set(key, now);
  if (recentAnnouncements.size > 100) {
    for (const [k, time] of recentAnnouncements) {
      if (now - time > 10000) recentAnnouncements.delete(k);
    }
  }
  return false;
}

function formatVndSpoken(amount?: number): string {
  if (!amount || amount <= 0) return '0 đồng';
  if (amount >= 1_000_000) {
    const tr = Math.round(amount / 1_000_000 * 10) / 10;
    return `${tr} triệu đồng`;
  }
  if (amount >= 1_000) {
    const k = Math.round(amount / 1_000);
    return `${k} nghìn đồng`;
  }
  return `${amount} đồng`;
}

export const mascotAnnouncer = {
  /**
   * Announce newly created order in Vietnamese.
   */
  notifyNewOrder(order: Revenue): void {
    const store = useMascotStore.getState();
    if (!store.voiceEnabled || store.announceOrders === false) return;
    if (order.id && isRecent(`new:${order.id}`)) return;

    const amountStr = formatVndSpoken(order.finalAmount);
    const code = order.orderCode ? `mã ${order.orderCode}` : 'mới';
    const lines = [
      `Chủ tiệm ơi! Có đơn hàng mới ${code}, trị giá ${amountStr} nè! Chúc quán đắt khách nha!`,
      `Ting ting! Đơn hàng mới ${code} vừa tới nè, giá trị ${amountStr}. Mau chuẩn bị hàng thôi!`,
      `Lucy báo cáo: Đơn hàng mới ${code} trị giá ${amountStr} đã được tạo thành công! May mắn ngập tràn nhé!`,
    ];
    const line = lines[Math.floor(Math.random() * lines.length)]!;
    store.speak(line, 'celebrate', { forceVoice: true });
  },

  /**
   * Announce completed order in Vietnamese.
   */
  notifyOrderCompleted(order: Revenue): void {
    const store = useMascotStore.getState();
    if (!store.voiceEnabled || store.announceOrders === false) return;
    if (order.id && isRecent(`completed:${order.id}`)) return;

    const code = order.orderCode ? `mã ${order.orderCode}` : 'này';
    const amountStr = formatVndSpoken(order.finalAmount);
    const lines = [
      `Tuyệt vời quá! Đơn hàng ${code} trị giá ${amountStr} đã hoàn thành rồi nè! Tiền về đầy túi nha chủ tiệm!`,
      `Hoan hô! Đơn ${code} đã hoàn thành xuất sắc! Thêm một giao dịch thành công rực rỡ!`,
      `Chúc mừng chủ tiệm! Đơn hàng ${code} đã giao xong xuôi rồi nhé! Hôm nay bội thu nha!`,
    ];
    const line = lines[Math.floor(Math.random() * lines.length)]!;
    store.speak(line, 'celebrate', { forceVoice: true });
  },
};
