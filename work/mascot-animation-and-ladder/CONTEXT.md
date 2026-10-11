# Context: Mascot Animation & Ladder Overhaul

## 1. Outcome & Goals
- Thay thế hoàn toàn cơ chế quăng dây neo (grappling hook) bằng hệ thống thang gấp linh hoạt và dù lượn hạ cánh.
- Tối ưu hóa chuyển động tổng thể của Mèo Nấm: loại bỏ sự giật cục/cứng nhắc bằng cách bổ sung easing mượt mà, quán tính tự nhiên cho tai, đuôi, và hiệu ứng squash & stretch.
- Cung cấp cấu hình Bật / Tắt Mascot toàn diện (Settings tab Mascot + Quick hide từ context menu / deck) với trạng thái được lưu bền vững (persisted).

## 2. Requirements Specification
```text
REQ-1 | Loại bỏ hoàn toàn cơ chế quăng dây neo (grappling hook rope) di chuyển khắp màn hình | Không còn render dây neo hook SVG hay trigger hành động quăng dây khi di chuyển giữa các bục.
REQ-2 | Hoạt họa thang leo lên: rút thang gấp từ ba lô đặt xuống, trèo lên và thu thang | Khi cần leo lên bục cao hơn, Mèo Nấm có animation rút thang gấp dựng lên bục đích, leo từng bậc lên đỉnh, sau đó thu thang lại vào ba lô.
REQ-3 | Hoạt họa xuống bục: phân nhánh leo thang xuống hoặc bung dù | Với khoảng cách rơi < 250px, Mèo đặt thang leo xuống; với khoảng cách >= 250px hoặc khi bị ném/rơi tự do từ trên cao, bung dù lượn hạ cánh chậm rãi bồng bềnh.
REQ-4 | Tối ưu độ mượt hoạt họa của Mascot (bỏ cảm giác cứng nhắc) | Thêm secondary motion (tai đung đưa, đuôi ve vẩy theo quán tính, squash & stretch khi tiếp đất và leo thang) kết hợp easing mượt mà cho RAF position.
REQ-5 | Cấu hình Bật/Tắt Mascot trong Settings và Quick Hide | Thêm switch "Bật/Tắt Mèo Nấm" trong Cài đặt > Mascot và nút ẩn nhanh trong Context Menu / LucyControlDeck; trạng thái được persist lưu trữ và khi tắt sẽ ẩn hoàn toàn mascot overlay.
```

## 3. Approaches Considered

### Approach 1 (Accepted by User): Dedicated Ladder Module + Physics Easing + Persistent Toggle
- Tách riêng component/layer biểu diễn Thang gấp SVG (`MascotLadder.tsx`) có animation mở ra từ ba lô (deploy), các bậc thang sáng rõ, và gập lại (pack up).
- Cập nhật state machine của locomotion trong `MascotOverlay.tsx`: thay thế logic `grapple` bằng sequence `ladder_deploy -> ladder_climb -> ladder_pack`.
- Thêm secondary animation (tai, đuôi, squash & stretch) vào `NamCatPuppet.tsx` thông qua dynamic SVG transforms theo vận tốc và pha chuyển động.
- Bổ sung trường `enabled` vào `mascotStore` (persisted) và giao diện toggle trong `SettingsScreen.tsx` tab Mascot + nút ẩn nhanh trong menu chuột phải/control deck.
- *Ưu điểm:* Kiến trúc sạch, code tách bạch rõ ràng, chuyển động sinh động chuẩn hoạt hình, trải nghiệm người dùng tuyệt vời.

### Approach 2: Inline SVG Ladder in MascotOverlay + Basic CSS lerp
- Render thang trực tiếp trong SVG overlay hiện tại (vị trí dây cũ).
- Không thêm component mới, chỉ vẽ 2 đường thẳng và các thanh ngang.
- Thêm toggle cơ bản trong Settings.
- *Nhược điểm:* Code `MascotOverlay.tsx` vốn đã dài (~2500 dòng) sẽ tiếp tục phình to, hoạt họa thang rút từ ba lô khó tạo cảm giác mượt mà tinh tế.

## 4. Accepted Design
- Chọn **Phương án 1 (Dedicated Ladder Module + Physics Easing + Persistent Toggle)**.
- User confirmed requirement list REQ-1 through REQ-5.

## 5. Verification Strategy
- Chạy type-check: `npm run lint` / `tsc --noEmit`.
- Chạy unit tests: `npm run test:run`.
- Kiểm tra trực quan chuyển động Mèo Nấm qua browser / dev server.
