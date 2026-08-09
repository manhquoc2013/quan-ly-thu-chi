---
status: resolved
trigger: lỗi dư khoảng trắng scroll ngang của table
created: 2026-08-09
updated: 2026-08-09
---

# Debug: table-trailing-whitespace

## Symptoms

- **expected:** table fill hết card
- **actual:** dư khoảng trắng phía sau cột cuối cùng của bảng (+ scroll ngang phantom)
- **errors:** không có log lỗi
- **timeline:** sau commit 50604c8ce853d8cc5d0f6277dc5c2c54e54b2285
- **reproduction:** mở màn có bảng (Doanh thu, Chi phí, …)

## Current Focus

- **hypothesis:** (confirmed) button ripple `::after { transform: scale(10) }` at rest + `clip-path` (không chặn scrollable overflow) phình `scrollWidth` của `[data-table-hscroll]`
- **test:** Playwright fixture — đo `scrollWidth` vs `clientWidth` với/không button; `overflow:hidden` vs `clip-path`
- **expecting:** scrollWidth > clientWidth khi có `data-slot="button"`; = khi overflow:hidden / bỏ ::after
- **next_action:** none — resolved

## Evidence

- timestamp: 2026-08-09
  - Fixture under app CSS: `clientW=1390`, `scrollW=1460` (+70) với action buttons; `scrollW=1390` khi bỏ buttons hoặc `overflow:hidden` trên button
  - `b1.scrollWidth=156` dù visual width ~28 — ::after scale(10) đóng góp overflow
  - `transform: none !important` trên button/::after → scrollW về 1390
  - `clip-path: inset(0)` không ngăn scrollable overflow; `overflow: hidden` thì có
  - Timeline khớp 50604c8 (thêm ripple CSS)

## Eliminated

- hypothesis: TableHScroll `minWidth` > tổng grid tracks gây whitespace
  - reason: grid có `1fr` + `width:100%`; repro thuần CSS không có phantom gap; fr tracks expand đúng
- hypothesis: bỏ `overflow-auto` ở 50604c8 là nguyên nhân trực tiếp
  - reason: regression thật sự là ripple CSS cùng commit; TableHScroll sau đó chỉ lộ phantom scroll

## Resolution

- **root_cause:** Ripple trên `[data-slot="button"]` dùng `::after { transform: scale(10) }` lúc nghỉ + chỉ `clip-path: inset(0)`. Pseudo bị scale vẫn nới `scrollWidth` của ancestor `overflow-x: auto` (`TableHScroll`) → scroll ngang giả và khoảng trắng sau cột cuối khi scroll.
- **fix:** `overflow: hidden` trên button; đổi ripple rest → `scale(0)`, active → `scale(2.5)`; cùng pattern cho `.btn-shimmer`.
- **verification:** Playwright fixture sau fix: `scrollW === clientW` (phantom 0), `afterTransform=matrix(0,0,0,0,0,0)`.
- **files_changed:** `src/index.css`
