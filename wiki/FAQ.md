# FAQ — Câu hỏi Thường gặp

## Tài khoản & Đăng nhập

### Tôi có cần tài khoản để dùng app không?

**Không bắt buộc.** Bạn có thể dùng app hoàn toàn offline với SQLite local. Supabase Auth là tuỳ chọn để đồng bộ đa thiết bị.

### Quên mật khẩu thì làm sao?

Hiện tại app chưa có chức năng "Quên mật khẩu". Vui lòng dùng Supabase Dashboard để reset mật khẩu, hoặc tạo tài khoản mới.

---

## Dữ liệu

### Dữ liệu của tôi lưu ở đâu?

- **Không có Supabase**: Toàn bộ trong IndexedDB của browser (SQLite WASM)
- **Có Supabase**: Đồng bộ lên Supabase + cache local

### Làm sao để sao lưu dữ liệu?

Hiện tại chưa có tính năng export. Dữ liệu SQLite nằm trong IndexedDB của browser — bạn có thể dùng DevTools để export.

### Chuyển dữ liệu giữa các máy thế nào?

Kết nối Supabase — dữ liệu sẽ tự động đồng bộ giữa các thiết bị.

---

## AI

### AI nào miễn phí?

- **Kilo Free**: Miễn phí, ~200 req/h, tự động chọn model
- **WebLLM**: Chạy local trên máy, không giới hạn, cần tải model 1 lần
- **Gemini**: Free-tier 1.500 req/ngày với model Flash

### WebLLM báo lỗi "WebGPU not supported"?

Trình duyệt của bạn không hỗ trợ WebGPU. Thử dùng Chrome/Edge phiên bản mới nhất, hoặc chuyển sang dùng Kilo Free/Gemini.

### Tôi muốn thêm AI provider khác?

Hiện tại hỗ trợ: Kilo Free, Gemini, OpenRouter, SiliconFlow, Groq, WebLLM. Vào Cài đặt → tab AI để cấu hình.

---

## Lỗi thường gặp

### App không load được / trắng màn hình

1. Mở DevTools (F12) → tab Console để xem lỗi
2. Thử `npm run dev` thay vì build production
3. Xoá cache browser (Ctrl+Shift+Del)

### Supabase báo lỗi "Invalid API key"

Kiểm tra lại `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` trong file `.env`. Phải restart dev server sau khi sửa `.env`.

### Đồng bộ không hoạt động

1. Kiểm tra kết nối mạng
2. Vào Cài đặt → kiểm tra trạng thái Supabase
3. Xem icon đồng bộ ở góc trên bên phải (🟢 = đã sync, 🟡 = đang sync, 🔴 = lỗi)

---

## Khác

### App có hỗ trợ mobile không?

Có — cài qua PWA từ browser (Chrome → "Add to Home Screen").

### Tôi muốn đóng góp code

Xem [Hướng dẫn Đóng góp](Hướng-dẫn-Đóng-góp).

### Tôi muốn báo lỗi

Tạo [Issue trên GitHub](https://github.com/tranquoc/quan-ly-thu-chi/issues). Mô tả rõ các bước để tái hiện lỗi, kèm ảnh chụp màn hình.

---

→ [Trang chủ Wiki](Home)
