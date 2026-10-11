# PLAN

## Wave 1 (Thu gọn thang ngược từ dưới lên trên vào ba lô khi lên đỉnh)
- T1 | REQ-3 | src/ui/components/MascotLadder.tsx | consumes: none | produces: upward ladder packing retraction calculation and testable state | kept: npx vitest run src/ui/components/MascotLadder.test.tsx ("✓ src/ui/components/MascotLadder.test.tsx (3 tests)") | verify: npx vitest run src/ui/components/MascotLadder.test.tsx

## Wave 2 (Khống chế cự ly thang cục bộ 36px đến 160px và bảo vệ chân thang khỏi vùng cấm)
- T2 | REQ-1 | src/ui/components/MascotOverlay.tsx | consumes: upward ladder packing retraction calculation and testable state | produces: local ladder height clamp 36px to 160px and bottom boundary protection | kept: npx vitest run src/ui/components/MascotLadder.test.tsx ("✓ src/ui/components/MascotLadder.test.tsx (3 tests)") | verify: npx tsc --noEmit

## Wave 3 (Kiểm thử tự động cho cơ chế rút thang ngược)
- T3 | REQ-2 | src/ui/components/MascotLadder.test.tsx | consumes: local ladder height clamp 36px to 160px and bottom boundary protection | produces: automated tests for upward packing retract and rung calculation | kept: npx vitest run src/ui/components/MascotLadder.test.tsx ("✓ src/ui/components/MascotLadder.test.tsx (3 tests)") | verify: npx vitest run src/ui/components/MascotLadder.test.tsx

## Wave 4 (Kiểm thử tự động cho giới hạn cự ly thang leo cục bộ)
- T4 | REQ-1 | src/ui/components/MascotOverlay.test.tsx | consumes: local ladder height clamp 36px to 160px and bottom boundary protection | produces: tests verifying ladder height clamp rejects distance above 160px | kept: npx vitest run src/ui/components/MascotLadder.test.tsx ("✓ src/ui/components/MascotLadder.test.tsx (3 tests)") | verify: npx vitest run src/ui/components/MascotOverlay.test.tsx
