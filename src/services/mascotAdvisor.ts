/**
 * mascotAdvisor — Financial intelligence engine for Lucy the Cat.
 * Analyzes today's revenue, expenses, and pending payments to provide instant
 * audio/visual advice to the shop owner.
 */

import { getAllRevenues } from '@/services/revenueService';
import { getAllExpenses } from '@/services/expenseService';
import { computeOrderTotals } from '@/utils/orderTotals';

export interface TodayFinancialSummary {
  revenueToday: number;
  expenseToday: number;
  orderCountToday: number;
  profitToday: number;
  unpaidOrdersCount: number;
  unpaidDebtAmount: number;
  adviceMessage: string;
  adviceEmotion: 'happy' | 'celebrate' | 'warning' | 'thinking';
}

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getTodayFinancialSummary(): Promise<TodayFinancialSummary> {
  const todayStr = getTodayString();
  const [revenues, expenses] = await Promise.all([
    getAllRevenues(),
    getAllExpenses(),
  ]);

  let revenueToday = 0;
  let orderCountToday = 0;
  let unpaidOrdersCount = 0;
  let unpaidDebtAmount = 0;

  for (const r of revenues) {
    const isToday = r.date && r.date.startsWith(todayStr);
    const orderTotal =
      r.finalAmount ??
      computeOrderTotals(
        r.items ?? [],
        r.discount ?? 0,
        r.shippingFee,
        r.shippingPayer,
      ).finalAmount;

    if (isToday) {
      revenueToday += orderTotal;
      orderCountToday += 1;
    }

    // Check unpaid debt
    const paid = (r.depositAmount ?? 0) + (r.paidAmount ?? 0);
    const remaining = Math.max(0, orderTotal - paid);
    if (r.paymentStatus !== 'paid' && remaining > 0) {
      unpaidOrdersCount += 1;
      unpaidDebtAmount += remaining;
    }
  }

  let expenseToday = 0;
  for (const e of expenses) {
    if (e.date && e.date.startsWith(todayStr)) {
      expenseToday += Number(e.amount) || 0;
    }
  }

  const profitToday = revenueToday - expenseToday;

  const fmt = (v: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(v);

  let adviceMessage = '';
  let adviceEmotion: 'happy' | 'celebrate' | 'warning' | 'thinking' = 'happy';

  if (revenueToday > 0 && profitToday > 0) {
    adviceEmotion = 'celebrate';
    adviceMessage = `Hôm nay tiệm thu ${fmt(revenueToday)}, lãi tạm tính ${fmt(profitToday)}! Quá xuất sắc luôn chủ tiệm ơi! 🎉`;
  } else if (expenseToday > revenueToday && expenseToday > 0) {
    adviceEmotion = 'warning';
    adviceMessage = `Hôm nay chi ${fmt(expenseToday)}, đang cao hơn doanh thu. Nhớ cân nhắc kỹ trước các khoản mua sắm mới nhé! ⚠️`;
  } else if (unpaidOrdersCount > 0 && unpaidDebtAmount > 0) {
    adviceEmotion = 'thinking';
    adviceMessage = `Có ${unpaidOrdersCount} đơn còn nợ (${fmt(unpaidDebtAmount)}). Cuối ngày chủ tiệm nhắn nhắc nhẹ khách nha! 🧾`;
  } else if (orderCountToday > 0) {
    adviceEmotion = 'happy';
    adviceMessage = `Hôm nay đã có ${orderCountToday} đơn mới vào sổ! Tiếp tục giữ vững phong độ nào! ✨`;
  } else {
    adviceEmotion = 'happy';
    adviceMessage = 'Sẵn sàng một ngày kinh doanh hồng phát! Có phát sinh thu chi gì nhớ nói Nấm ghi liền nha! 🐱';
  }

  return {
    revenueToday,
    expenseToday,
    orderCountToday,
    profitToday,
    unpaidOrdersCount,
    unpaidDebtAmount,
    adviceMessage,
    adviceEmotion,
  };
}
