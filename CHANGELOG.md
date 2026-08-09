# Changelog

Tất cả thay đổi đáng chú ý của dự án được ghi lại tại đây. Dựa trên [Keep a Changelog](https://keepachangelog.com/).

Các tag được đánh theo [Semantic Versioning](https://semver.org/lang/vi/).

---

## [1.4.0] — 2026-08-09

🔗 [So sánh với v1.3.0](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.3.0...v1.4.0)

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
