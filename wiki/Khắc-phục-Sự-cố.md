# Khắc phục Sự cố

## App không load / Trắng màn hình

1. **Mở DevTools** (F12) → tab Console → xem lỗi đỏ
2. **Xoá cache**: Ctrl+Shift+Del → Xoá "Cookies and site data"
3. **Thử incognito**: Mở cửa sổ ẩn danh để loại trừ extension
4. **Build lại**: `npm run build` → mở `dist/index.html`

## Lỗi Supabase

### "Invalid API key" / "JWT expired"

- Kiểm tra `.env` — `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` phải đúng
- Restart dev server sau khi sửa `.env`

### "Row level security" / Không thấy dữ liệu

- Đăng nhập lại
- Kiểm tra RLS policies trong Supabase Dashboard

## Lỗi AI

### WebLLM "WebGPU not supported"

- Dùng Chrome/Edge phiên bản ≥ 113
- Trên Windows: cập nhật driver đồ hoạ
- Fallback: tắt WebLLM, dùng Kilo Free hoặc Gemini

### Gemini "429 Resource exhausted"

- Hết quota free-tier. Đợi ~1 phút rồi thử lại
- Hoặc chuyển sang dùng Kilo Free (miễn phí, không cần key)

### Kilo Free "CORS/proxy error"

- Kilo Free yêu cầu CORS proxy. Nếu bị chặn:
  1. Kiểm tra mạng (tường lửa công ty có thể chặn)
  2. Thử dùng Gemini hoặc WebLLM thay thế

## Đồng bộ

### Icon đồng bộ màu đỏ

- Kiểm tra kết nối mạng
- Vào Cài đặt → kiểm tra Supabase đã kết nối chưa
- Click icon đồng bộ để thử lại

### Dữ liệu không khớp giữa các thiết bị

- Đảm bảo cả 2 thiết bị đều online
- Đợi vài giây để sync tự động
- Thử refresh trang (F5)

## PWA

### Không cài được PWA

- Phải mở app qua HTTPS (GitHub Pages hoặc localhost)
- Chrome: Menu → "Add to Home Screen"

---

→ [Trang chủ Wiki](Home)
