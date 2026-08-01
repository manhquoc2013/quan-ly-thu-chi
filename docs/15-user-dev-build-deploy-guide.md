# Hướng dẫn toàn diện — Quản Lý Tài Chính

> **Phiên bản**: 1.0 · **Ngày**: 2026-08-01

---

## Mục lục

1. [Hướng dẫn sử dụng](#1-hướng-dẫn-sử-dụng)
2. [Hướng dẫn phát triển](#2-hướng-dẫn-phát-triển)
3. [Hướng dẫn build](#3-hướng-dẫn-build)
4. [Hướng dẫn deploy](#4-hướng-dẫn-deploy)

---

## 1. Hướng dẫn sử dụng

### 1.1 Cài đặt

#### Desktop App (Portable)

1. Tải file `QuanLyThuChi-portable-x.x.x.zip` từ [GitHub Releases](https://github.com/manhquoc2013/quan-ly-thu-chi/releases/latest)
2. Giải nén vào thư mục cố định, ví dụ: `C:\QuanLyThuChi\`
3. Chạy `QuanLyThuChi.exe`
4. **Không cần cài đặt gì** — Java, Node.js, Chrome đều đã được bundle sẵn

```
QuanLyThuChi-portable-1.0.0/
├── QuanLyThuChi.exe        ← Double-click để chạy
├── version.txt
└── README.txt
```

> Nếu Windows SmartScreen chặn: **More info → Run anyway** (file chưa ký số).

#### Docker (LAN nhiều máy)

```bash
# 1. Tải docker-compose.yml
wget https://raw.githubusercontent.com/.../docker-compose.yml

# 2. Chạy
docker compose up -d

# 3. Truy cập từ mọi thiết bị trong LAN
http://192.168.1.10:5173
```

#### Mobile (PWA)

1. Mở browser trên điện thoại → `http://IP:5173`
2. Chrome: Menu (⋮) → **Thêm vào màn hình chính**
3. Safari: Share → **Thêm vào màn hình chính**
4. App sẽ xuất hiện như app native, có icon riêng

### 1.2 Lần đầu sử dụng

#### Kết nối Google Drive (tùy chọn)

1. Vào **Cài đặt** → **Google Drive**
2. Nhấn **Kết nối Google Drive** → popup OAuth2 mở ra
3. Đăng nhập tài khoản Google → cấp quyền
4. App tự động tạo thư mục `QuanLyThuChi/` trên Drive
5. Nếu đã có dữ liệu trên Drive → tự động tải về

> Nếu **không kết nối Drive**: dữ liệu chỉ lưu local. Mất nếu xóa app.

#### Cấu hình AI (tùy chọn)

1. Vào **Cài đặt** → **Cấu hình AI**
2. (Tùy chọn) Nhập Gemini API Key để dùng cloud AI:
   - Vào [Google AI Studio](https://aistudio.google.com/apikey) → tạo key
   - Dán key vào → nhấn **Kiểm tra kết nối**
3. AI offline (WebLLM) tự động tải model 280MB khi chat lần đầu

### 1.3 Dashboard (Trang chủ)

Khi mở app, Dashboard hiển thị:

| Khu vực | Nội dung |
|:---|:---|
| **Summary Cards** | Tổng chi, tổng thu, lợi nhuận, đơn chờ — 7 ngày |
| **Chart Thu · Chi** | Biểu đồ cột chồng 7 ngày gần nhất |
| **Đơn hàng đang chờ** | Danh sách đơn chưa hoàn thành + thời gian đã chờ |
| **Giao dịch gần đây** | 8 giao dịch mới nhất (cả thu và chi) |

### 1.4 Quản lý Chi phí

| Thao tác | Cách làm |
|:---|:---|
| **Xem danh sách** | Tab "💰 Chi phí" → grid hiển thị tất cả |
| **Thêm mới** | Nút "＋ Thêm mới" → điền form → Lưu |
| **Sửa** | Click ✏️ trên dòng → sửa → Cập nhật |
| **Xóa** | Checkbox chọn dòng → "🗑 Xóa" → Xác nhận |
| **Đổi trạng thái** | Click badge trạng thái → chọn mới |
| **Upload hóa đơn** | Trong form thêm/sửa → kéo thả ảnh vào ô upload |

### 1.5 Quản lý Doanh thu

| Thao tác | Cách làm |
|:---|:---|
| **Tạo đơn hàng** | Tab "📦 Doanh thu" → "＋ Tạo đơn" |
| **Thêm sản phẩm** | Trong form → điền tên, SL, đơn giá → Thêm SP |
| **Tính tiền** | Tự động — tổng = SUM(SL × đơn giá) - giảm giá |
| **Đổi trạng thái** | Click badge trạng thái đơn / giao hàng |

### 1.6 Báo cáo

Tab "📈 Báo cáo" hiển thị:
- 4 summary cards (tổng chi, tổng thu, lợi nhuận, tỉ suất)
- Biểu đồ phân bổ chi phí theo danh mục
- Biểu đồ chi phí theo tháng

### 1.7 AI Chat (FAB 🤖)

| Cách mở | Nút 🤖 góc phải dưới màn hình (hoặc Ctrl+K) |
|:---|:---|
| **Chat cơ bản** | Gõ câu hỏi → AI trả lời (dùng WebLLM offline) |
| **Phân tích nâng cao** | Cần Gemini API Key → tự động dùng cloud |
| **OCR hóa đơn** | Upload ảnh → AI đọc → tự động điền form chi phí |

Ví dụ câu hỏi:
- "Chi phí 7 ngày qua bao nhiêu?"
- "Đơn nào đang chờ xử lý?"
- "Phân tích xu hướng chi tiêu"
- "Làm sao tiết kiệm chi phí vận chuyển?"

### 1.8 Đồng bộ dữ liệu

| Chế độ | Cách hoạt động |
|:---|:---|
| **Standalone** | Mỗi lần CRUD → upload database.db lên Drive |
| **Docker LAN** | Server sync lên Drive mỗi 30 phút (backup) |

Status bar hiển thị trạng thái sync:
- 🟢 Đã đồng bộ
- 🟡 Đang đồng bộ...
- 🔴 Lỗi đồng bộ

---

## 2. Hướng dẫn phát triển

### 2.1 Yêu cầu hệ thống

| Công cụ | Phiên bản | Kiểm tra |
|:---|:---|:---|
| Node.js | ≥ 22 LTS | `node -v` |
| npm | ≥ 10 | `npm -v` |
| Git | ≥ 2.40 | `git --version` |
| Docker (tùy chọn) | ≥ 24 | `docker --version` |

### 2.2 Clone & Cài đặt

```bash
# 1. Clone repository
git clone https://github.com/manhquoc2013/quan-ly-thu-chi.git
cd quan-ly-thu-chi

# 2. Cài dependencies
npm install

# 3. Copy biến môi trường
cp .env.example .env

# 4. Chạy dev server
npm run dev
# → http://localhost:5173
```

### 2.3 Cấu trúc dự án

```
quan-ly-thu-chi/
├── src/
│   ├── models/          # TypeScript types + Zod schemas
│   ├── utils/           # Pure functions (formatVND, parseDate...)
│   ├── services/        # Business logic + external APIs
│   ├── store/           # Zustand stores
│   ├── hooks/           # Shared React hooks
│   ├── ui/
│   │   ├── theme/       # Design tokens (CSS vars + TS constants)
│   │   ├── components/  # Shared UI components (Button, Panel, Grid...)
│   │   └── screens/     # Page-level components
│   ├── Layout.tsx       # App shell
│   ├── App.tsx          # Router
│   └── main.tsx         # Entry point
├── electron/            # Electron main process
├── server/              # Docker API server
├── docs/                # Tài liệu dự án
├── preview/             # HTML preview
└── docker-compose.yml
```

### 2.4 Scripts

```bash
npm run dev              # Vite dev server (http://localhost:5173)
npm run dev:electron     # Dev với Electron window
npm run build            # Build React ra dist/
npm run build:electron   # Build + package Electron portable
npm run build:docker     # Build Docker images
npm run lint             # ESLint check (max-warnings=0)
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier format
npm run typecheck        # TypeScript type check
npm run test             # Vitest run
npm run test:watch       # Vitest watch mode
npm run test:coverage    # Vitest + coverage report
npm run validate         # lint + typecheck + test (CI)
```

### 2.5 Quy chuẩn code

Xem chi tiết: [`docs/14-development-standards.md`](docs/14-development-standards.md)

Tóm tắt:
- **1 file = 1 component/function** — không nhồi nhét
- **DRY tuyệt đối** — dùng ≥ 2 lần → extract ra shared
- **Named exports only** — không `export default`
- **Zod cho validation** — schema = type + validation, 1 nơi duy nhất
- **Shared components first** — kiểm tra `@components` trước khi viết mới
- **ESLint max-warnings=0** — warning = lỗi
- **Test coverage ≥ 60%** — CI fail nếu thấp hơn

### 2.6 Theme Tokens

```typescript
// Dùng CSS variables
<div className="bg-[var(--color-surface)] p-[var(--spacing-md)]">

// Dùng TypeScript constants
import { colors, spacing } from '@ui/theme';
<div style={{ color: colors.accentFg, padding: spacing.md }}>

// Dùng component presets
import { buttonPresets } from '@ui/theme';
<button className={buttonPresets.run.className}>
```

Xem chi tiết: [`docs/13-theme-tokens.md`](docs/13-theme-tokens.md)

### 2.7 Google OAuth2 (Development)

```bash
# .env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

1. Vào [Google Cloud Console](https://console.cloud.google.com)
2. APIs & Services → Credentials → Create OAuth 2.0 Client ID
3. Authorized JavaScript origins: `http://localhost:5173`
4. Copy Client ID vào `.env`

---

## 3. Hướng dẫn Build

### 3.1 Web Build (PWA)

```bash
# Build ra static files
npm run build
# → dist/

# Preview locally
npm run preview
# → http://localhost:4173

# Output:
dist/
├── index.html
├── assets/
│   ├── index-abc123.js     (~200KB gzipped)
│   ├── vendor-def456.js    (~100KB)
│   └── index-ghi789.css    (~30KB)
├── manifest.json
└── sw.js                   (service worker)
```

### 3.2 Electron Build (Portable Desktop)

```bash
# Build React + package Electron
npm run build:electron
# → release/

# Output:
release/
├── QuanLyThuChi-1.0.0-win-x64.exe      (~95MB)
├── QuanLyThuChi-1.0.0-mac-arm64.dmg     (~100MB)
├── QuanLyThuChi-1.0.0-linux-x64.AppImage (~95MB)
└── latest.yml                            (auto-update manifest)

# Tạo portable ZIP (Windows)
# ZIP chứa: QuanLyThuChi.exe + version.txt + README.txt
```

### 3.3 Docker Build

```bash
# Build images
docker compose build

# Hoặc build từng service
docker build -t thuchi-app -f Dockerfile .
docker build -t thuchi-api -f Dockerfile.api .
```

---

## 4. Hướng dẫn Deploy

### 4.1 Docker LAN (khuyến nghị cho văn phòng)

```bash
# 1. Pull hoặc build images
docker compose pull    # Từ registry
# hoặc
docker compose build   # Build local

# 2. Chạy
docker compose up -d

# 3. Kiểm tra
curl http://localhost:3001/api/health
# → {"status":"ok","db":"connected"}

# 4. Truy cập
# LAN: http://192.168.1.10:5173
# Local: http://localhost:5173

# Logs
docker compose logs -f api
docker compose logs -f app

# Dừng
docker compose down

# Cập nhật
docker compose pull
docker compose up -d
```

### 4.2 Vercel (PWA public)

```bash
# 1. Cài Vercel CLI
npm i -g vercel

# 2. Deploy
vercel --prod

# Hoặc connect GitHub repo → auto-deploy mỗi push
```

### 4.3 GitHub Releases (Portable Desktop)

```bash
# 1. Tag version
git tag v1.0.0
git push origin v1.0.0

# 2. GitHub Actions tự động:
#    - Build Electron trên Windows/macOS/Linux
#    - Tạo portable ZIP
#    - Upload lên GitHub Releases
#    - Cập nhật latest.yml cho auto-update
```

### 4.4 Tự host (Nginx static)

```bash
# Build static files
npm run build

# Copy vào Nginx
sudo cp -r dist/* /var/www/thuchi/

# Nginx config
server {
    listen 80;
    server_name thuchi.local;
    root /var/www/thuchi;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 4.5 Auto-Update (Electron)

Desktop app tự động kiểm tra phiên bản mới từ GitHub Releases:

```typescript
// electron/updater.ts
import { autoUpdater } from 'electron-updater';

autoUpdater.checkForUpdatesAndNotify(); // Kiểm tra khi mở app

// Người dùng sẽ thấy:
// "🆕 Có bản mới 1.0.1 — Tải về và cập nhật?"
```

---

## 5. FAQ

### App có cần internet không?

- **Có internet**: Google Drive sync, Gemini AI cloud hoạt động
- **Không internet**: Vẫn dùng bình thường — SQLite local, WebLLM offline. Dữ liệu sẽ sync khi có mạng trở lại

### Dữ liệu lưu ở đâu?

| Chế độ | Vị trí |
|:---|:---|
| Desktop (standalone) | IndexedDB + Google Drive |
| Docker LAN | `/app/data/thuchi.db` (volume) + Google Drive backup |
| Mobile (PWA) | IndexedDB + Google Drive |

### Làm sao backup dữ liệu?

1. **Tự động**: Google Drive sync (nếu đã kết nối)
2. **Thủ công**: Copy file `thuchi.db` từ thư mục data

### App chiếm bao nhiêu RAM/CPU?

| Trạng thái | RAM | CPU |
|:---|:---|:---|
| Idle (để không) | ~200MB | 2-3% |
| Đang làm việc | ~350MB | 5-10% |
| Chat AI (WebLLM) | ~1.2GB | 50-65% (2 nhân) |

WebLLM tự unload sau 2 phút không dùng, giải phóng RAM.

### Có giới hạn bao nhiêu dữ liệu?

- SQLite hỗ trợ đến **140 terabytes**, giới hạn thực tế là Google Drive (15GB free)
- Với 100K records: ~12MB — thoải mái
- Grid virtualized → hiển thị mượt dù bao nhiêu dòng
