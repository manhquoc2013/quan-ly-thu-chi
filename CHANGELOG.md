# Changelog

Tất cả thay đổi đáng chú ý của dự án được ghi lại tại đây. Dựa trên [Keep a Changelog](https://keepachangelog.com/).

Các tag được đánh theo [Semantic Versioning](https://semver.org/lang/vi/).

---

## [2.0.0] — 2026-08-13

🔗 [So sánh với v1.7.0](https://github.com/manhquoc2013/quan-ly-thu-chi/compare/v1.7.0...v2.0.0)

### Thêm mới
- Dashboard tập trung: KPI tháng, hàng đợi “Cần xử lý”, sản phẩm cần làm, deep-link mở đơn
- Báo cáo: tổng quan, nhóm Tài chính / Vận hành, Top khách–sản phẩm, công nợ sắp xếp / deep-link
- In hóa đơn A6 (xem trước + in; portal body để `@media print` không bị dialog transform)
- Tìm đơn theo tên khách (local + cloud RPC `search_revenues_page`, walk-in ilike)
- Brand Auth / Onboarding: ink navy + soft sand; typography Be Vietnam Pro + Figtree
- `mascotLines.ts` — thoại Lucky thống nhất (idle / CRUD / auth / tap)

### Thay đổi
- List doanh thu / chi phí: filter dùng chung, debounce tìm kiếm, empty vs không khớp
- Realtime hydrate cloud (debounce); `loadLedger` phân trang 1000; `updateRevenuesBatch`
- LLM: slot-fill local-first, bỏ bulk cascade thừa, `mascot_say` ngắn ≤12 từ
- Header Báo cáo gọn: kỳ + DatePicker + switch nhóm / một hàng tab

### Sửa lỗi
- In bill trong dialog Radix; race deep-link chi tiết đơn; normalize walk-in id
- Hydrate PostgREST không còn cắt silent ở 1000 dòng

### Tài liệu / Ops
- Migration: `20260812110000_search_revenues_page.sql`, `20260812120000_search_revenues_walkin_ilike.sql` (cần apply trên Supabase)
- CHANGELOG.md, RELEASE.md

---

## [1.7.0] — 2026-08-12

🔗 [So sánh với v1.6.0](https://github.com/manhquoc2013/quan-ly-thu-chi/compare/v1.6.0...v1.7.0)

### Thêm mới
- Chat hoàn toàn qua LLM: tạo đơn / chi phí / SKU / điều hướng / paste bảng — bỏ parser regex (`textDraftParser`, table parsers)
- Cascade tách nhiệm vụ: extract (tạo đơn/chi/paste) Groq → Gemini → Kilo; chat theo thứ tự user (Kilo Free trước)
- Gemini / Groq tự lấy danh sách model (`models.list` / `/models`) và đổi model khi 429/404 (Flash cho extract/OCR, Flash-Lite / instant cho chat)

### Sửa lỗi
- `"tạo đơn hàng khách …"` không còn bị nhận nhầm chi phí
- Gemini không còn ép schema `BAN_HANG` đè extract JSON
- Groq sticky model theo task (extract ≠ chat); badge nguồn hiện đúng Groq
- `ImagePreview` gọi hook trước early return; Groq test dùng đúng state loading

### Thay đổi
- `guessCategory` tách sang `categoryGuess.ts` (OCR / CSV / bulk)
- ESLint sạch (`npm run lint`); tắt metric complexity/max-depth/max-params
- `eqeqeq` cho phép `== null`

### Tài liệu
- CHANGELOG.md, RELEASE.md

---

## [1.6.0] — 2026-08-10

🔗 [So sánh với v1.5.0](https://github.com/manhquoc2013/quan-ly-thu-chi/compare/v1.5.0...v1.6.0)

### Thêm mới
- Dashboard: khối "Sản phẩm cần làm" — tổng hợp SL theo món từ đơn chưa hoàn thành / chưa hủy, ưu tiên món có đơn ưu tiên
- Grid doanh thu: cột "Sản phẩm" (badge tên × SL) trên desktop; card mobile hiển thị danh sách món

### Thay đổi
- `REVENUE_MIN_WIDTH` 1100 → 1270; hàng grid `min-h` linh hoạt khi nhiều badge sản phẩm

### Tài liệu
- CHANGELOG.md, RELEASE.md

---

## [1.5.0] — 2026-08-09

🔗 [So sánh với v1.4.2](https://github.com/manhquoc2013/quan-ly-thu-chi/compare/v1.4.2...v1.5.0)

### Thêm mới
- Ưu tiên đơn hàng: đánh dấu / bỏ ưu tiên (UI + lệnh chat), lọc danh sách ưu tiên, migration Supabase `priority` / `priority_at`
- Parse local "tạo đơn" đa dòng / nhiều món không tách sai line items
- `TableHScroll` — scroll ngang chỉ trong bảng, không đẩy layout trang

### Sửa lỗi
- Khoảng trắng / scroll ngang giả sau cột cuối (ripple button `scale(10)` + `clip-path` phình `scrollWidth`)
- `giá` trần trong câu "khách … mua N … giá Xk" = tổng gói (không nhân SL)
- Tên khách 1 ký tự hợp lệ trong dialog / parse đơn

### Thay đổi
- Hover / press animation nút (overflow:hidden chứa ripple)
- Grid doanh thu / chi phí dùng CSS grid + minWidth trong TableHScroll

### Tài liệu
- CHANGELOG.md, RELEASE.md

---

## [1.4.2] — 2026-08-09

🔗 [So sánh với v1.4.1](https://github.com/manhquoc2013/quan-ly-thu-chi/compare/v1.4.1...v1.4.2)

### Thay đổi
- Deploy GitHub Pages qua Actions thuần (`upload-pages-artifact` + `deploy-pages`) — bỏ push nhánh `gh-pages`
- Chỉ deploy tag `v*` khi commit nằm trên `main`

### Tài liệu
- SECURITY.md
- Wiki (Home, FAQ, Cài đặt, Supabase, Dashboard, Chi phí, Doanh thu, Báo cáo, Trợ lý AI)
- RELEASE.md cập nhật cấu hình Pages Source = GitHub Actions

---

## [1.4.1] — 2026-08-09

🔗 [So sánh với v1.4.0](https://github.com/manhquoc2013/quan-ly-thu-chi/compare/v1.4.0...v1.4.1)

### Thay đổi
- Version UI lấy từ `package.json` qua Vite `__APP_VERSION__` (Layout, Auth, Onboarding, Settings) — hết hardcode lệch nhau

### Tài liệu
- CHANGELOG.md, RELEASE.md, README.md

---

## [1.4.0] — 2026-08-09

🔗 [So sánh với v1.3.0](https://github.com/manhquoc2013/quan-ly-thu-chi/compare/v1.3.0...v1.4.0)

### Thêm mới
- AuthGuard loading screen: logo 80px, subtitle "Đang tải dữ liệu..." với chấm nhảy
- AuthScreen: form đăng ký có storeName + confirmPassword, validation tooltip
- Mascot phản ứng CRUD: thông báo khi thêm/xoá/sửa expense + revenue
- Hiển thị rate limit cho từng AI provider trong Settings
- AuthGuard background: upscale 600→1920px

### Thay đổi
- Bulk toolbar: `fixed bottom-0` như FAB, luôn hiển thị
- PaginationBar: responsive mobile `← 3/12 →` / desktop đầy đủ
- Dashboard KPI: "Doanh thu"/"Chi phí", thêm hint, bỏ Math.round
- ReportScreen: subtitle + preset dạng segmented control
- AuthScreen icons: `ArrowRight` → `LogIn`/`UserPlus`, CardDescription → Info tooltip
- Dashboard icon: `Briefcase` → `Clock`, Settings: `SettingsIcon` → `FlaskConical`
- Page transition animation: `scale(0.97→1) + fade-in`, card stagger 0.04s
- Scrollbar CSS toàn cục: 6px mảnh, dark mode + Firefox

### Sửa lỗi
- Mascot animation: `tossed`/`spin`/`grapple` fallback về idle
- Layout `min-h-full` — fix height chain cho `h-full` children
- AuthGuard background: bỏ `scale()` animation gây mờ
- RevenueGrid: thêm checkbox mobile, dùng `formatDate()`

### Tài liệu
- README.md, RELEASE.md, CHANGELOG.md cập nhật

---

## [1.3.0] — 2026-08-09

🔗 [So sánh với v1.2.0](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.2.0...v1.3.0)

### Thêm mới
- Supabase Auth: đăng nhập/đăng ký email + password
- Onboarding screen sau đăng ký
- Mascot Lucky: mèo SVG hoạt hình đi lại trên giao diện
- Inventory report (FIFO COGS): nhập hàng, lãi gộp, tồn kho
- Sticky banner + hybrid pagination

---

## [1.2.0] — 2026-08-08

🔗 [So sánh với v1.1.2](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.1.2...v1.2.0)

### Thêm mới
- Deposit/payment tracking cho đơn hàng
- Order shipping fee
- Kilo Free AI integration
- Supabase shared ledger + realtime sync

---

## [1.1.2] — 2026-08-08

🔗 [So sánh với v1.1.1](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.1.1...v1.1.2)

### Sửa lỗi
- Stale SW asset 404s
- WebLLM eager-load trên GitHub Pages

---

## [1.1.1] — 2026-08-08

🔗 [So sánh với v1.1.0](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.1.0...v1.1.1)

### Thêm mới
- Product catalog + AI resolve
- Order platform management
- AI multimodal intake (OCR, CSV, voice)
- Order payment status
- Revenue mobile layout
- Smart chat intent
- Customer management
- Bulk line expense
- Order table paste

---

## [1.1.0] — 2026-08-08

🔗 [So sánh với v1.0.6](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.0.6...v1.1.0)

### Thêm mới
- Supabase realtime broadcast sync
- Deposit + payment tracking
- Shipping fee management
- Kilo Free AI provider
- Supabase shared ledger multi-device

---

## [1.0.6] — 2026-08-08

🔗 [So sánh với v1.0.5](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.0.5...v1.0.6)

### Thêm mới
- Supabase Auth: đăng nhập/đăng ký
- Shared ledger (multi-device)
- Settings sync qua Supabase

---

## [1.0.5] — 2026-08-03

🔗 [So sánh với v1.0.4](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.0.4...v1.0.5)

---

## [1.0.4] — 2026-08-03

🔗 [So sánh với v1.0.3](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.0.3...v1.0.4)

---

## [1.0.3] — 2026-08-02

🔗 [So sánh với v1.0.2](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.0.2...v1.0.3)

📦 [GitHub Release](https://github.com/tranquoc/quan-ly-thu-chi/releases/tag/v1.0.3)

### Thêm mới
- Google Drive OAuth thực + app-data sync

---

## [1.0.2] — 2026-08-02

🔗 [So sánh với v1.0.1](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.0.1...v1.0.2)

📦 [GitHub Release](https://github.com/tranquoc/quan-ly-thu-chi/releases/tag/v1.0.2)

### Sửa lỗi
- Logo.svg path dưới Vite `BASE_URL` trên GitHub Pages

---

## [1.0.1] — 2026-08-02

🔗 [So sánh với v1.0.0](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.0.0...v1.0.1)

📦 [GitHub Release](https://github.com/tranquoc/quan-ly-thu-chi/releases/tag/v1.0.1)

### Sửa lỗi
- GitHub Pages base path cho router, service worker, fonts

---

## [1.0.0] — 2026-08-02

📦 [GitHub Release](https://github.com/tranquoc/quan-ly-thu-chi/releases/tag/v1.0.0)

### Thêm mới
- Khởi tạo dự án: React 19 + Vite 6 + Tailwind CSS 4 + shadcn/ui
- SQLite (sql.js WASM) + IndexedDB local storage
- Expense CRUD với 10 danh mục
- Revenue CRUD với quản lý khách hàng, sản phẩm
- 7 loại báo cáo với biểu đồ Recharts
- Trợ lý AI chat + WebLLM local
- PWA + GitHub Pages deploy
