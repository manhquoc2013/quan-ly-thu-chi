# Quản Lý Tài Chính

> **Phiên bản**: 1.4.0 · **Cập nhật**: 2026-08-09

Ứng dụng quản lý tài chính cá nhân/doanh nghiệp nhỏ, tích hợp trợ lý AI đa provider, lưu trữ local (SQLite/IndexedDB) + Supabase cloud sync. Hỗ trợ PWA và CI/CD deploy lên GitHub Pages.

---

## 📌 Giới thiệu

**Quản Lý Tài Chính** giúp bạn theo dõi thu chi hàng ngày một cách thông minh. Ứng dụng kết hợp:

- 📊 **Quản lý thủ công**: CRUD chi phí, doanh thu, khách hàng, sản phẩm, kênh bán
- 🤖 **Trợ lý AI**: Nhập liệu bằng giọng nói, OCR hoá đơn, phân tích số liệu
- 🐱 **Mascot Lucky**: Mèo hoạt hình tương tác, phản ứng theo thao tác
- ☁️ **Đồng bộ đa thiết bị**: Supabase Auth + Sync

---

## 🎯 Tính năng

| Module | Mô tả |
|:---|:---|
| 📊 **Dashboard** | KPI cards (Doanh thu, Chi phí, Lợi nhuận, Công nợ, Đơn chờ), chart thu chi 7 ngày |
| 💰 **Chi phí** | CRUD, 10 danh mục, tìm kiếm & lọc, chọn nhiều xoá hàng loạt |
| 📦 **Doanh thu** | Đơn hàng, khách hàng, sản phẩm, kênh bán, trạng thái đơn & thanh toán |
| 📊 **Báo cáo** | 8 loại báo cáo: Chi phí, Doanh thu, Lợi nhuận, Hàng hoá, Công nợ, Khách hàng, Sản phẩm, Kênh bán |
| 🤖 **Trợ lý AI** | Chat, nhập liệu giọng nói, OCR hoá đơn, phân tích số liệu |
| 🔌 **Hybrid AI** | Kilo Free → Gemini → OpenRouter → SiliconFlow → Groq → WebLLM local |
| 🐱 **Mascot** | Mèo SVG hoạt hình, đi lại trên giao diện, phản ứng CRUD |
| 🔐 **Auth** | Supabase email/password, đăng ký có xác nhận mật khẩu |

---

## 🏗️ Tech Stack

| Layer | Công nghệ |
|:---|:---|
| **UI** | React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui |
| **State** | Zustand 5 |
| **Router** | React Router 7 |
| **Charts** | Recharts 2 |
| **Icons** | Lucide React |
| **AI** | Kilo Free · Gemini · OpenRouter · SiliconFlow · Groq · WebLLM (Qwen3-4B) |
| **Storage** | SQLite (sql.js WASM) · Supabase |
| **Build** | Vite 6 |
| **Test** | Vitest 3 |
| **Deploy** | GitHub Pages + Actions |
| **PWA** | Service Worker + Web App Manifest |

---

## 🚀 Cài đặt & Chạy

```bash
git clone https://github.com/tranquoc/quan-ly-thu-chi.git
cd quan-ly-thu-chi
npm install
npm run dev        # → http://localhost:5173
npm run build      # Production build → dist/
```

### Yêu cầu

- Node.js ≥ 20
- Trình duyệt: Chrome 90+, Edge 90+, Firefox 90+, Safari 15+

### Cấu hình Supabase (tuỳ chọn)

Tạo file `.env` từ `.env.example`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Không có Supabase, app vẫn chạy offline với SQLite local.

---

## 📚 Tài liệu

| # | Tài liệu | Nội dung |
|:--|:---|:---|
| | [README](README.md) | Tổng quan dự án |
| | [RELEASE](RELEASE.md) | Lịch sử phát hành & quy trình release |
| | [CHANGELOG](CHANGELOG.md) | Nhật ký thay đổi qua các phiên bản |
| 01 | [Kiến trúc](docs/01-architecture.md) | Tổng quan kiến trúc, công nghệ, luồng dữ liệu |
| 02 | [Data Models](docs/02-data-models.md) | Entity, TypeScript types |
| 03 | [UI Design](docs/03-ui-design.md) | Design tokens, components |
| 06 | [SRS](docs/06-SRS.md) | Yêu cầu chức năng & phi chức năng |
| 07 | [BRD](docs/07-BRD.md) | Phân tích nghiệp vụ |
| 13 | [Theme](docs/13-theme-tokens.md) | CSS variables, tokens |
| 14 | [Standards](docs/14-development-standards.md) | Quy chuẩn code |
| 15 | [Build & Deploy](docs/15-user-dev-build-deploy-guide.md) | Hướng dẫn dev, build, deploy |

---

## 📦 Cấu trúc thư mục

```
quan-ly-thu-chi/
├── public/                    # Static assets (logo, manifest, sw.js)
├── src/
│   ├── ui/                    # UI Layer
│   │   ├── screens/           # Màn hình (expense, revenue, report, settings...)
│   │   ├── components/        # Shared components (AuthGuard, Mascot...)
│   │   ├── theme/             # Design tokens
│   │   └── Layout.tsx         # App shell
│   ├── store/                 # Zustand stores
│   ├── services/              # Business logic + API clients
│   ├── models/                # TypeScript types
│   └── utils/                 # Helpers (currency, date, cn...)
├── docs/                      # Tài liệu dự án
├── supabase/                  # Supabase functions & migrations
├── test/                      # Test acceptance
└── package.json
```

---

## 🤝 Đóng góp

1. Fork repository
2. Tạo branch: `git checkout -b feature/ten-tinh-nang`
3. Commit: `git commit -m 'Thêm tính năng X'`
4. Push: `git push origin feature/ten-tinh-nang`
5. Tạo Pull Request

---

## ⚖️ License

MIT — Xem [LICENSE](LICENSE)

---

**Quản Lý Tài Chính** — Đơn giản, thông minh, hiệu quả.
