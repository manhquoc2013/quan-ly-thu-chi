/**
 * Lucky mascot copy — short speech-bubble lines for the store-assistant persona.
 * Tone: warm, brief, thu–chi relevant; playful on tap/land, never meme/gamer slang.
 */

export type LandVibe = 'climb' | 'soft' | 'scroll' | 'hop' | 'chute' | 'toss' | 'grapple';

export function pickLine(pool: readonly string[]): string {
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** Periodic idle tips while Lucky is roaming. */
export const IDLE_LINES = [
  'Hôm nay đã ghi đơn chưa?',
  'Nhớ chốt chi phí trước khi quên nhé.',
  'Có đơn mới thì Lucky ghi giúp liền!',
  'Công nợ còn treo không ta?',
  'Xem báo cáo một nhịp cho chắc.',
  'Ghi sổ đều tay, cuối tháng dễ thở.',
  'Ưu tiên đơn gấp trước khi tối nhé.',
  'Lucky đang canh sổ thu–chi đây.',
] as const;

export const LAND_LINES: Record<LandVibe, readonly string[]> = {
  climb: ['Lên được rồi!', 'Ngồi đây ổn!', 'Cao ghê ha!', 'Ổn áp!'],
  grapple: ['Móc chắc!', 'Leo nào!', 'Bám rồi!', 'Lên tiếp!'],
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
  high: 'Full năng lượng — Lucky chạy vòng vòng!',
  medium: 'Vừa phải thôi, đừng vội quá.',
  low: 'Lucky lười một chút…',
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
  signUp: 'Tạo tài khoản — Lucky canh sổ giúp!',
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
  '1 câu ngắn Lucky (≤12 từ): mừng thu / nhắc chi / xác nhận ghi sổ; xưng Lucky–chủ tiệm; không meme, không tiếng Anh slang';
