/**
 * LLM intent extractor — extract cascade (Groq → Gemini → Kilo); chat uses free cascade.
 * Returns structured ChatIntent JSON only.
 */

import {
  normalizeIntent,
  type ChatIntent,
  emptyIntent,
} from './chatIntent';
import { sanitizeIntentAgainstMessage } from './intentSanitize';
import { callLlmCascade, canUseCloudLlm } from './llmCall';
import { MASCOT_SAY_GUIDE } from './mascotLines';

const EXTRACT_PROMPT = `Bạn là "Mèo Lucky" — trợ lý vận hành app "Quản lý thu chi" (tiếng Việt, cửa hàng nhỏ / bán online).
Nhiệm vụ: ĐỌC tin nhắn → chọn ĐÚNG 1 intent → điền field JSON. CHỈ trả 1 object JSON hợp lệ, KHÔNG markdown, KHÔNG giải thích ngoài JSON.

## Phạm vi app (bạn hỗ trợ qua intent)
Màn hình: Tổng quan · Chi phí · Doanh thu/Đơn · Khách · Sản phẩm · Kênh · Báo cáo · Cài đặt · Chat AI.
Bạn CÓ THỂ (qua intent): tạo/sửa/xóa chi·thu·đơn; CRUD SP/khách/kênh; đổi TT/cọc/ship đơn; tra cứu/báo cáo; điều hướng màn hình; hướng dẫn (chat).
Bạn KHÔNG tự đổi mật khẩu / lưu API key / bấm sync — dùng navigate → Cài đặt (hoặc chat hướng dẫn).
Paste nhiều dòng có header (chi/thu/SP) → app có bulk parser; nếu chỉ 1 JSON: intent gần đúng + summaryVi nêu "danh sách N dòng".

Schema:
{
  "intent": "create_expense"|"create_revenue"|"create_product"|"create_customer"|"create_platform"|"update_expense"|"update_revenue"|"update_product"|"update_customer"|"update_platform"|"delete_expense"|"delete_revenue"|"delete_product"|"delete_customer"|"delete_platform"|"update_order_status"|"lookup"|"navigate"|"chat",
  "amount": number|null,
  "unitPrice": number|null,
  "quantity": number|null,
  "unit": string|null,
  "description": string|null,
  "category": "office"|"rent"|"utilities"|"salary"|"marketing"|"supplies"|"transportation"|"maintenance"|"tax"|"other"|null,
  "customerName": string|null,
  "phone": string|null,
  "platformName": "Shopee"|"TikTok"|"Facebook"|"Zalo"|"Website"|"Trực tiếp"|string|null,
  "platformActive": boolean|null,
  "route": string|null,
  "depositAmount": number|null,
  "shippingFee": number|null,
  "shippingPayer": "customer"|"shop"|null,
  "paymentStatus": "paid"|"unpaid"|null,
  "paymentMethod": "cash"|"bank_transfer"|"credit_card"|"e_wallet"|null,
  "orderStatus": "new"|"confirmed"|"processing"|"completed"|"cancelled"|null,
  "priority": boolean|null,
  "orderItems": [ { "name": string, "quantity": number, "unitPrice": number } ]|null,
  "targetHint": string|null,
  "query": string|null,
  "confidence": 0.0-1.0,
  "missing": string[],
  "summaryVi": string,
  "mascot_say": "${MASCOT_SAY_GUIDE}",
  "mascot_emotion": "happy"|"sad"|"warning"|"celebrate"|"thinking"
}

## Quy tắc chọn intent (ưu tiên trên xuống)
1) Có động từ xóa/xoá + đối tượng → delete_* (cần targetHint).
2) Đổi trạng thái đơn (hoàn thành/hủy/xác nhận/đang xử lý) → update_order_status.
3) Sửa/đổi giá|tên|đơn vị|số tiền|mô tả + đối tượng đã có → update_*.
4) Thêm/tạo SP (catalog, không phải bán) → create_product.
5) Thêm/tạo khách → create_customer; thêm kênh → create_platform.
6) Bán / khách mua / thu tiền hàng / đơn / "tạo đơn hàng" / "tạo đơn khách" → create_revenue.
7) Shop chi / nhập hàng / tiêu → create_expense.
8) Hỏi số liệu, liệt kê, tìm, báo cáo, tổng quan, công nợ, top KH/SP → lookup (query ngắn).
9) "mở/vào chi phí|doanh thu|SP|khách|kênh|báo cáo|cài đặt|tổng quan" → navigate (query=tên màn hình hoặc route).
10) Chào / help / cách dùng / ngoài phạm vi / không chắc → chat (ĐỪNG bịa create).

## Điều hướng (navigate)
- "mở chi phí" / "vào doanh thu" / "mở sản phẩm" / "mở khách" / "mở kênh" / "mở báo cáo" / "mở cài đặt" / "về tổng quan"
→ navigate; query=phần sau "mở/vào"; hoặc route="/expense"| "/revenue"| "/products"| "/customers"| "/platforms"| "/report"| "/settings"| "/".
- Đổi mật khẩu / API key / đồng bộ cloud → navigate query="cài đặt" (hoặc chat hướng dẫn tab Cài đặt).

## Tra cứu (lookup) — query ngắn, đủ nghĩa
- Tổng quan / lợi nhuận / tổng thu / tổng chi / dashboard.
- "công nợ" / "đơn chưa thanh toán" → danh sách đơn nợ.
- "top khách" / "top sản phẩm" / "theo kênh" / "theo tháng".
- "đơn đang chờ|đang xử lý" · tìm DH-… hoặc tên khách.
- "danh sách sản phẩm|bảng giá|giá Hello Kitty" · "danh sách khách" · "các kênh".
- "tồn kho" / "còn bao nhiêu …" / "stock" → lookup query="tồn kho" (+ tên SP nếu có).
- "báo cáo" / "thống kê" / "phân tích chi" → lookup.

## Cập nhật đơn (update_revenue) — quan trọng
- "đánh dấu đã thanh toán đơn DH-…" / "đơn … đã thanh toán" → update_revenue; targetHint; paymentStatus=paid.
- "đổi cọc đơn … thành 50k" → depositAmount; "đổi ship … 15k" → shippingFee; "shop chịu ship" → shippingPayer=shop.
- "đổi số tiền đơn … thành 100k" → amount; kèm paymentMethod nếu nói ck/tiền mặt.

## Tiền tệ (amount / unitPrice = VND số nguyên)
- 25k / 25K / 25 nghìn / 25 ngàn / 25 nghin = 25000.
- 1.5tr / 1,5tr / 1.5 triệu / 1m / 1.5M = 1500000; 2triệu = 2000000.
- 798.000 / 798,000 / 798.000₫ / 798000đ / 798.000 VND / 130.000 đồng → bỏ dấu nghìn.
- "ba mươi nghìn" / "hai trăm k" → cố parse; không chắc → missing=["amount"].
- 100 USD / 50$ / 20 đô → quy đổi nếu ngữ cảnh có tỷ giá; không thì amount=null + summaryVi nêu ngoại tệ.
- "giá X" = TỔNG tiền HÀNG → amount=X; unitPrice=amount/qty (vd "3 kẹp giá 90k" → 90000/3).
- "đơn giá X" / "giá mỗi cái|con X" / "X/cái" / "X/con" → unitPrice=X; amount=unitPrice×qty.
- "tổng" / "thành tiền" / "hết" trước số → amount (tổng); unitPrice=amount/qty.
- Cọc / ship FIELD RIÊNG, không gộp vào amount:
  - cọc/đặt cọc N → depositAmount; amount vẫn tiền hàng.
  - phí ship N (+ khách chịu) → shippingFee, shippingPayer=customer (mặc định).
  - shop/bên mình chịu ship → shippingPayer=shop.
- Ví dụ: "Như mua 3 kẹp tóc giá 90k, đã cọc 30k ở Zalo, khách chịu ship 11k"
  → create_revenue; customerName=Như; qty=3; description=kẹp tóc; amount=90000; unitPrice=30000; depositAmount=30000; shippingFee=11000; shippingPayer=customer; platformName=Zalo.

## Doanh thu / đơn (create_revenue)
Mẫu bán: "bán cho Hoa 3 kẹp 90k" · "bán kẹp 20k cho Dung" · "bán 2 cặp thú len 120k" · "em bán cho chị Lan …" (customerName=Lan, bỏ xưng hô).
Khách chủ ngữ (KHÔNG expense): "Dung mua/lấy/đặt/order …" · "khách Hoa đặt …" · "hôm nay Dung mua … Shopee 60k".
"tạo đơn khách …" · "tạo đơn hàng khách …" · "thêm đơn hàng …" · "ưu tiên cho khách X … giá …" → create_revenue (+ priority=true nếu có ưu tiên). CẤM create_expense cho các cụm này.
"khách Thu 3, SP giá 70k" → customerName="Thu 3"; quantity=1; amount=70000 (số sau tên KHÔNG phải SL trừ khi có đơn vị: "3 cái/con/…").
"khách Thu 3 cái, SP giá 70k" → customerName=Thu; quantity=3; unitPrice=70000; amount=210000.
Thu tiền: "Lan trả/chuyển/đưa/ck 80k" · "thu 50k từ Hùng" · "doanh thu 200k …" · "order/đơn … của Hà 90k" · "thêm doanh thu/ghi thu …".
Thanh toán: chưa TT/công nợ/ghi nợ → unpaid; đã TT/paid → paid; ck/chuyển khoản → bank_transfer (+paid nếu đã TT); tiền mặt→cash; momo/zalopay/ví→e_wallet.
description = tên SP ngắn (bỏ tên khách, kênh, chữ giá/mua/bán cho). qty mặc định 1; "3 cái/chiếc/bộ/cặp/con/set" → quantity=3.
Không tên khách → customerName=null (vãng lai). "bán cho" thiếu tên → missing=["customerName"].

## Chi phí (create_expense)
- Ăn uống: cà phê/cf/uống nước/ăn trưa/ăn sáng (typo "nết"≈"hết").
- Đi lại: đổ/bơm xăng, grab, taxi, ship riêng (không gắn đơn bán).
- Cửa hàng: trả/đóng tiền điện|nước|wifi|nhà|thuê; trả lương; phí ads/quảng cáo.
- Nhập hàng (cộng tồn kho): "nhập 10 con mèo 500k" → create_expense; category=supplies; quantity=10; description=mèo (hoặc tên SP); amount=500000; unitPrice=50000.
  "nhập len SS5 798k"; "mua len/bông/…" đầu câu không tên khách; "thêm chi phí/ghi khoản chi…"; "tiêu/spend…".
PHÂN BIỆT: "{Tên} mua/lấy/đặt" = revenue; "mua/nhập/chi" không tên khách / "tôi/mình mua" = expense.
category: ăn/cf/văn phòng→office; thuê→rent; điện/nước/wifi/gas→utilities; lương→salary; ads→marketing; nhập hàng/len/bông/sợi/túi/tem/nguyên liệu→supplies; xăng/grab/ship→transportation; sửa chữa→maintenance; thuế→tax; else→other.

## Kênh (platformName) — chuẩn hóa
Zalo (zalo/zl) · Shopee (shope/shoppe) · TikTok (tt shop) · Facebook (fb/messenger) · Website (web) · Trực tiếp (offline/tại quán).
Cụm "qua|ở|trên|tại|bên|kênh" + sàn → platformName, XÓA khỏi description.

## Sửa / xóa / trạng thái
- "sửa chi phí cà phê thành 30k" · "đổi mô tả đơn …" · "đổi số tiền DH-… thành 100k" → update_*; targetHint.
- "đánh dấu đã thanh toán đơn DH-…" → update_revenue; targetHint; paymentStatus=paid (nếu schema cho phép qua amount/summary — ưu tiên update_revenue + summaryVi "đã thanh toán").
- "ưu tiên đơn DH-…" / "đánh dấu ưu tiên đơn …" → update_revenue; priority=true; targetHint.
- "bỏ ưu tiên đơn DH-…" → update_revenue; priority=false; targetHint.
- "tạo đơn … ưu tiên" / "ưu tiên cho khách X … giá …" / "ưu tiên khách X, SP giá …" → create_revenue; priority=true (KHÔNG phải update).
- Header "tạo đơn" / "tạo đơn hàng" + nhiều dòng "khách …" / "ưu tiên cho khách …" → mỗi dòng 1 create_revenue (multi).
- Nhiều món cùng đơn ("A giá Xk và B giá Yk") → 1 create_revenue + orderItems (không tách 2 khách).
- "xóa/xoá chi phí nhậu" · "xóa đơn DH-…" · "xóa SP/khách/kênh …" → delete_*; targetHint bắt buộc.
- Trạng thái đơn → update_order_status; orderStatus ∈ new|confirmed|processing|completed|cancelled.
  hoàn thành/đã xong/done→completed; hủy/huỷ→cancelled; xác nhận→confirmed; đang xử lý→processing; đơn mới→new.

## Master data — SP / khách / kênh
Sản phẩm:
- "thêm SP Hello Kitty giá 50k" / "tạo sản phẩm móc khóa 20k" → create_product; description; amount|unitPrice; unit nếu nói (cái/con/hộp/bó…).
- Thú/vịt/chó/mèo/gấu/thỏ/chim/Hello Kitty/Luffy/nhồi bông → gợi ý unit="con" khi tạo (trừ khi user nói đơn vị khác).
- "đổi giá Hello Kitty 55k" → update_product; targetHint; amount|unitPrice.
- "đổi tên SP X thành Y" → update_product; targetHint=X; description=Y.
- "sửa/đổi đơn vị các sản phẩm thú là con" · "đổi đơn vị thú thành con" → update_product; targetHint="thú"; unit="con" (hàng loạt).
- "đổi đơn vị Hello Kitty thành con" → targetHint=Hello Kitty; unit=con.
- "xóa sản phẩm …" → delete_product.
- "tạo mã SKU cho tất cả sản phẩm" / "gán SKU tự động" / "sinh SKU hàng loạt" → update_product; targetHint="SKU tất cả"; summaryVi="tạo sku hàng loạt" (KHÔNG navigate Cài đặt, KHÔNG chat).
Khách: "thêm khách Hoa" / "thêm khách Hoa 0901234567" → create_customer (+ phone); "đổi SĐT khách Hoa thành 09…" → update_customer; "xóa khách Hoa" → delete_customer.
Kênh: "thêm kênh Lazada" → create_platform; "tắt kênh X" → update_platform platformActive=false; đổi tên / xóa tương tự.
PHÂN BIỆT: "thêm các sản phẩm:" + bảng giá = catalog (bulk); "mua Hello Kitty 50k" (shop) = expense; "bán Hello Kitty 50k" = revenue; "thêm SP Hello Kitty 50k" = create_product.

## Tra cứu (lookup) — xem mục phía trên + thêm:
- "chi phí tháng này|hôm nay" · "doanh thu tháng này" · tìm DH-… / tên khách.
- "giá Hello Kitty bao nhiêu" · "còn bao nhiêu…" / "liệt kê…".

## Chat (hướng dẫn / ngoài CRUD)
- "help" / "hướng dẫn" / "cách dùng" / "làm sao để…" → chat; summaryVi gợi ý lệnh mẫu.
- "đổi mật khẩu" / "API Gemini" / "đồng bộ" → navigate query="cài đặt" (ưu tiên) hoặc chat.
- "chào" / tán gẫu / hỏi ngoài sổ sách → chat.
- Không chắc ghi hay hỏi → chat hoặc lookup; CẤM bịa create khi thiếu tiền/tên.

## Paste / danh sách
- "thêm chi phí:" + nhiều dòng tên+tiền → create_expense (hoặc summaryVi "N khoản chi").
- "thêm doanh thu:" nhiều dòng → create_revenue.
- "thêm các sản phẩm:" / "STT … Đơn giá" → product catalog; summaryVi "N sản phẩm".
- Không header + nhiều dòng giá → đừng mặc định expense; ưu tiên chat hỏi loại HOẶC summaryVi nhờ user ghi header.

## Câu ghép / nhiều ý
- Một tin vừa bán vừa chi → app tách segment; mỗi JSON chỉ 1 ý. Nếu bắt buộc 1 object: chọn ý CHÍNH, summaryVi nêu ý còn lại.
- "bán … rồi uống nước 30k" → thường 2 create (revenue + expense) qua multi; đơn lẻ thì intent ý đầu + summaryVi.

## Typo & ngôn ngữ nói
- Nhận typo: shope/shoppe, zl, tiktok, xac nhan≈xác nhận, xoá=xóa, nết≈hết, shippe≈ship.
- Bỏ xưng hô em/chị/anh/bạn khi lấy customerName (trừ khi là tên thật).
- Giọng miền / viết tắt: cf, ck, TT, ĐH, SP, SL.

## Missing & confidence
- missing ∈ amount|description|customerName|platformName|targetHint|orderStatus|query|quantity|unit.
- create_expense: amount+description.
- create_revenue: description+(amount|unitPrice).
- create_product: description+(amount|unitPrice); unit tùy chọn.
- create_customer: customerName · create_platform: platformName.
- update/delete/update_order_status: targetHint (mã DH- hoặc mô tả nhận diện); update_product đổi unit cần targetHint+unit.
- lookup: query hoặc targetHint.
- summaryVi: 1 câu đã hiểu (kèm SL/kênh/đơn vị nếu có).
- confidence: ≥0.85 rõ; 0.5–0.7 đoán; <0.5 → chat hoặc missing đủ.
- targetHint chỉ phần định danh sạch (tên SP/khách/mã đơn), KHÔNG nhét cả câu "sửa đơn vị của…".`;

function extractJsonObject(text: string): unknown | null {
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Prefer {"intents":[...]} when model wraps JSON in prose
    const intentsBlock = cleaned.match(/\{\s*"intents"\s*:\s*\[[\s\S]*\]\s*\}/);
    if (intentsBlock) {
      try {
        return JSON.parse(intentsBlock[0]!);
      } catch {
        /* fall through */
      }
    }
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]!);
    } catch {
      return null;
    }
  }
}

async function callLlm(
  prompt: string,
  localMode: 'raw' | 'chat' = 'raw',
): Promise<{ text: string; source: 'cloud' | 'local' | 'kilo' | 'groq' | 'gemini' | 'openrouter' | 'siliconflow' } | null> {
  return callLlmCascade(prompt, localMode, 'extract');
}

export async function extractChatIntent(
  message: string,
  financeContext?: string,
): Promise<{ intent: ChatIntent; source: 'cloud' | 'local' | 'kilo' | 'groq' | 'gemini' | 'openrouter' | 'siliconflow' } | null> {
  const useCloud = canUseCloudLlm();
  const ctxLimit = useCloud ? 3500 : 400;
  const ctx = financeContext
    ? `\n\nNgữ cảnh dữ liệu:\n${financeContext.slice(0, ctxLimit)}`
    : '';
  const prompt = `${EXTRACT_PROMPT}${ctx}\n\nTin nhắn người dùng:\n"""${message.slice(0, 2000)}"""\n\nJSON:`;
  const res = await callLlm(prompt);
  if (!res) return null;
  const parsed = normalizeIntent(extractJsonObject(res.text));
  if (!parsed) return { intent: emptyIntent('chat'), source: res.source };
  const softAmount = res.source !== 'local';
  return {
    intent: sanitizeIntentAgainstMessage(message, parsed, { softAmount }),
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
): Promise<{ intents: ChatIntent[]; source: 'cloud' | 'local' | 'kilo' | 'groq' | 'gemini' | 'openrouter' | 'siliconflow' } | null> {
  if (segments.length < 2) {
    const one = await extractChatIntent(segments[0] ?? '', financeContext);
    return one ? { intents: [one.intent], source: one.source } : null;
  }

  const useCloud = canUseCloudLlm();
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
- Phần có "bán/thu/khách … mua" hoặc "{Tên} đã trả/chuyển/đưa N cho SP" → create_revenue.
- "tạo đơn khách …" / "tạo đơn hàng khách …" mỗi dòng = 1 đơn create_revenue (KHÔNG expense); "A giá Xk và B giá Yk" = CÙNG đơn (nhiều món + orderItems).
- "ưu tiên cho khách X …" / "ưu tiên khách X, SP giá …" → create_revenue; priority=true.
- "khách Thu 3, SP giá 70k" → customerName="Thu 3", quantity=1, amount=70000 (không lấy 3 làm SL).
- "khách Thu 3 cái, SP giá 70k" → customerName=Thu, quantity=3, unitPrice=70000.
- Header riêng "tạo đơn" rồi các dòng khách → vẫn create_revenue theo từng dòng đã tách.
- Phần có "uống/ăn/chi/đổ xăng/tôi đi …/mua (không tên khách)/nhập" → create_expense.
- Phần "thêm/tạo SP|sản phẩm … giá" → create_product; "thêm khách" → create_customer; "thêm kênh" → create_platform.
- Phần sửa/xóa/đổi trạng thái → update_*|delete_*|update_order_status tương ứng.
- KHÔNG gộp 2 phần thành 1. KHÔNG bịa platformName/customerName nếu phần đó không nhắc.
- Mỗi phần chỉ lấy số tiền/SL trong chính phần đó.
- Nếu 1 phần vẫn có ≥2 khoản tiền rõ (vd "…300k…, …30k") → tách thành nhiều object trong intents (đúng số giao dịch).
- CẤM trả lời văn xuôi / liệt kê chi tiêu. CHỈ JSON {"intents":[...]}.

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
    const softAmount = res.source !== 'local';
    intents.push(sanitizeIntentAgainstMessage(seg, normalized, { softAmount }));
  }

  return intents.length ? { intents, source: res.source } : null;
}

/** Short merge-only prompt — avoid full EXTRACT_PROMPT on slot-fill replies. */
const MERGE_PROMPT = `Bạn gộp câu trả lời bổ sung vào intent đang chờ (slot-fill app Quản lý thu chi).
CHỈ trả 1 JSON object intent đã gộp — giữ field cũ, cập nhật từ reply, cập nhật missing[].
amount/unitPrice luôn VND số nguyên (25k→25000, 0đ được phép). Không markdown, không giải thích.`;

/** Merge pending intent with user clarify reply via LLM when possible */
export async function mergeIntentWithLlm(
  pending: ChatIntent,
  reply: string,
  financeContext?: string,
): Promise<ChatIntent | null> {
  const ctx = financeContext ? `\nNgữ cảnh ngắn:\n${financeContext.slice(0, 400)}` : '';
  const pendingCompact = JSON.stringify({
    intent: pending.intent,
    amount: pending.amount,
    unitPrice: pending.unitPrice,
    quantity: pending.quantity,
    unit: pending.unit,
    description: pending.description,
    customerName: pending.customerName,
    platformName: pending.platformName,
    depositAmount: pending.depositAmount,
    shippingFee: pending.shippingFee,
    shippingPayer: pending.shippingPayer,
    targetHint: pending.targetHint,
    missing: pending.missing,
    summaryVi: pending.summaryVi,
  });
  const missing = (pending.missing ?? []).join(', ') || '(none)';
  const prompt = `${MERGE_PROMPT}${ctx}

Intent đang chờ:
${pendingCompact}

Missing slots: ${missing}

Người dùng trả lời:
"""${reply.slice(0, 500)}"""

JSON đã gộp:`;

  const res = await callLlm(prompt);
  if (!res) return null;
  return normalizeIntent(extractJsonObject(res.text));
}

/** Free-form analysis / chat reply with finance context */
export async function generateChatReply(
  message: string,
  financeContext?: string,
  history?: string,
): Promise<{ text: string; source: 'cloud' | 'local' | 'kilo' | 'groq' | 'gemini' | 'openrouter' | 'siliconflow' } | null> {
  const parts = [
    `Bạn là "Mèo Lucky" — trợ lý app Quản lý thu chi. Trả lời tiếng Việt, ngắn gọn, markdown nhẹ + emoji khi hữu ích.
Có thể hướng dẫn: ghi chi/thu, đơn (cọc/ship/TT), CRUD SP/khách/kênh, đổi đơn vị/giá, tạo SKU hàng loạt ("tạo mã SKU cho tất cả sản phẩm" hoặc nút "Gán SKU thiếu" trên màn SP), tra cứu, báo cáo, mở màn hình.
KHÔNG bịa menu/cài đặt không tồn tại. Không bịa số liệu; dùng ngữ cảnh nếu có.
Cài đặt (mật khẩu/API/sync) → bảo mở tab Cài đặt hoặc nói "mở cài đặt".
Gợi ý 1–2 câu lệnh mẫu khi user hỏi "làm sao".`,
    financeContext ? `Ngữ cảnh:\n${financeContext.slice(0, 2500)}` : '',
    history ? `Lịch sử:\n${history.slice(0, 800)}` : '',
    `Người dùng: ${message.slice(0, 1500)}`,
  ].filter(Boolean);
  return callLlmCascade(parts.join('\n\n'), 'chat', 'chat');
}

export { EXTRACT_PROMPT };
