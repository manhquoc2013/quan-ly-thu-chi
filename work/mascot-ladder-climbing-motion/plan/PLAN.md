# PLAN

## Wave 1 (Thanh lọc grapple khỏi mascotLines)
- T1 | REQ-1 | src/services/mascotLines.ts | consumes: none | produces: clean LandVibe without grapple | kept: npx vitest run src/ui/components/MascotLadder.test.tsx ("✓ src/ui/components/MascotLadder.test.tsx (3 tests)") | verify: npx tsc --noEmit

## Wave 2 (Tối ưu tư thế bám bậc leo thang trong NamCatPuppet)
- T2 | REQ-2 | src/ui/components/NamCatPuppet.tsx | consumes: none | produces: vertical ladder rung climbing keyframes and puppet limb cycle | kept: npx vitest run src/ui/components/MascotLadder.test.tsx ("✓ src/ui/components/MascotLadder.test.tsx (3 tests)") | verify: npx tsc --noEmit

## Wave 3 (Quỹ đạo leo thẳng đứng & Trình tự bung/thu thang thực tế trong MascotOverlay)
- T3 | REQ-3 | src/ui/components/MascotOverlay.tsx | consumes: clean LandVibe without grapple, vertical ladder rung climbing keyframes and puppet limb cycle | produces: realistic ladder positioning at ladderX - W / 2, zero spinAngle, vertical ascent and descent, deploy-climb-pack sequence | kept: npx vitest run src/ui/components/MascotLadder.test.tsx ("✓ src/ui/components/MascotLadder.test.tsx (3 tests)") | verify: npx tsc --noEmit

## Wave 4 (Kiểm thử tự động cho chuyển động leo thang thực tế)
- T4 | REQ-2 | src/ui/components/MascotOverlay.test.tsx | consumes: realistic ladder positioning at ladderX - W / 2, zero spinAngle, vertical ascent and descent, deploy-climb-pack sequence | produces: automated tests asserting vertical ladder climb and absence of grapple sway | kept: npx vitest run src/ui/components/MascotLadder.test.tsx ("✓ src/ui/components/MascotLadder.test.tsx (3 tests)") | verify: npx vitest run src/ui/components/MascotOverlay.test.tsx
