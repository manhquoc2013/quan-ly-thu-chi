/**
 * Lucy/Lucky mascot copy — short speech-bubble lines for the store-assistant persona.
 * Tone: warm, brief, thu–chi relevant; playful on tap/land, supportive for focus & productivity.
 */

export type LandVibe = 'climb' | 'soft' | 'scroll' | 'hop' | 'chute' | 'toss';

export function pickLine(pool: readonly string[]): string {
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** Periodic idle tips while Lucy is roaming. */
export const IDLE_LINES = [
  'Hôm nay đã ghi đơn chưa?',
  'Nhớ chốt chi phí trước khi quên nhé.',
  'Có đơn mới thì Nấm ghi giúp liền!',
  'Công nợ còn treo không ta?',
  'Xem báo cáo một nhịp cho chắc.',
  'Ghi sổ đều tay, cuối tháng dễ thở.',
  'Ưu tiên đơn gấp trước khi tối nhé.',
  'Nấm đang canh sổ thu–chi đây.',
] as const;

/** Focus companion lines to keep user attentive and disciplined. */
export const FOCUS_LINES = [
  'Tập trung cao độ nào, việc hôm nay chớ để ngày mai! 🎯',
  'Nấm đang ngồi cạnh cổ vũ bạn nè, đừng lướt điện thoại nha! 🐾',
  'Giữ nhịp thở đều, làm từng việc một thật gọn gàng nhé.',
  'Chủ tiệm làm việc chăm chỉ quá, Nấm tự hào ghê! ✨',
  'Chỉ 25 phút thôi, tập trung hoàn thành dứt điểm mục tiêu nào!',
  'Kỷ luật hôm nay là thành công ngày mai! Cố lên nha.',
] as const;

/** Quick financial wisdom lines. */
export const FINANCIAL_TIPS = [
  'Kiểm soát chi phí định kỳ giúp tiết kiệm đến 15% lợi nhuận!',
  'Khách quen mua nhiều, nhớ chăm sóc hậu mãi chu đáo nha.',
  'Dòng tiền là mạch máu của tiệm, hãy ưu tiên thu hồi công nợ.',
  'Mỗi đơn hàng nhỏ đều góp phần tạo nên doanh thu lớn!',
  'Luôn trích một phần lợi nhuận làm quỹ dự phòng rủi ro nhé.',
] as const;

export const LAND_LINES: Record<LandVibe, readonly string[]> = {
  climb: ['Lên được rồi!', 'Ngồi đây ổn!', 'Cao ghê ha!', 'Ổn áp!'],
  soft: ['Êm ru!', 'Đáp!', 'Nhẹ nhàng!', 'Ổn rồi!'],
  chute: ['Hạ cánh êm!', 'Nhẹ nhàng!', 'Ổn rồi!', 'Đáp!'],
  scroll: ['Ối, nền chạy mất!', 'Hu hu…', 'Chờ tí đã!'],
  hop: ['Nhảy cái!', 'Hehe!', 'Êm!'],
  toss: ['Bay mất!', 'Nhẹ tay chút!', 'Ối trời!'],
};

export const HARD_LAND_LINES = [
  'Hu hu… đau quá!',
  'Mèo xỉu một cái!',
  'Chết giả thôi nha…',
  'Ơ, nặng tay quá!',
] as const;

export const ACTIVITY_LINES = {
  high: 'Full năng lượng — Nấm chạy vòng vòng!',
  medium: 'Vừa phải thôi, đừng vội quá.',
  low: 'Nấm lười một chút…',
} as const;

export const TAP_LINES = {
  flinch: ['Á!', 'Ui!', 'Hức!', 'Chọc mèo à?'],
  hop: ['Nào nào!', 'Nhảy cái!', 'Hehe!'],
  knock: ['Đừng đụng!', 'Cào nhẹ thôi!', 'Ái chà!'],
  shy: ['Úp mặt…', 'Trốn tí!', 'Ngại quá…'],
  cheer: ['Yay!', 'Bay hơi!', 'Vui quá!'],
  playDead: ['Chết giả!', 'Đừng chọc nữa~', 'Hu hu…'],
} as const;

export const AUTH_GREET = {
  signIn: 'Chào chủ tiệm! Đăng nhập để mở sổ nhé.',
  signUp: 'Tạo tài khoản — Nấm canh sổ giúp!',
} as const;

export const CRUD_LINES = {
  orderCreated: 'Đơn mới vào sổ rồi!',
  orderUpdated: 'Đã chỉnh đơn xong nhé.',
  orderDeleted: 'Đã gỡ đơn khỏi sổ…',
  ordersDeleted: (n: number) => (n === 1 ? 'Đã gỡ đơn khỏi sổ…' : `Đã gỡ ${n} đơn khỏi sổ.`),
  ordersStatus: (n: number, label: string) =>
    n === 1 ? `Đơn → ${label}.` : `${n} đơn → ${label}.`,
  expenseCreated: 'Đã ghi khoản chi rồi!',
  expenseUpdated: 'Đã cập nhật khoản chi.',
  expenseDeleted: 'Đã xóa một khoản chi…',
  expensesDeleted: (n: number) => (n === 1 ? 'Đã xóa một khoản chi…' : `Đã xóa ${n} khoản chi.`),
  priorityOn: (code: string) => `Ưu tiên ${code} rồi!`,
  priorityOff: (code: string) => `Bỏ ưu tiên ${code}.`,
  bulkDone: (n: number) => `Đã xử lý ${n} mục!`,
} as const;

/** Guidance embedded in LLM prompts for mascot_say. */
export const MASCOT_SAY_GUIDE =
  '1 câu ngắn Nấm (≤12 từ): mừng thu / nhắc chi / xác nhận ghi sổ; xưng Nấm–chủ tiệm; không meme, không tiếng Anh slang';
