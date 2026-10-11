# CONTEXT
## Goal
Bỏ hoàn toàn logic quăng dây/đu dây, chuyển đổi toàn diện sang cơ chế leo thang thực tế với Mascot định vị tại thang, di chuyển thẳng đứng dọc theo các bậc rungs và tư thế bám bậc tự nhiên.
## Actor
Người dùng cuối tương tác hoặc quan sát Mascot Mèo Nấm trên toàn ứng dụng.
## Requirements
REQ-1 | Thanh lọc hoàn toàn tàn dư quăng dây/đu dây | Xóa sạch type 'grapple', LAND_LINES.grapple / LandVibe 'grapple', các comment và cờ đu dây tàn dư, chuyển toàn bộ sang hệ thống 'climb' / folding ladder
REQ-2 | Quỹ đạo leo thang thực tế bám dọc trục thang | Mascot di chuyển tới vị trí thang (ladderX - W/2), leo thẳng đứng theo trục Y dọc rungs thang (spinAngle = 0, loại bỏ hoàn toàn góc nghiêng lắc lư dây -6° và chuyển động trôi chéo không gian), tay chân và tư thế bám bậc thang tự nhiên
REQ-3 | Trình tự bắc thang và leo hoàn chỉnh | Đứng tại vị trí thang -> bung thang gấp (deploying) -> leo dọc thân thang (climbing) -> bước lên mép sàn và thu thang vào balo (packing) -> chuyển về trạng thái idle ổn định trên sàn (áp dụng chuẩn cho cả leo lên và leo xuống)
## Approach
Phương án 1 (Accepted): Định vị x của mascot tại ladderX - W / 2 khi bắt đầu chu kỳ leo/xuống thang; RAF tick cho kind === 'climb' giữ x cố định, chỉ cập nhật y theo tiến độ di chuyển, spinAngle = 0; đồng bộ animation tay bám bậc và chân bước lên rungs trong NamCatPuppet; xóa bỏ hoàn toàn tàn dư type/thoại grapple.
Phương án 2: Di chuyển Mascot bằng hoạt họa bước đi tới chân thang trước khi bung thang.
## Failure
Mascot rơi tự do nếu sàn đỡ bên dưới biến mất hoặc kích thước viewport thay đổi bất thường trong lúc leo; xử lý bằng cách hủy timer thang và hạ cánh an toàn xuống mặt đất gần nhất.
## Out of scope
Thay đổi toàn bộ hệ thống physics rơi tự do / nhảy dù parachute; thay đổi các tính năng chat hay tài chính khác.
## Kept
Folding ladder render and rung calculations | 3 tests passed | npx vitest run src/ui/components/MascotLadder.test.tsx
Mascot basic lifecycle & speech lines | 3 tests passed | npx vitest run src/ui/components/MascotOverlay.test.tsx
## Verify
npx vitest run src/ui/components/Mascot
npx tsc --noEmit
npm run lint
## Source
User prompt: /processing-the-flow mascot đang chưa leo thang mà vẫn còn hoạt họa của quăng dây trước đó, bỏ hoàn toàn logic quăng dây đi, mascot phải leo thang theo đúng hành động thực tế
