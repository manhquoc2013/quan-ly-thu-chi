---
feature-id: M-001
feature-name: "Quản Lý Tài Chính"
document: lean-spec
output-mode: lean
last-updated: 2026-08-01
source-docs: [docs/06-SRS.md, docs/07-BRD.md, docs/01-architecture.md, docs/02-data-models.md, docs/03-ui-design.md, docs/05-technical-decisions.md, docs/13-theme-tokens.md]
complexity: Complex (>10 rules, 6 sub-modules, cross-cutting AI + Drive sync)
actor-slugs: [user]
---

# Lean BA Spec — M-001 "Quản Lý Tài Chính" (Personal Finance Manager)

## 1. Summary

Single-user, offline-first personal/SME finance management app for Vietnamese users (source: `docs/06-SRS.md` §1.1–1.2). Core capabilities:

- **Expense tracking**: CRUD with 10 fixed categories, payment status, invoice-photo attachment, search/filter/sort/pagination (SRS §3.1).
- **Revenue/order management**: order CRUD with line items, auto order codes, customer management, order + delivery state machines (SRS §3.2).
- **Reports**: expense / revenue / P&L (profit = revenue − expense) / daily / monthly / category reports with charts, plus PDF/CSV export (SRS §3.3).
- **AI assistant "Kimi"**: hybrid architecture — local WebLLM (Qwen 2.5 0.5B) chat when offline, Gemini cloud for advanced analysis + OCR invoice entry; conversational entry ("Thêm chi phí 500k tiền điện"), app navigation, data lookup, FX conversion to VND (SRS §3.4; `05-technical-decisions.md` §4).
- **Google Drive as the user-owned datastore** (folder `QuanLyThuChi/`, scope `drive.file`), no app server; OAuth2 via Google; app opens with **no login required** — Drive connect is opt-in for sync (SRS §1.4 note, §6.1).
- **Distribution**: portable Electron app (Windows/macOS/Linux, ≤200MB) + installable PWA with offline mode (SRS §3.6).

Complexity: **Complex** — >10 business rules, 6 functional modules, 2 external integrations (Drive, Gemini), 2 delivery channels. Lean spec with summary tables and AS-IS/TO-BE narrative below.

## 2. Scope

### In scope
| Area | SRS ref |
|---|---|
| Dashboard (7-day summary cards, stacked chart, pending orders w/ wait-time, recent 8 transactions) | FR-DASH-001/002 |
| Expense CRUD + categories + status + invoice images + search/filter/sort/pagination/pinned columns | FR-EXP-001…010 |
| Revenue/order CRUD + customers + items + discount + order/delivery state machines | FR-REV-001…004 |
| Reports: expense, revenue, P&L, daily, monthly, category, detail + export | FR-RPT-001…008 |
| AI: chat panel, analysis, OCR entry, text entry, conversational entry, navigation, lookup | FR-AI-000…007 |
| Settings: Google profile, Drive connect/disconnect, AI config (optional key), display config | FR-CFG-000…003 |
| Portable packaging + PWA | FR-POR-001/002 |

### Out of scope (source: SRS §1.2, BRD §5.2)
Multi-user/permissions · full accounting (ledger, receivables, depreciation) · POS/online payments · native iOS/Android apps · Excel/MISA import · multi-currency (VND only) · automated AI financial decisions.

### AS-IS → TO-BE (BRD §1.1, §4)
- **AS-IS**: users track income/expense in Excel/sheets, paper ledgers, or foreign apps (Money Lover, Spendee) — slow manual entry, no trend analysis, data scattered and at risk, Vietnamese invoices unsupported.
- **TO-BE**: portable app, open-and-use, AI-assisted entry (OCR from Vietnamese invoices, conversational input), automatic reports + P&L, data persisted on the user's own Google Drive and synced across devices; works offline with background sync.

## 3. Target Users (SRS §1.3, BRD §3.2)

| Segment | Share (BRD §3.2) | Primary needs |
|---|---|---|
| Small online shop owners | 35% | Fast entry, order tracking, P&L reports, AI analysis |
| Freelancers / consultants | 25% | Income & project expense tracking by customer |
| Small F&B/café owners | 20% | Daily income/expense, category reports |
| Individuals (family budgeting) | 15% | Simple, safe, easy |
| Other | 5% | — |

Actor slug: `user` (single-role app; no login/permissions — OAuth is for Drive access only).

## 4. Core User Journeys

| # | Journey | Key steps | Success signal |
|---|---|---|---|
| J1 | View Dashboard | Open app → see 4 summary cards (7-day in/out/profit/pending orders), 7-day stacked chart, pending orders with wait-time, 8 recent transactions | Overview in <3s first load |
| J2 | Add expense | [+ Thêm chi phí] → fill dialog (date, category, amount, description, payment method) → save → toast + grid update; alt: upload invoice photo → AI OCR pre-fills form | <30s entry (BRD KPI) |
| J3 | Create order | [+ Tạo đơn] → pick/search customer (or add) → add ≥1 product line → auto totals → save → auto code `DH-YYYYMMDD-NNN` | <60s entry (BRD KPI) |
| J4 | View reports | Reports → pick type + date range → charts/summary cards → drill to detail table → export PDF/CSV | P&L accurate; export works |
| J5 | Chat with AI | FAB → ask question ("Lợi nhuận tháng này?") → streaming answer with data + quick actions; OCR invoice via photo upload | Answer starts streaming <3s (NFR-PERF-005) |
| J6 | Settings / Drive connect | Settings → connect Google Drive (OAuth popup) → status ✅ → background sync; optional Gemini API key | Sync <5s per file; status shown |
| J7 | Follow up statuses | Expense pending→paid; order new→confirmed→processing→completed; delivery pending→shipping→delivered | State machine enforced (FR-REV-004) |

## 5. Functional Requirements by Module

| Module | Req ids (SRS) | Behavior summary |
|---|---|---|
| Dashboard (DASH) | FR-DASH-001/002 | 4 summary cards; stacked bar chart (revenue blue over expense red) per day; pending-orders list sorted by wait time asc with 🟢<24h / 🟡24–48h / 🔴>48h badges; 8 most recent transactions; auto-refresh on data change |
| Expense (EXP) | FR-EXP-001…010 | Virtualized grid (10K+ rows, ~20 visible) sorted by date desc; expandable rows; add/edit dialog with real-time validation; multi-select delete with confirm; status dropdown (pending↔paid, →cancelled); 10 fixed categories; invoice image ≤5MB compressed ≤2MB, thumbnails + lightbox; search (debounce 300ms) + date/category/status filters + sort + pagination (10/20/50/100) + sticky pinned columns |
| Revenue (REV) | FR-REV-001…004 | Order grid + expandable items; create order: date, searchable customer, product sub-table (name/qty/unitPrice → line total), discount, payment method, status; auto code `DH-YYYYMMDD-NNN`; totals auto-computed; customer CRUD (phone required, VN format); cannot delete a customer who has orders; order state machine + delivery state machine |
| Reports (RPT) | FR-RPT-001…008 | Expense report (summary cards, category pie, monthly bars); Revenue report (top-5 products/customers, order-status pie); P&L (gross profit, margin %, dual-axis monthly trend); daily/monthly/category/detail views; export PDF (print CSS) + CSV |
| AI (AI) | FR-AI-000…007 | Hybrid router (online+key→Gemini; offline→local WebLLM; neither→setup guidance); chat panel with streaming + markdown + status indicator; context-aware analysis (expense/revenue data in prompt); OCR invoice entry ≥80% accuracy (Vietnamese); conversational entry with `k`/`tr` units + FX conversion (USD/EUR/JPY/CNY/KRW/SGD/AUD→VND); navigation commands; lookup ("Đơn nào đang chờ?") |
| Settings (CFG) | FR-CFG-000…003 | Google profile auto-filled (read-only); store/business info editable; Drive connect/disconnect (OAuth, `drive.file`); Gemini API key optional + encrypted in IndexedDB + connection test + local model management (download/delete); display config (VND, DD/MM/YYYY, vi) |
| Portable/PWA (POR) | FR-POR-001/002 | Electron portable bundle ≤200MB, no install, Win10+/macOS12+/Ubuntu22.04+, auto-update from GitHub Releases; PWA installable, offline read/write cache, auto-sync on reconnect |

## 6. User Stories (MoSCoW)

| ID | Story (role: `user`) | Priority |
|---|---|---|
| US-01 | As a `user`, I can view a dashboard summarizing 7-day income/expense/profit and pending orders so I understand my cash position at a glance | Must |
| US-02 | As a `user`, I can add/edit/delete expenses with category, status, and invoice photo so my records stay complete | Must |
| US-03 | As a `user`, I can create orders with items and customers and track order/delivery status so revenue is captured end-to-end | Must |
| US-04 | As a `user`, I can view expense/revenue/P&L reports with charts for a chosen period so I can analyze profitability | Must |
| US-05 | As a `user`, I can chat with the AI to ask questions and get analysis, and OCR an invoice photo to pre-fill an expense | Must |
| US-06 | As a `user`, I can connect Google Drive so my data is synced across devices and owned by me | Must |
| US-07 | As a `user`, I can search/filter/sort expenses and paginate large lists so I can find records fast | Should |
| US-08 | As a `user`, I can export reports to PDF/CSV for sharing and record-keeping | Could |
| US-09 | As a `user`, I can pin grid columns and paste order text for AI parsing | Could |
| US-10 | As a `user`, I expect multi-user access, POS, and native mobile apps — Won't have | Won't |

## 7. Acceptance Criteria (BDD, incl. negative paths)

| ID | Given / When / Then |
|---|---|
| AC-EXP-01 | Given the Expense screen, when the user saves an expense with amount >0 and a valid category, then the record persists, the grid refreshes, and a success toast is shown |
| AC-EXP-02 | Given the expense form, when amount ≤0 or category/description is missing, then field-level validation errors appear and nothing is persisted |
| AC-EXP-03 | Given expenses exist, when the user searches or applies date/category/status filters, then only matching rows render and active filter chips are shown; clearing filters restores the full list |
| AC-EXP-04 | Given an expense status of `paid` or `pending`, when the user toggles status, then `pending`↔`paid` is allowed and `cancelled` is terminal (badge updates in real time) |
| AC-EXP-05 | Given an invoice upload of >5MB or non-JPG/PNG/PDF, when the user attaches it, then the upload is rejected with an explicit error and the expense still saves without the image |
| AC-REV-01 | Given a new order with ≥1 item, when saved, then an order code `DH-YYYYMMDD-NNN` is auto-generated, `finalAmount = totalAmount − discount`, and the order appears in the grid |
| AC-REV-02 | Given the order form with zero items, when the user tries to save, then validation blocks it ("at least 1 product") and no order is created |
| AC-REV-03 | Given an order in `completed` or `cancelled`, when the user attempts another status change, then the state machine rejects the transition and the UI prevents it |
| AC-REV-04 | Given a customer with existing orders, when the user tries to delete them, then the system warns and blocks deletion |
| AC-RPT-01 | Given a selected date range, when the user opens the P&L report, then revenue, expense, gross profit, and margin % are computed correctly and charts render |
| AC-AI-01 | Given online status + a Gemini API key, when the user asks "Phân tích chi phí tháng này", then the AI streams an answer grounded in the filtered expense data |
| AC-AI-02 | Given offline or missing API key, when the user requests OCR or advanced analysis, then a clear "requires internet/key" message is shown and the app does not crash |
| AC-AI-03 | Given the input "Thêm 100 USD mua phần mềm", when confirmed, then an expense of 100 × rate VND is created with a suitable category and a confirmation toast |
| AC-CFG-01 | Given the Settings screen, when the user connects Google Drive via OAuth, then status shows ✅ connected and data syncs to the `QuanLyThuChi/` folder |
| AC-POR-01 | Given the extracted portable package on Windows 10+, when launched, then the app runs without installation and the first load completes in <3s (3G) |

## 8. Business Rules

| ID | Rule | Source | Applies-to | Exception |
|---|---|---|---|---|
| BR-01 | Expense `amount` > 0 and ≤ 999.999.999.999 VND | SRS FR-EXP-002; data-models §2 | Expense form | — |
| BR-02 | Expense `description` required, 5–500 chars; `date` required and ≤ today+30d | SRS FR-EXP-002 | Expense form | — |
| BR-03 | Tags: max 10, each 2–30 chars | data-models §2 | Expense form | — |
| BR-04 | Expense status: `pending`↔`paid`; `cancelled` terminal | SRS FR-EXP-005 | Expense row | — |
| BR-05 | Order code auto `DH-YYYYMMDD-NNN` (per-day sequence) | SRS FR-REV-002; data-models §3 | Order create | — |
| BR-06 | Order must contain ≥1 item; `quantity ≥ 1`; `unitPrice > 0`; line `total = qty × price` | data-models §3 | Order create | — |
| BR-07 | `finalAmount = totalAmount − discount`; `0 ≤ discount ≤ totalAmount` | SRS FR-REV-002 | Order create/edit | — |
| BR-08 | Order status machine: `new→confirmed→processing→completed`; cancel allowed from `new/confirmed/processing`; `completed/cancelled` terminal | SRS FR-REV-004 | Order row | — |
| BR-09 | Delivery machine: `pending→shipping→delivered`; `returned` from `delivered` | SRS FR-REV-004 | Order row | — |
| BR-10 | Customer `phone` required, regex `^(0|\+84)[0-9]{9,10}$`; `name` 2–100 chars | data-models §4 | Customer form | — |
| BR-11 | Customer with existing orders cannot be deleted | SRS FR-REV-003 | Customer mgmt | — |
| BR-12 | Invoice image ≤5MB, JPG/PNG/PDF, compressed ≤2MB before upload; name `inv_YYYYMMDD_HHmmss.ext` | SRS FR-EXP-002/007, CON-007 | Expense dialog | — |
| BR-13 | P&L: profit = revenue − expense; margin = profit / revenue × 100% | SRS FR-RPT-003 | Reports | — |
| BR-14 | AI FX conversion for USD/EUR/JPY/CNY/KRW/SGD/AUD → VND | SRS FR-AI-005 | AI entry | rate source open (AMB-005) |
| BR-15 | Deletion is permanent (no soft delete); recovery via Drive version history (30 days) | SRS FR-EXP-004 | Expense delete | — |

## 9. Non-Functional Requirements (all 5 areas + UX)

| Area | ID (SRS) | Requirement | Target |
|---|---|---|---|
| Performance | NFR-PERF-001…006 | First load; grid open 1000 rows; add/edit dialog; Drive sync; AI stream start; RAM | <3s (3G); <1s; <500ms; <5s (<1MB); <3s; <100MB @10K rows |
| Availability | NFR-AVAIL-001…004 | Offline read/write + background sync; Drive error retry; AI timeout; empty states | 3 retries exp. backoff; AI timeout 30s + fallback; every screen has empty state |
| Security | NFR-SEC-001…005 | OAuth2 only (no user/pass); Gemini key encrypted in IndexedDB; user-owned data (no app server); HTTPS only; auto token refresh | drive.file scope; AES-encrypted key |
| Scalability | NFR-SCALE-001…003 | Records; customers; JSON size | ≥50K expenses + 50K revenues; ≥10K customers; <50MB, auto-split beyond |
| Maintainability | NFR-MAINT-001…004 | Coverage; lint; TS; docs | ≥60% unit coverage; ESLint+Prettier clean; `strict:true`; docstrings |
| UX (cross) | NFR-UX-001…005 | Responsive; keyboard shortcuts; loading states; toasts; delete confirm | desktop ≥1024px + tablet ≥768px; Enter/Escape/Ctrl+F; skeleton+spinner; auto-dismiss 3–5s; no undo — warn before delete |

Constraints (SRS §5): Google account + Drive API project required (CON-001/002); Gemini key user-provided optional (CON-003); offline-first (CON-004); browsers Chrome/Edge/Firefox 90+, Safari 15+ (CON-005); Electron 30+ (CON-006); JS bundle ≤500KB gzipped (CON-008).

## 10. Test Scenarios

| ID | Scenario | Source FR | Negative path? |
|---|---|---|---|
| TS-01 | Add expense happy path incl. Drive persistence + toast | FR-EXP-002 | — |
| TS-02 | Expense validation failures (amount, category, description, image size/format) | FR-EXP-002 | Yes |
| TS-03 | Search/filter/sort/pagination combinations on 10K-row grid | FR-EXP-001/008/009 | Yes (empty result) |
| TS-04 | Expense status transition matrix incl. cancelled-terminal | FR-EXP-005 | Yes |
| TS-05 | Order totals math (items, discount, final) + code sequence | FR-REV-002 | — |
| TS-06 | Order/delivery state machine invalid transitions | FR-REV-004 | Yes |
| TS-07 | Customer delete guard with existing orders | FR-REV-003 | Yes |
| TS-08 | P&L math correctness vs fixture data | FR-RPT-003 | Yes (zero revenue) |
| TS-09 | AI offline/online router behavior + OCR accuracy ≥80% | FR-AI-000/003 | Yes (offline OCR) |
| TS-10 | Drive connect/disconnect + conflict handling (etag) | FR-CFG-001 | Yes (token expiry) |
| TS-11 | PWA install + offline entry + background sync | FR-POR-002 | Yes (airplane mode) |

## 11. Pipeline Triage

| Question | Answer | Rationale |
|---|---|---|
| Q1: creates new domain elements? | **Yes** | Entire domain is new: Expense, Revenue/Order + OrderItem, Customer aggregates, Report projections (data-models §2–5) → Phase 2 ran (see `domain-analyst/00-lean-domain.md`) |
| Q2: affects system architecture? | **Yes** | Greenfield app with 2 external integrations (Drive API, Gemini/hybrid AI router) and 2 delivery channels (Electron portable + PWA) |
| Q3: approach clear from existing architecture? | **Yes, but moot** | `01-architecture.md` + `05-technical-decisions.md` define stack (React 19 + Zustand + Vite + Tailwind) and patterns; Q1/Q2 already route upstream |
| **Verdict** | **Route → `engineering-system-architect`** | New domain + new system architecture; architect confirms bounded contexts, storage model (AMB-001), and AI router before technical lead plans tasks |

## 12. Ambiguities (non-blocking; resolved downstream)

| ID | Ambiguity | Impact | Options | Recommendation |
|---|---|---|---|---|
| AMB-001 | Storage: SRS §7.1/§6.1 = JSON files (`expenses.json`…); `01-architecture.md` §6 = single SQLite `database.db` (sql.js) | Data layer + sync design | JSON vs SQLite | Follow architecture (SQLite) — BRD §5.1 also says "SQLite sync ngầm"; BA spec is storage-agnostic |
| AMB-002 | Local AI model: SRS FR-CFG-002 = Gemma 2B ~620MB; `05-technical-decisions.md` §4 = Qwen 2.5 0.5B ~280MB | Bundle size, offline UX | Gemma vs Qwen | Follow tech decision (Qwen 2.5 0.5B; TinyLlama fallback) |
| AMB-003 | "No login required" (SRS §1.4) vs FR-EXP-001 precondition "Đã đăng nhập Google" | UX expectation | App usable without OAuth; Drive features degrade | OAuth is Drive-only, not app login; offline-first |
| AMB-004 | FR-EXP-004 "xóa vĩnh viễn" vs recovery via Drive version history | Data-loss expectation | Warn user; document 30-day recovery | Keep permanent delete + confirm dialog |
| AMB-005 | AI FX rate source unspecified (SRS FR-AI-005 example uses 25.450) | Entry accuracy | Fixed rate table vs live API | Architect/tech-lead decides; BA rule BR-14 flagged |

## 13. Assumptions (SRS §1.2, BRD §5.3)

1. User has a Google account (OAuth2 for Drive; CON-001).
2. User is online ≥1×/day for sync; app fully usable offline in between.
3. Data volume <50K records per type (expenses, revenues) and <10K customers.
4. Gemini API key is user-created and optional; basic chat works offline via local model.
5. Single-user app — no roles, no permission matrix (actor-registry.json / permission-matrix.json absent → new module, single `user` role).
6. VND is the only base currency; foreign amounts are converted to VND at entry (BR-14).
