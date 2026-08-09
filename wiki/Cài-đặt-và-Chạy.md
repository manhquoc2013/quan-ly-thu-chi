# Cài đặt & Chạy ứng dụng

## Yêu cầu Hệ thống

- **Node.js** ≥ 20
- **Trình duyệt**: Chrome 90+, Edge 90+, Firefox 90+, Safari 15+
- **Hệ điều hành**: Windows, macOS, Linux

## Cài đặt

```bash
# Clone repository
git clone https://github.com/tranquoc/quan-ly-thu-chi.git
cd quan-ly-thu-chi

# Cài dependencies
npm install

# Chạy dev server
npm run dev
# → Mở http://localhost:5173
```

## Build Production

```bash
npm run build
# Output: dist/
```

## Cấu hình Supabase (tuỳ chọn)

Tạo file `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Không có Supabase, ứng dụng vẫn hoạt động bình thường với SQLite local + IndexedDB.

## Deploy

Ứng dụng tự động deploy lên GitHub Pages khi push tag version (VD: `v1.4.0`).

```bash
git tag v1.4.0
git push origin v1.4.0
```

→ [Trang trước: Home](Home)
