# Cài đặt

Truy cập qua sidebar: **Cài đặt** (biểu tượng ⚙️).

---

## 1. Tab Tài khoản & Sổ chung

- **Hồ sơ cửa hàng**: Xem và chỉnh sửa tên cửa hàng, số điện thoại, địa chỉ kinh doanh.
- **Đổi mật khẩu**: Cập nhật mật khẩu tài khoản Supabase an toàn.
- **Sổ chung (Supabase Cloud)**: Trạng thái đồng bộ, tạo sổ dùng chung hoặc tham gia sổ của gia đình/cửa hàng qua mã mời.

---

## 2. Tab AI Providers

Quản lý toàn diện các mô hình trí tuệ nhân tạo:

![Cấu hình AI Providers](images/08-settings-ai.png)

- **Kilo Free (kilo-auto/free)**: Miễn phí hoàn toàn qua Kilo Gateway, không cần API key.
- **Gemini API**: Nhập API key từ Google AI Studio, tự động chọn model Flash/Flash-Lite tốt nhất.
- **Groq / OpenRouter / SiliconFlow**: Kết nối các nhà cung cấp AI hiệu năng cao.
- **AI Cục bộ (WebLLM)**: Chạy mô hình Qwen3-4B trực tiếp trên máy thông qua WebGPU.
- **Sắp xếp thứ tự ưu tiên**: Kéo thả / bấm nút để ưu tiên provider xử lý theo ý muốn.

---

## 3. Tab Mascot (Linh vật Lucy)

Cấu hình trợ lý tài chính và bạn đồng hành ảo:

![Cấu hình Linh vật Lucy](images/07-settings-mascot.png)

- **Mức độ hoạt động**:
  * **Ít (thư giãn)**: Lucy yên tĩnh, ít đi lại.
  * **Vừa (mặc định)**: Đi dạo tự nhiên quanh bàn làm việc.
  * **Nhiều (năng động)**: Chạy nhảy hoạt bát, nhiều biểu cảm.
  * *Lưu ý: Lucy luôn tuân thủ nghiêm ngặt mức độ đã cấu hình, không bị tự ý thay đổi khi tương tác.*
- **Giọng đọc tiếng Việt (Lucy nói chuyện)**:
  * Bật/tắt phát âm tiếng Việt tự nhiên và mấp máy khẩu hình.
  * Lựa chọn 4 âm sắc: **Dễ thương**, **Tự nhiên**, **Điềm đạm**, **Năng động**.
  * Chọn giọng đọc TTS trong hệ thống kèm nút **🔊 Thử giọng**.
- **Thông báo đơn hàng bằng giọng nói**: Tự động đọc to chúc mừng khi có đơn mới hoặc khi đơn hoàn thành.
- **Hiệu ứng âm thanh (SFX)**: Bật/tắt âm thanh leng keng, meow, purr. Khi tắt, Lucy tuyệt đối không phát ra âm thanh.
- **Ghim tại góc bàn (Desk Companion)**: Giữ cố định Lucy ở góc phải dưới màn hình.

Xem chi tiết tại: [Trợ lý Linh vật Mèo Lucy](Mèo-Lucy).

---

## 4. Tab Thông tin

- Phiên bản ứng dụng hiện tại (v2.1.0).
- Công nghệ sử dụng: React 19, Vite, Tailwind CSS v4, Zustand 5, IndexedDB, Playwright.

---

→ [Trang chủ Wiki](Home) · [Trợ lý Linh vật Lucy](Mèo-Lucy)
