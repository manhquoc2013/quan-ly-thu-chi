# Quản Lý Tài Chính

> **Trạng thái**: Đang phát triển · **Phiên bản**: 1.0.2 · **Cập nhật**: 2026-08-02

Ứng dụng quản lý tài chính cá nhân/doanh nghiệp nhỏ, tích hợp trợ lý AI, lưu trữ dữ liệu local (SQLite/IndexedDB) + Google Drive sync. Hỗ trợ PWA (cài như app native) và CI/CD tự động deploy lên GitHub Pages.

## 🎯 Tính năng chính

| Module | Mô tả |
|:---|:---|
| 📊 **Dashboard** | Trang chủ: chart thu chi 7 ngày, đơn đang chờ + thời gian chờ, giao dịch gần đây |
| 💰 **Quản lý Chi phí** | CRUD, danh mục, trạng thái, ảnh hóa đơn, tìm kiếm & lọc |
| 📦 **Quản lý Doanh thu** | Tạo đơn hàng, quản lý khách hàng, sản phẩm, trạng thái đơn & giao hàng |
| 📊 **Báo cáo (7 loại)** | Chi phí, Doanh thu, Lợi nhuận, Công nợ, Khách hàng, Sản phẩm, Kênh bán — biểu đồ tương tác |
| 🤖 **Kimi — Trợ lý AI** | Chat thông minh, nhập liệu bằng giọng nói/text, quy đổi ngoại tệ, điều hướng app |
| 📸 **AI OCR** | Nhập liệu từ ảnh chụp hóa đơn (cần Gemini Cloud), parse text thành đơn hàng |
| 🔌 **Hybrid AI** | **WebLLM local** (Gemma 2B, offline, miễn phí) + **Gemini Cloud** (online, mạnh mẽ). Tự động chọn provider |
| ☁️ **Google Drive** | Dữ liệu lưu trên Drive của bạn — bạn toàn quyền sở hữu |
| 💼 **Portable App** | Giải nén là chạy, không cần cài đặt (Windows, macOS, Linux) |
| 📱 **PWA** | Cài được trên mobile từ browser |

## 📚 Tài liệu dự án

| # | Tài liệu | Mô tả |
|:--|:---|:---|
| 01 | [Kiến trúc hệ thống](docs/01-architecture.md) | Tổng quan kiến trúc, công nghệ, luồng dữ liệu |
| 02 | [Mô hình dữ liệu](docs/02-data-models.md) | Entity relationship, TypeScript types, validation |
| 03 | [Thiết kế giao diện](docs/03-ui-design.md) | Design tokens, component library, screen layouts |
| 04 | [Kế hoạch triển khai (tổng quan)](docs/04-implementation-plan.md) | Lộ trình 6 giai đoạn, dependency graph |
| 05 | [Quyết định kỹ thuật](docs/05-technical-decisions.md) | Tại sao chọn công nghệ này, trade-off analysis |
| 06 | [SRS — Đặc tả yêu cầu](docs/06-SRS.md) | Yêu cầu chức năng & phi chức năng chi tiết |
| 07 | [BRD — Yêu cầu nghiệp vụ](docs/07-BRD.md) | Phân tích thị trường, mục tiêu, phạm vi |
| 08 | [ADD — Thiết kế kiến trúc](docs/08-ADD.md) | Kiến trúc chi tiết, component tree, data flow |
| 09 | [Kế hoạch triển khai (chi tiết)](docs/09-implementation-plan-detailed.md) | 69 tasks breakdown, ước lượng giờ, dependency |
| 10 | [Portable Packaging](docs/10-portable-packaging.md) | Đóng gói Electron portable như fe-simulator |
| 11 | [Hybrid AI Design](docs/11-hybrid-ai-design.md) | Kiến trúc AI lai: WebLLM local + Gemini cloud |
| 12 | [Resource Optimization](docs/12-resource-optimization.md) | Tối ưu CPU, RAM cho i3-9100, 8GB |
| 13 | [Theme Tokens & CSS](docs/13-theme-tokens.md) | Design tokens, Tailwind CSS 4, component style presets |
| 14 | [Development Standards](docs/14-development-standards.md) | Quy chuẩn code: DRY, Clean Code, shared components, linting |
| 15 | [User · Dev · Build · Deploy](docs/15-user-dev-build-deploy-guide.md) | Hướng dẫn toàn diện: sử dụng, phát triển, build, deploy |

## 🎨 Preview trực tiếp

Mở file trong browser để xem toàn bộ giao diện:

| File | Nội dung |
|:---|:---|
| [`preview/full-preview.html`](preview/full-preview.html) | **Preview đầy đủ**: Expense CRUD, Revenue, Report, AI Chat, Settings, Dialogs |
| [`preview/theme-preview.html`](preview/theme-preview.html) | Theme tokens: màu sắc, spacing, components |

## 🏗️ Tech Stack

| Layer | Technology |
|:---|:---|
| **UI** | React 19 + TypeScript + Tailwind CSS 4 |
| **State** | Zustand 5 |
| **Router** | React Router 7 |
| **Charts** | Recharts 2 |
| **Validation** | Zod 3 |
| **Cache** | IndexedDB (idb) |
| **AI** | WebLLM (Qwen 2.5 0.5B, local) + Gemini API (`@google/genai`, cloud) |
| **Storage** | SQLite (sql.js WASM) + Google Drive API v3 |
| **Desktop** | Electron 33 (portable packaging) |
| **Build** | Vite 6 |
| **Test** | Vitest 3 |
| **Deploy** | GitHub Pages + GitHub Actions CI/CD |
| **PWA** | Service Worker (manual) + Web App Manifest |

## 🚀 Bắt đầu

```bash
# 1. Clone repository
git clone https://github.com/tranquoc/quan-ly-thu-chi.git
cd quan-ly-thu-chi

# 2. Cài dependencies
npm install

# 3. Chạy dev server
npm run dev
# → http://localhost:5173

# Build production
npm run build

# Phát hành phiên bản (deploy GitHub Pages qua tag)
git tag v1.0.0 && git push origin v1.0.0
```

## ⚖️ License

MIT
