/**
 * LLM intent extractor — Gemini preferred, WebLLM fallback.
 * Returns structured ChatIntent JSON only.
 */

import { geminiService } from './geminiService';
import { webLLM } from './webLLM';
import { useAuthStore } from '@/store/authStore';
import {
  normalizeIntent,
  type ChatIntent,
  emptyIntent,
} from './chatIntent';
import { sanitizeIntentAgainstMessage } from './intentSanitize';

const EXTRACT_PROMPT = `Bạn là "Mèo Lucky" — Trợ lý thu ngân và quản lý sổ sách thông minh của cửa hàng, đang phân loại intent cho app "Quản lý thu chi" (tiếng Việt).
CHỈ trả về 1 object JSON hợp lệ, KHÔNG markdown, KHÔNG giải thích.

Schema:
{
  "intent": "create_expense"|"create_revenue"|"update_expense"|"update_revenue"|"delete_expense"|"delete_revenue"|"update_order_status"|"lookup"|"chat",
  "amount": number|null,
  "unitPrice": number|null,
  "quantity": number|null,
  "description": string|null,
  "category": "office"|"rent"|"utilities"|"salary"|"marketing"|"supplies"|"transportation"|"maintenance"|"tax"|"other"|null,
  "customerName": string|null,
  "platformName": "Shopee"|"TikTok"|"Facebook"|"Zalo"|"Website"|"Trực tiếp"|string|null,
  "depositAmount": number|null,
  "shippingFee": number|null,
  "shippingPayer": "customer"|"shop"|null,
  "paymentStatus": "paid"|"unpaid"|null,
  "paymentMethod": "cash"|"bank_transfer"|"credit_card"|"e_wallet"|null,
  "orderStatus": "new"|"confirmed"|"processing"|"completed"|"cancelled"|null,
  "targetHint": string|null,
  "query": string|null,
  "confidence": 0.0-1.0,
  "missing": string[],
  "summaryVi": string,
  "mascot_say": "1 câu ngắn Lucky nói, phù hợp giao dịch (khen nếu nhỏ, nhắc nếu to, mừng nếu thu nhập)",
  "mascot_emotion": "happy"|"sad"|"warning"|"celebrate"|"thinking"
}

## Tiền tệ (amount / unitPrice luôn VND số nguyên)
- 25k / 25K / 25 nghìn / 25 ngàn / 25 nghin = 25000.
- 1.5tr / 1,5tr / 1.5 triệu / 1m / 1.5M = 1500000; 2triệu / 2 triệu = 2000000.
- 798.000 / 798,000 / 798.000₫ / 798000đ / 798.000 VND / 130.000 đồng = bỏ dấu nghìn → số nguyên.
- "ba mươi nghìn" / "hai trăm k" → cố parse; không chắc thì missing=["amount"].
- 100 USD / 50$ / 20 đô → quy đổi nếu có tỷ giá ngữ cảnh; không thì amount=null + summaryVi nêu ngoại tệ.
- "giá X" = TỔNG tiền HÀNG → amount=X; unitPrice=amount/qty. Ví dụ "3 kẹp tóc giá 90k" → amount=90000, qty=3, unitPrice=30000.
- CHỈ khi nói rõ đơn giá từng cái mới dùng unitPrice: "đơn giá X" / "giá mỗi cái X" / "giá một cái X" / "X/cái" → unitPrice=X; amount = unitPrice × quantity.
- "tổng" / "thành tiền" / "hết" trước số, hoặc số cuối không có "giá" → amount (TỔNG hàng); unitPrice = amount/qty.
- Cọc / ship là FIELD RIÊNG, KHÔNG gán vào amount:
  - "đã cọc 30k" / "cọc 30k" / "đặt cọc 50k" → depositAmount=30000; amount vẫn là tiền hàng.
  - "khách chịu phí ship 11k" / "phí ship 11k" → shippingFee=11000, shippingPayer="customer" (mặc định).
  - "shop chịu ship 15k" / "bên mình chịu phí ship 15k" → shippingFee=15000, shippingPayer="shop".
  - amount = chỉ tiền hàng; app sẽ cộng ship vào finalAmount nếu khách chịu.
- Ví dụ đầy đủ: "Như mua 3 kẹp tóc giá 90k, đã cọc 30k ở Zalo, khách chịu phí ship 11k"
  → create_revenue; customerName=Như; qty=3; description=kẹp tóc; amount=90000; unitPrice=30000; depositAmount=30000; shippingFee=11000; shippingPayer=customer; platformName=Zalo.

## Doanh thu (create_revenue) — khách mua / shop bán
Mẫu bán:
- "bán cho Hoa 3 kẹp tóc giá 90k" → customer=Hoa, qty=3, desc=kẹp tóc, amount=90000, unitPrice=30000.
- "bán cho Hoa 3 kẹp tóc đơn giá 15k" / "… giá mỗi cái 15k" → unitPrice=15000, amount=45000.
- "bán cho Hùng thú nhồi bông 25k" → amount=25000, qty=1.
- "bán kẹp tóc 20k cho Dung" / "bán nước 15k" / "bán 2 cặp thú len 120k" → create_revenue.
- "em bán cho chị Lan …" → customerName=Lan (bỏ xưng hô em/chị nếu là shop nói).
Mẫu khách làm chủ ngữ (KHÔNG phải expense):
- "Dung mua/lấy/đặt/order 3 kẹp tóc qua Zalo giá 60k"
- "Dung mua 3 kẹp tóc giá 60k ở Zalo" / "… trên Shopee" / "… tại Facebook" / "… bên TikTok"
- "Dung đã mua …" / "Dung có mua …" / "khách Dung mua …" / "bạn Hoa đặt …"
- "hôm nay Dung mua kẹp tóc Shopee 60k" / " Hom nay dung order …"
→ create_revenue; tách customerName + platformName; description=sản phẩm thuần.
Thu / trả tiền:
- "khách Lan trả 80k" / "Lan trả 80k" / "Lan chuyển 80k" / "Lan đưa 80k"
- "thu 50k từ Hùng" / "thu được 100k bán kẹp tóc" / "nhận 50k từ Hoa" / "Hoa ck 200k"
- "doanh thu 200k bán mỹ phẩm" / "thêm doanh thu 100k …" / "ghi thu 50k …"
- "order kẹp tóc 40k cho Hoa" / "đơn thú len 120k của Hà" / "đơn hàng Hoa 90k"
Công nợ / đã thanh toán (paymentStatus + paymentMethod; app mặc định unpaid/cash nếu không nói):
- "… chưa thanh toán" / "công nợ" / "ghi nợ" → paymentStatus=unpaid.
- "… đã thanh toán" / "đã trả" / "paid" → paymentStatus=paid.
- "chuyển khoản" / "ck" / "transfer" → paymentMethod=bank_transfer (+ paid nếu nói đã thanh toán/ck).
- "tiền mặt" / "cash" → paymentMethod=cash.
- "momo" / "zalopay" / "ví" → paymentMethod=e_wallet.
- Ví dụ: "bán cho Hoa 3 kẹp tóc giá 90k, đã thanh toán bằng chuyển khoản"
  → create_revenue; paid; bank_transfer; amount=90000; qty=3.
Mô tả & SL:
- description = tên SP ngắn; BỎ: tên khách, qua/ở/trên/tại/kênh/bên + tên sàn, "giá", "mua/bán cho".
- qty mặc định 1; "3" / "3 cái/chiếc/bộ/cặp/set" → quantity=3.
- Không tên khách → customerName=null (vãng lai). "bán cho" mà thiếu tên → missing=["customerName"].

## Chi phí (create_expense) — shop chi / nhập hàng
- "cà phê 25k" / "cf 25k" / "uống nước 12k" / "ăn trưa 40k" / "ăn sáng hết 30k"
- "đổ xăng 30k" / "bơm xăng 30k" / "xăng 30" / "grab 25k" / "ship 15k" / "shippe 20k" — chi riêng (không kèm đơn bán)
- "chi 50k ăn trưa" / "trả 50k tiền điện" / "thanh toán 2tr tiền thuê" / "đóng 200k wifi" / "đóng tiền nhà 5tr"
- "mua len 500k" / "mua bút 15k" / "mua thêm bông 98k" — ĐẦU CÂU là mua/nhập → expense
- "nhập len SS5 798k" / "nhập hàng bông 98.000₫" / "nhập kho túi 50k"
- "thêm chi phí 100k tiền điện" / "ghi khoản chi …" / "chi phí ship 30k" (chi riêng, không phải ship trên đơn)
- "tiêu 20k" / "spend 10k" / "trả lương 5tr" / "phí ads 300k" / "chạy quảng cáo 200k"
PHÂN BIỆT:
- "{Tên người} mua/lấy/đặt/order …" = revenue
- "mua/nhập/chi …" không có tên khách phía trước = expense
- "mua hàng cho shop" / "tôi/mình/em mua …" = expense
category: cf/cà phê/ăn/cơm/trà/văn phòng/bút/giấy→office; thuê/mặt bằng→rent; điện/nước/wifi/mạng/gas→utilities; lương/thưởng→salary; ads/facebook ads/marketing→marketing; len/bông/sợi/yarn/nhung/túi/tem/nhãn/hộp/nguyên liệu→supplies; xăng/ship/grab/taxi→transportation; sửa/bảo trì→maintenance; thuế/phí ngân hàng→tax; else→other.

## Kênh bán (platformName) — chuẩn hóa tên
- Zalo: zalo / zalo oa / zl
- Shopee: shopee / shope / shoppe
- TikTok: tiktok / tik tok / tt shop
- Facebook: facebook / fb / messenger
- Website: website / web / trang web
- Trực tiếp: trực tiếp / offline / tại quán / tại shop (hoặc null)
Cụm: "qua|ở|trên|tại|bên|kênh|tren" + tên sàn — lấy platformName, XÓA khỏi description.
Ví dụ tương đương: "qua Zalo giá 60k" = "giá 60k ở Zalo" = "60k trên Zalo" = "Zalo 60k" (nếu rõ là đơn bán).

## Sửa / xóa / trạng thái đơn
- "sửa chi phí cà phê thành 30k" / "đổi mô tả …" / "đổi số tiền đơn DH-… thành 100k" → update_*; targetHint.
- "xóa/xoá chi phí nhậu" / "xóa đơn DH-20260801-005" → delete_*; targetHint bắt buộc.
- "đổi đơn DH-… sang hoàn thành/đã xong/done/completed" → update_order_status, orderStatus=completed.
- "hủy/huỷ đơn …" / "cancelled" → cancelled.
- "xác nhận đơn" / "confirmed" → confirmed; "đang xử lý" / "processing" → processing; "đơn mới" → new.
- orderStatus ∈ new|confirmed|processing|completed|cancelled.
- "đánh dấu đã thanh toán đơn DH-…" → update_revenue + targetHint + summaryVi đã thanh toán (hoặc update nếu app hỗ trợ).

## Tra cứu / chat
- "tổng quan" / "tổng chi" / "tổng thu" / "lợi nhuận" / "phân tích" / "báo cáo tháng này/tháng trước"
- "đơn đang chờ" / "đơn chưa thanh toán" / "công nợ" / "chi phí tháng này" / "liệt kê" / "bao nhiêu" / "thống kê"
→ lookup, query=ý chính ngắn.
- "help" / "hướng dẫn" / "chào" / hỏi ngoài phạm vi → chat.
- Không chắc ghi/sửa/xóa → chat (đừng bịa create).

## Paste nhiều dòng
- Header "thêm chi phí:" / "chi phí:" + nhiều dòng "tên + tiền" → create_expense (app có bulk parser); nếu chỉ trả 1 JSON: summaryVi liệt kê số dòng + tổng; confidence vừa phải.
- Tương tự "thêm doanh thu:" nhiều dòng → create_revenue.

## Missing & confidence
- missing ∈ amount|description|customerName|platformName|targetHint|orderStatus|query|quantity.
- create_expense: cần amount+description.
- create_revenue: cần description + (amount|unitPrice); customerName không bắt buộc.
- update/delete/update_order_status: cần targetHint (mã DH-… hoặc mô tả đủ nhận diện).
- summaryVi: 1 câu tiếng Việt đã hiểu gì (kèm kênh/SL nếu có).
- confidence: ≥0.85 rõ; 0.5–0.7 đoán; <0.5 → chat hoặc missing đầy đủ.
- Typo nhẹ (shope, shoppe, zl, tiktok) vẫn nhận; giữ đúng nghĩa.`;

function extractJsonObject(text: string): unknown | null {
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]!);
    } catch {
      return null;
    }
  }
}

async function callLlmLocal(
  prompt: string,
  mode: 'raw' | 'chat' = 'raw',
): Promise<{ text: string; source: 'local' } | null> {
  try {
    // raw: intent JSON (không chồng system). chat: trả lời hội thoại.
    const text = await webLLM.generate(prompt, {
      mode,
      maxTokens: mode === 'raw' ? 256 : 512,
    });
    if (
      text &&
      !text.startsWith('⚠️') &&
      !text.startsWith('⏳') &&
      !text.startsWith('Lỗi sinh')
    ) {
      return { text, source: 'local' };
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function callLlm(
  prompt: string,
  localMode: 'raw' | 'chat' = 'raw',
): Promise<{ text: string; source: 'cloud' | 'local' } | null> {
  const { geminiConfigured } = useAuthStore.getState();
  if (geminiConfigured && navigator.onLine && geminiService.isConfigured) {
    try {
      const text = await geminiService.generateContent(prompt);
      if (text && !text.startsWith('Lỗi Gemini:') && !text.startsWith('[Gemini chưa')) {
        return { text, source: 'cloud' };
      }
      // 429/404 → generateContent trả "Lỗi Gemini:…" — chuyển WebLLM
    } catch {
      /* fallback local */
    }
  }

  return callLlmLocal(prompt, localMode);
}

export async function extractChatIntent(
  message: string,
  financeContext?: string,
): Promise<{ intent: ChatIntent; source: 'cloud' | 'local' } | null> {
  // Cloud chịu context dài hơn; local cắt ngắn để khỏi vượt window
  const { geminiConfigured } = useAuthStore.getState();
  const useCloud =
    geminiConfigured && navigator.onLine && geminiService.isConfigured;
  const ctxLimit = useCloud ? 3500 : 400;
  const ctx = financeContext
    ? `\n\nNgữ cảnh dữ liệu:\n${financeContext.slice(0, ctxLimit)}`
    : '';
  const prompt = `${EXTRACT_PROMPT}${ctx}\n\nTin nhắn người dùng:\n"""${message.slice(0, 2000)}"""\n\nJSON:`;
  const res = await callLlm(prompt);
  if (!res) return null;
  const parsed = normalizeIntent(extractJsonObject(res.text));
  if (!parsed) return { intent: emptyIntent('chat'), source: res.source };
  return {
    intent: sanitizeIntentAgainstMessage(message, parsed),
    source: res.source,
  };
}

/**
 * One LLM call for multi-transaction messages (avoids N× WebLLM freezes).
 * `segments` from splitMultiTx — returns one sanitized intent per segment when possible.
 */
export async function extractMultiChatIntents(
  segments: string[],
  financeContext?: string,
): Promise<{ intents: ChatIntent[]; source: 'cloud' | 'local' } | null> {
  if (segments.length < 2) {
    const one = await extractChatIntent(segments[0] ?? '', financeContext);
    return one ? { intents: [one.intent], source: one.source } : null;
  }

  const { geminiConfigured } = useAuthStore.getState();
  const useCloud =
    geminiConfigured && navigator.onLine && geminiService.isConfigured;
  // Multi-create: skip heavy store context (hallucinations). Only pass tiny ctx if any.
  const ctx =
    financeContext && useCloud
      ? `\n\nNgữ cảnh (tham khảo, KHÔNG bịa tên khách/kênh nếu tin không có):\n${financeContext.slice(0, 800)}`
      : '';

  const listed = segments
    .map((s, i) => `${i + 1}. """${s.slice(0, 400)}"""`)
    .join('\n');

  const prompt = `${EXTRACT_PROMPT}${ctx}

Tin nhắn có ${segments.length} giao dịch RIÊNG (đã tách). Trả về ĐÚNG 1 JSON:
{"intents":[ /* ${segments.length} object cùng schema intent ở trên, theo đúng thứ tự */ ]}

Quy tắc:
- Phần có "bán/thu/khách … mua" → create_revenue.
- Phần có "uống/ăn/chi/mua (không tên khách)/nhập" → create_expense.
- KHÔNG gộp 2 phần thành 1. KHÔNG bịa platformName/customerName nếu phần đó không nhắc.
- Mỗi phần chỉ lấy số tiền/SL trong chính phần đó.

Các phần:
${listed}

JSON:`;

  const res = await callLlm(prompt);
  if (!res) return null;

  const raw = extractJsonObject(res.text);
  let list: unknown[] = [];
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.intents)) list = o.intents;
    else if (Array.isArray(o)) list = o as unknown[];
    else if (o.intent) list = [o];
  }

  if (list.length === 0) return null;

  const intents: ChatIntent[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const normalized = i < list.length ? normalizeIntent(list[i]) : null;
    if (!normalized || normalized.intent === 'chat') {
      // Fallback: extract that segment alone (queued, not parallel)
      const alone = await extractChatIntent(seg, undefined);
      if (alone && alone.intent.intent !== 'chat') intents.push(alone.intent);
      continue;
    }
    intents.push(sanitizeIntentAgainstMessage(seg, normalized));
  }

  return intents.length ? { intents, source: res.source } : null;
}

/** Merge pending intent with user clarify reply via LLM when possible */
export async function mergeIntentWithLlm(
  pending: ChatIntent,
  reply: string,
  financeContext?: string,
): Promise<ChatIntent | null> {
  const ctx = financeContext ? `\nNgữ cảnh:\n${financeContext.slice(0, 800)}` : '';
  const pendingCompact = JSON.stringify({
    intent: pending.intent,
    amount: pending.amount,
    unitPrice: pending.unitPrice,
    quantity: pending.quantity,
    description: pending.description,
    customerName: pending.customerName,
    platformName: pending.platformName,
    depositAmount: pending.depositAmount,
    shippingFee: pending.shippingFee,
    shippingPayer: pending.shippingPayer,
    missing: pending.missing,
    summaryVi: pending.summaryVi,
  });
  const prompt = `${EXTRACT_PROMPT}${ctx}

Đang chờ bổ sung cho intent sau (JSON):
${pendingCompact}

Người dùng trả lời bổ sung:
"""${reply.slice(0, 500)}"""

Trả về JSON intent ĐÃ GỘP (giữ field cũ, cập nhật field mới, cập nhật missing). JSON:`;

  const res = await callLlm(prompt);
  if (!res) return null;
  return normalizeIntent(extractJsonObject(res.text));
}

/** Free-form analysis / chat reply with finance context */
export async function generateChatReply(
  message: string,
  financeContext?: string,
  history?: string,
): Promise<{ text: string; source: 'cloud' | 'local' } | null> {
  const parts = [
    'Bạn là Trợ lý Tài Chính. Trả lời tiếng Việt, ngắn gọn, dùng số liệu ngữ cảnh nếu có. Không bịa dữ liệu.',
    financeContext ? `Ngữ cảnh:\n${financeContext.slice(0, 2500)}` : '',
    history ? `Lịch sử:\n${history.slice(0, 800)}` : '',
    `Người dùng: ${message.slice(0, 1500)}`,
  ].filter(Boolean);
  return callLlm(parts.join('\n\n'), 'chat');
}
