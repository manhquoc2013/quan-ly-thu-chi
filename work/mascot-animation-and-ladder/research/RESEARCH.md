# Research: Mascot Animation & Ladder Overhaul

## 1. Product Value & Impact
- **Người dùng hưởng lợi:** Người dùng sử dụng web app quản lý thu chi, tương tác với trợ lý Mèo Nấm. Chuyển động leo thang rút từ ba lô và nhảy dù tiếp đất bồng bềnh mang lại nét dễ thương, độc đáo và chuyên nghiệp thay vì dây móc bay khắp màn hình gây rối mắt.
- **Tùy biến & kiểm soát:** Người dùng có thể chủ động Bật/Tắt Mascot trong Cài đặt hoặc Quick Hide từ context menu khi cần tập trung vào số liệu hoặc làm việc trên màn hình nhỏ.

## 2. Current Code Audit
- [MascotOverlay.tsx](file:///Users/tranquoc/Developer/quan-ly-thu-chi/src/ui/components/MascotOverlay.tsx):
  - Định nghĩa action type `Action` bao gồm `'grapple'`.
  - Có các hàm xử lý quăng dây: `scanPlatforms()`, `isLatchableLedge()`, `clearRope()`, `ropeOn`, `ropeLineRef`, `ropeHookRef` và render SVG `<line>` + `<path>` hook claw.
  - Xử lý rơi tự do / nhảy dù: `doFall()`, `CHUTE_MIN_DROP`, `parachute` state.
- [NamCatPuppet.tsx](file:///Users/tranquoc/Developer/quan-ly-thu-chi/src/ui/components/NamCatPuppet.tsx):
  - Render SVG nhân vật Mèo Nấm với các bộ phận: đầu, tai, mắt, miệng, thân, chân, tay, đuôi.
  - Hiện tại cử động tai và đuôi còn đơn giản, chưa có secondary inertia và squash & stretch phản hồi nhịp nhàng theo chuyển động rơi/leo.
- [mascotStore.ts](file:///Users/tranquoc/Developer/quan-ly-thu-chi/src/store/mascotStore.ts):
  - Chứa state của mascot: `visible`, `isDocked`, `activity`, `voiceEnabled`,... Lưu qua middleware `persist`.
  - Cần thêm thuộc tính `enabled: boolean` (mặc định `true`), action `setEnabled: (enabled: boolean) => void` và đảm bảo đồng bộ với `visible`.
- [SettingsScreen.tsx](file:///Users/tranquoc/Developer/quan-ly-thu-chi/src/ui/screens/settings/SettingsScreen.tsx):
  - Tab `mascot` hiện có điều khiển hoạt động, giọng nói, loa thông báo, nhưng chưa có switch Bật / Tắt Mascot tổng thể.
- [LucyControlDeck.tsx](file:///Users/tranquoc/Developer/quan-ly-thu-chi/src/ui/components/LucyControlDeck.tsx):
  - Modal điều khiển nhanh khi click chuột phải hoặc bấm nút cài đặt trên Mascot, cần có nút tắt/ẩn mascot nhanh chóng.

## 3. Feasibility, Risks & Approach
- **Khả thi:** 100% khả thi với SVG và React/RAF.
- **Rủi ro:**
  - Logic va chạm khi leo thang: Cần tính toán chân thang đặt ở bục xuất phát và đỉnh thang gác lên bục đích.
  - Performance: Tránh re-render không cần thiết trong vòng lặp RAF; giữ animation thang và dù độc lập, dùng CSS transitions/SVG transforms.
- **Tiếp cận:** Build module `MascotLadder.tsx` chuyên trách, refactor `MascotOverlay.tsx` để thay thế `grapple` bằng ladder locomotion, tinh chỉnh `NamCatPuppet.tsx` và bổ sung toggle toggle store/UI.

## 4. Verdict
Verdict: GO
