# Revenue Mobile Layout — Design Spec

**Date:** 2026-08-01  
**Status:** Approved (#1) — implementing  
**Scope:** Màn Doanh thu only (không đụng bottom nav / FAB shell)

## Goal

Mobile đọc được danh sách đơn; desktop giữ bảng.

## Design

- `<md`: card list — mã + kênh, ngày, khách, thành tiền, badge trạng thái/thanh toán, Sửa/Xóa (stopPropagation). Tap card → chi tiết.
- `md+`: `RevenueGrid` table hiện tại (`min-w-[980px]`).
- Toolbar mobile: search full-width; filters 2 cột; date 2 cột; “Tạo đơn hàng” full-width.

## Files

- `RevenueScreen.tsx` — toolbar responsive
- `RevenueGrid.tsx` — mobile cards + desktop table
