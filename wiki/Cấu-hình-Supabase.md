# Cấu hình Supabase

## Tạo Supabase Project

1. Vào [supabase.com](https://supabase.com) → **New Project**
2. Đặt tên project, chọn region gần nhất (VD: Southeast Asia)
3. Đợi project khởi tạo (~2 phút)

## Lấy API Keys

1. Vào **Project Settings** → **API**
2. Copy 2 giá trị:
   - `Project URL` → dán vào `VITE_SUPABASE_URL`
   - `anon public key` → dán vào `VITE_SUPABASE_ANON_KEY`

## File .env

Tạo file `.env` ở thư mục gốc:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Restart dev server sau khi tạo `.env`.

## Cấu hình Auth

1. Vào **Authentication** → **Providers**
2. Bật **Email** provider
3. (Tuỳ chọn) Tắt **Confirm email** nếu đang dev

## Cấu hình Database

1. Vào **SQL Editor**
2. Chạy các migration trong thư mục `supabase/migrations/`

## Row Level Security

Tất cả bảng đều được bảo vệ bởi RLS policies. Mỗi user chỉ thấy dữ liệu của mình.

## Kiểm tra Kết nối

Vào app → **Cài đặt** → tab **Tài khoản** — nếu thấy "Đã kết nối" là thành công.

---

→ [Trang chủ Wiki](Home)
