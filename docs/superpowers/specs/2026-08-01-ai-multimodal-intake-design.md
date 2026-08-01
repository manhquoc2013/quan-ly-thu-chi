# AI Multimodal Intake — Design Spec

**Date:** 2026-08-01  
**Status:** Approved & implemented (2026-08-01)  
**Approach:** Unified Intake Pipeline

## Problem

The AI chatbot is limited to text, uses a narrow regex parser, and does not cover many natural Vietnamese entry phrases. Image OCR, file import, and voice input are missing from the chat UI even though Gemini Vision helpers and `DataEntryHelper` already exist in the codebase.

## Goals

1. Accept **text, voice, image, PDF, CSV/XLS** into one intake pipeline.
2. **Text/voice:** persist immediately when parsed. **Image/PDF/CSV/XLS:** never persist until the user **explicitly confirms** a preview.
3. Make conversational create + lookup/analysis smarter with real store data.
4. Prefer Gemini for OCR/analysis when available; **fallback to Tesseract.js** for image/PDF OCR offline or without API key.

## Non-goals (this milestone)

- Edit/delete records via chat
- In-app navigation commands (“mở báo cáo”)
- Multi-turn slot-filling (AI asking follow-up questions); users fix fields on preview/dialog
- Full multi-page PDF OCR (first page only)
- Undo toast after confirm (preview replaces undo)

## Decisions locked with product

| Topic | Choice |
|:---|:---|
| Scope | Text + voice + image/PDF + CSV/XLS in one milestone |
| Persist | Text/voice: lưu ngay. OCR/PDF/CSV/XLS: preview → Confirm |
| Speech | Web Speech API only |
| Spreadsheet | Import expense **or** revenue (user toggle / heuristic guess) |
| Text smartness | Create expense/revenue (nhiều pattern + k/tr + FX) lưu ngay + lookup/analysis |
| OCR without Gemini | Tesseract.js fallback |
| Provider failure | Auto-fallback to local (no manual toggle) |

## Auto-fallback matrix

“Gemini không hoạt động” = chưa có key, offline, API lỗi, hoặc hết quota. Router bắt lỗi rồi chuyển local; UI hiện badge nguồn (`Gemini` / `WebLLM` / `Tesseract` / `local parser`).

| Việc | Gemini OK | Gemini unavailable / error |
|:---|:---|:---|
| Chat / phân tích / tra cứu | Gemini | → WebLLM local |
| Thêm chi/thu (text rõ) | Local parser trước (không cần Gemini) | Giữ local parser; câu mơ hồ → WebLLM |
| OCR ảnh/PDF | Gemini Vision | → Tesseract.js |
| CSV/XLS | Không dùng Gemini | Parse local |
| Giọng nói | Không dùng Gemini | Web Speech API |

Nếu **cả Gemini và WebLLM đều chưa sẵn sàng** (model đang tải / chưa load): trả message hướng dẫn chờ model hoặc cấu hình key — không crash, không persist nhầm.

## Architecture

```text
[Text] [Mic → Web Speech] [JPG/PNG/PDF] [CSV/XLS]
              │
              ▼
     intakeService.normalize()
              │
              ▼
     extractDraft() → DraftRecord[]
              │
              ▼
     Chat preview (DataEntryHelper / multi-row table)
              │
         Confirm | Edit | Cancel
              │
              ▼
     persistConfirmed() → expenseService / revenueService
```

Analysis/lookup messages skip the draft path: inject expense/revenue context into the prompt and return markdown only.

### Extract routing

| Input | Extractor |
|:---|:---|
| Clear create text | Expanded local parser (regex + units + FX) |
| Ambiguous create / free chat | Gemini if configured+online, else WebLLM |
| Lookup / analysis | Store context → Gemini preferred, else WebLLM |
| Image / PDF | Gemini Vision preferred; else Tesseract (+ PDF first-page raster) |
| CSV / XLS | Local column parse; kind guess heuristic or user toggle |
| Voice | Web Speech transcript → same as text |

### Key modules

| Module | Responsibility |
|:---|:---|
| `intakeService` | normalize → extractDraft → persistConfirmed |
| `speechService` | Web Speech API wrap (start/stop, interim text, errors) |
| `csvImportService` | Parse CSV/XLS, map headers, validate rows |
| `ocrService` | Route Gemini Vision vs Tesseract; PDF page-1 raster |
| `aiRouter` | Keep hybrid routing; stop auto-executing create actions without preview |
| `DataEntryHelper` | Single + multi-row draft preview, kind toggle |
| `ChatPanel` / `AIChatScreen` | Attach + mic controls; render draft messages |

## Data model

```ts
type DraftKind = 'expense' | 'revenue';
type DraftSource = 'text' | 'voice' | 'ocr' | 'csv';

type DraftRecord = {
  id: string;
  kind: DraftKind;
  date: string;              // YYYY-MM-DD
  amount: number;            // VND after FX
  description: string;
  category?: ExpenseCategory;
  customerName?: string;
  source: DraftSource;
  confidence?: number;       // 0–1
  ocrEngine?: 'gemini' | 'tesseract';
  rawFx?: { currency: string; original: number; rate: number };
  errors?: string[];         // blocks confirm for that row
};
```

Chat message union adds: `attachment`, `draft_preview` (holds `DraftRecord[]`), alongside existing text messages.

## UI behavior

### Input bar

- **Attach (📎):** accept `image/jpeg`, `image/png`, `application/pdf`, `.csv`, `.xlsx` / `.xls`. Reject >5MB or wrong MIME with inline error.
- **Mic (🎤):** Web Speech (`vi-VN` if available). While listening: red highlight + live transcript in the input. Hide/disable mic when API unsupported.
- Enter / send: submit current text (or commit final transcript).

### Preview

- Single draft: field card (date, kind, amount, description, category or customer, FX note if any).
- Multi-row (CSV): compact table; header toggle **Chi phí | Doanh thu** when kind uncertain.
- Actions: **Xác nhận** | **Chỉnh sửa** | **Hủy**.
- Edit opens existing `ExpenseDialog` / revenue form prefilled; after save, chat shows “Đã lưu…”.
- Confirm disabled while any row has `errors`.

### Analysis replies

Markdown only; no persist buttons. Source badge remains (Gemini / WebLLM / local).

## Text intelligence

### Create patterns (local-first)

Expand beyond current `parseLocalCommand` to cover:

- Units: `k`, `tr`/`triệu`, `.` / `,` thousand separators
- FX: USD, EUR, JPY, CNY, KRW, SGD, AUD → VND via fixed rate table (settings-overridable later; ship with defaults)
- Expense & revenue phrasing variants already partially present; add missing Vietnamese phrasing tests
- **Breaking change vs today:** matched create intents produce a **draft preview**, not immediate `executeAction`

If local parse fails but text looks like create (keywords: thêm/chi/thu/bán/mua…), forward to Gemini/WebLLM and parse `action` JSON into draft(s), still requiring confirm.

### Lookup / analysis

When message matches analysis/lookup intents (tổng quan, phân tích, lợi nhuận, tổng chi, đơn chờ, …), build a compact context snapshot from `expenseStore` / `revenueStore` (totals, by-category, recent counts) and send with the prompt. Do not create drafts.

## OCR

1. If Gemini configured + online → `geminiService.ocrInvoice` / Vision JSON extract.
2. Else → Tesseract.js (`vie+eng` traineddata), then light regex/heuristics to fill `DraftRecord` (amount, date, description). Mark `ocrEngine: 'tesseract'` and show accuracy warning on preview.
3. PDF: render **first page** to canvas via `pdfjs-dist`, then same OCR path.
4. Failure → keep attachment bubble + clear error; no empty draft confirm.

## CSV / XLS

1. Parse locally (no AI required for structure).
2. Header heuristics: date/ngày, amount/số tiền, description/mô tả, category/danh mục, customer/khách.
3. Guess `kind` from headers/content; user can override on preview.
4. Invalid rows get `errors`; **Confirm is disabled while any row has errors**. User may remove bad rows from preview, then confirm the rest.
5. Cap **200 rows** per import; reject with an explicit message if exceeded.

## Error handling

| Situation | Behavior |
|:---|:---|
| Speech API missing | Disable mic + tooltip |
| Gemini missing for analysis | WebLLM / degraded answer; state clearly |
| OCR without Gemini | Tesseract fallback + accuracy warning |
| Tesseract fail | Error message; keep attachment |
| File too large / bad type | Reject before processing |
| CSV zero valid rows | Show expected header sample |
| Partial persist failure | Persist OK rows; list failures in chat |

## Testing

- Unit: amount/FX parsers; CSV header mapping; draft validation; OCR JSON normalize
- Unit: `intakeService` create→draft (no persist); confirm→persist
- Component: preview Confirm/Cancel; mic disabled state
- Integration smoke: attach image with mocked Gemini/Tesseract; CSV multi-row confirm

## Migration / compatibility

- Remove auto-persist from `ChatPanel` / `AIChatScreen` when `result.action` is present; convert to draft preview message.
- Reuse `DataEntryHelper`; extend rather than duplicate.
- Dependencies to add: `tesseract.js`, `pdfjs-dist`, `papaparse` (CSV), `xlsx` (SheetJS community build for `.xls`/`.xlsx`).

## Success criteria

1. User can create expense/revenue from text, voice transcript, invoice image/PDF, or spreadsheet only after Confirm.
2. Lookup/analysis answers use real totals from stores.
3. OCR works with Gemini when configured; still produces a draft offline via Tesseract (may be lower quality).
4. Unsupported browsers degrade gracefully (no mic crash; OCR/CSV still usable).
