# Quản Lý Tài Chính

> **Phiên bản**: 2.3.0 · **Cập nhật**: 2026-10-11

Ứng dụng quản lý tài chính & bán hàng thông minh, tích hợp trợ lý AI đa tầng (Hybrid AI), công cụ Chuẩn hoá dữ liệu nhập liệu bằng AI, tuỳ biến mức độ hoạt hoạ chống nhấp nháy, trợ lý linh vật Mèo Nấm 3D Pixar Chibi tương tác vật lý (5 trang phục đa năng, leo trèo bò trườn, bước đi trên hàng chữ DOM và tự động đổi trang phục theo ngữ cảnh), lưu trữ local (IndexedDB/SQLite) kết hợp đồng bộ đám mây Supabase Cloud Sync. Hỗ trợ PWA và CI/CD deploy lên GitHub Pages.

---

## 📌 Giới thiệu

**Quản Lý Tài Chính** giúp chủ tiệm và người kinh doanh theo dõi thu chi hàng ngày một cách thông minh, kỷ luật và hiệu quả. Ứng dụng kết hợp:

- 📊 **Quản lý bán hàng & dòng tiền**: CRUD chi phí, doanh thu, đơn hàng, khách hàng, sản phẩm, kênh bán
- 🤖 **Trợ lý AI đa phương thức**: Nhập liệu bằng giọng nói, OCR quét hoá đơn, phân tích số liệu tài chính chuyên sâu
- ✨ **Chuẩn hoá dữ liệu AI**: Quét tự động & chuẩn hoá lỗi tiếng Việt, định dạng SĐT 10 số, đồng bộ đơn vị tính & danh mục
- 🎬 **Kiểm soát Hoạt hoạ Toàn diện**: 3 cấp độ hoạt hoạ (Full / Reduced / Off), chống FOUC với Pre-mount Splash Screen
- 🐱 **Mèo Nấm — Trợ lý linh vật 3D Pixar Chibi**: 5 bộ trang phục module (Tài chính, Hỗ trợ, Kỹ thuật, Bán hàng, Thư giãn), tương tác vật lý sống động (vấp ngã, bò nấp, leo trèo, đi trên hàng chữ), âm thanh procedural sống động, tổng hợp giọng nói tiếng Việt (4 âm sắc), thông báo đơn hàng tự động, chế độ tập trung Pomodoro
- ☁️ **Đồng bộ đa thiết bị**: Supabase Auth + Cloud Sync thời gian thực

---

## 🎯 Tính năng

| Module | Mô tả |
|:---|:---|
| 📊 **Dashboard** | KPI cards (Đã thu, Chi phí, Việc cần xử lý, Sản phẩm cần làm), biểu đồ dòng tiền 7 ngày, thanh thao tác nhanh |
| 💰 **Chi phí** | CRUD, 10 danh mục chuẩn hoá, tìm kiếm & lọc, thao tác xoá/xuất hàng loạt |
| 📦 **Doanh thu** | Quản lý đơn hàng, khách hàng, sản phẩm, kênh bán, trạng thái đơn & thanh toán, in hoá đơn A6 |
| 📊 **Báo cáo** | 8 phân hệ báo cáo chuyên sâu: Chi phí, Doanh thu, Lợi nhuận, Hàng hoá (FIFO), Công nợ, Khách hàng, Sản phẩm, Kênh bán |
| ✨ **Chuẩn hoá Dữ liệu AI** | Tự động quét và chuẩn hoá dữ liệu sai quy chuẩn (dấu câu tiếng Việt, SĐT 10 số, danh mục, đơn vị tính) qua LLM Cascade & Heuristic, xem trước Diff trực quan |
| 🎬 **Hiệu ứng & Hoạt hoạ** | 3 cấp độ (Full/Reduced/Off), công tắc chi tiết, Pre-mount Splash chống FOUC, khung thử nghiệm Motion Playground |
| 🤖 **Trợ lý AI** | Chat ngôn ngữ tự nhiên, nhập liệu giọng nói 🎤, OCR hoá đơn 📷, phân tích P&L |
| 🔌 **Hybrid AI** | Kilo Free → Gemini → OpenRouter → SiliconFlow → Groq → WebLLM (Qwen 2.5 local GPU) |
| 🐱 **Mèo Nấm (3D Pixar Mascot)** | Linh vật mèo Chibi 3D Pixar, 5 trang phục module, cử động phong phú (vấp ngã, bò nấp, leo trèo, đi trên hàng chữ), âm thanh procedural Web Audio, 4 âm sắc tiếng Việt, tự động đổi đồ theo ngữ cảnh, đọc đơn hàng, Pomodoro |
| 🔐 **Auth & Sổ chung** | Supabase email/password, phân quyền và sổ dùng chung gia đình/cửa hàng |

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
| | [Wiki](https://github.com/manhquoc2013/quan-ly-thu-chi/wiki) | Tài liệu hướng dẫn sử dụng & ảnh chụp màn hình v2.3.0 |
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
