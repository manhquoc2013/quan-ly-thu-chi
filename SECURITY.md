# Chính sách Bảo mật

## Báo cáo Lỗ hổng

Nếu bạn phát hiện lỗ hổng bảo mật, vui lòng **KHÔNG** tạo Issue công khai. Thay vào đó, gửi email chi tiết tới maintainer qua GitHub private vulnerability reporting hoặc email cá nhân.

Chúng tôi sẽ phản hồi trong vòng 48 giờ và cập nhật tiến độ xử lý.

## Phiên bản được Hỗ trợ

| Phiên bản | Hỗ trợ |
|:---|:---|
| 1.4.x | ✅ Hỗ trợ đầy đủ |
| 1.3.x | ✅ Hỗ trợ đầy đủ |
| < 1.3.0 | ❌ Không còn hỗ trợ |

Luôn khuyến nghị cập nhật lên phiên bản mới nhất.

## Mô hình Bảo mật

Ứng dụng **không có máy chủ trung tâm**. Dữ liệu được lưu trữ và xử lý tại các vị trí sau:

| Vị trí | Loại dữ liệu | Biện pháp bảo vệ |
|:---|:---|:---|
| **SQLite local** (sql.js WASM) | Toàn bộ dữ liệu thu chi | Chỉ truy cập từ browser cùng origin |
| **IndexedDB** | Cache, session, API keys | Same-origin policy của browser |
| **Supabase** (tuỳ chọn) | Bản sao đồng bộ | Row Level Security (RLS), Auth token |
| **Local Storage** | Theme, cấu hình UI | Không chứa dữ liệu nhạy cảm |

### Nguyên tắc cốt lõi

1. **Không gửi dữ liệu về máy chủ trung tâm** — mọi dữ liệu nằm trong browser hoặc Supabase của chính bạn
2. **API key do người dùng tự cung cấp** — Gemini, OpenRouter, SiliconFlow, Groq keys được lưu trong IndexedDB
3. **Không hardcode secret** — không có API key, token, hay mật khẩu nào trong source code
4. **HTTPS toàn bộ** — deploy trên GitHub Pages với HTTPS mặc định

## Các API Key Bên Thứ ba

| Provider | Lưu trữ | Mã hoá |
|:---|:---|:---|
| Gemini API Key | IndexedDB | `localStorage` (browser sandbox) |
| OpenRouter API Key | IndexedDB | `localStorage` |
| SiliconFlow API Key | IndexedDB | `localStorage` |
| Groq API Key | IndexedDB | `localStorage` |
| Supabase Anon Key | Biến môi trường (`VITE_*`) | Bundle vào JS — chỉ là key công khai |

> **Lưu ý**: Supabase Anon Key là key **công khai**, được thiết kế để暴露 trong client-side code. Quyền truy cập dữ liệu thực tế được kiểm soát bởi Row Level Security (RLS) policies trên Supabase.

## Xác thực Supabase

- Hỗ trợ email/password qua Supabase Auth
- Session được lưu trong IndexedDB
- Row Level Security (RLS) đảm bảo mỗi user chỉ thấy dữ liệu của mình
- Không lưu mật khẩu trong ứng dụng — mọi xác thực qua Supabase API

## Các Biện pháp Đề xuất cho Người Dùng

1. **Luôn dùng HTTPS** — ứng dụng đã deploy trên GitHub Pages với HTTPS
2. **Không chia sẻ API key** — mỗi key là cá nhân, không share qua chat, email
3. **Kiểm tra quyền Supabase** — đảm bảo RLS policies được cấu hình đúng
4. **Cập nhật thường xuyên** — phiên bản mới có thể chứa bản vá bảo mật
5. **Sao lưu dữ liệu** — dữ liệu SQLite local có thể export ra file

## Dependency Security

Dự án dùng Dependabot để tự động cập nhật dependencies. Các pull request được tạo tự động khi có bản vá bảo mật cho dependencies.

## Phạm vi

Các vấn đề sau nằm **ngoài phạm vi** bảo mật của dự án:

- Lỗ hổng trong trình duyệt (Chrome, Firefox, Safari, Edge)
- Lỗ hổng trong Supabase platform
- Lỗ hổng trong Google Gemini API, OpenRouter, hoặc các AI provider bên thứ ba
- Social engineering hoặc phishing nhắm vào người dùng
- Máy tính của người dùng bị compromise (keylogger, malware)

---

**Cập nhật**: 2026-08-09 · **Phiên bản**: 1.4.0
