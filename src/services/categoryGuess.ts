/**
 * Map a free-text expense description to ExpenseCategory.
 * Used after LLM/OCR/CSV already decided the row is an expense — not for intent routing.
 */

import type { ExpenseCategory } from '@/models';

export function guessCategory(desc: string): ExpenseCategory {
  const catMap: [string, ExpenseCategory][] = [
    ['văn phòng', 'office'], ['bút', 'office'], ['giấy', 'office'], ['cà phê', 'office'],
    ['cafe', 'office'], ['càfe', 'office'], ['ăn ', 'office'], ['cơm', 'office'],
    ['trà', 'office'], ['nước', 'office'], ['tiếp khách', 'office'], ['sinh nhật', 'office'],
    ['thuê', 'rent'], ['mặt bằng', 'rent'], ['nhà xưởng', 'rent'],
    ['điện', 'utilities'], ['internet', 'utilities'], ['wifi', 'utilities'], ['mạng', 'utilities'],
    ['nước máy', 'utilities'], ['gas', 'utilities'],
    ['lương', 'salary'], ['thưởng', 'salary'], ['bhxh', 'salary'],
    ['quảng cáo', 'marketing'], ['marketing', 'marketing'], ['ads', 'marketing'], ['facebook', 'marketing'],
    ['nguyên liệu', 'supplies'], ['vật liệu', 'supplies'], ['vật tư', 'supplies'], ['hàng hóa', 'supplies'],
    ['len', 'supplies'], ['bông', 'supplies'], ['nhung', 'supplies'], ['yarn', 'supplies'],
    ['sợi', 'supplies'], ['móc khóa', 'supplies'], ['kẽm', 'supplies'], ['túi', 'supplies'],
    ['tem', 'supplies'], ['nhãn', 'supplies'], ['hộp giấy', 'supplies'],
    ['xăng', 'transportation'], ['ship', 'transportation'], ['grab', 'transportation'],
    ['taxi', 'transportation'], ['gửi hàng', 'transportation'], ['vận chuyển', 'transportation'],
    ['sửa', 'maintenance'], ['bảo trì', 'maintenance'], ['bảo dưỡng', 'maintenance'],
    ['thuế', 'tax'], ['phí ngân hàng', 'tax'], ['lệ phí', 'tax'],
  ];
  const lower = desc.toLowerCase();
  for (const [kw, cat] of catMap) {
    if (lower.includes(kw)) return cat;
  }
  return 'other';
}
