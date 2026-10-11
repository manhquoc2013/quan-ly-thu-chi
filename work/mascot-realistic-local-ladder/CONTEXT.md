# CONTEXT
## Goal
Mascot chỉ leo thang cục bộ cự ly ngắn (tối đa 160px), chân thang không đâm xuyên đáy/vùng cấm, và thang thu ngược từ dưới lên vào ba lô khi lên đỉnh.
## Actor
Mèo Nấm mascot autonomous movement loop & player interaction
## Requirements
### REQ-1
Mascot chỉ kích hoạt thả thang leo nếu khoảng cách thẳng đứng giữa bề mặt hiện tại và mép bám mục tiêu nằm trong khoảng cục bộ (40px <= deltaY <= 160px); nếu vượt quá 160px thì không thả thang dài mà chuyển sang nhảy hop hoặc di chuyển bệ đỡ trung gian.
Không còn hiện tượng thang kéo dài vượt tầng qua nhiều component hay xuyên qua đáy màn hình / bottom bar.
### REQ-2
Chân thang (bottomY) khi thả phải bắt đầu từ mặt đỡ hợp lệ của vị trí mascot hiện tại, không đặt chân thang xuyên qua các vùng cấm (thanh điều hướng đáy, floating nav, ngoài viewport).
Thang luôn có điểm tựa sàn rõ ràng và giới hạn an toàn.
### REQ-3
Khi mascot leo lên đến đỉnh (chuyển sang trạng thái packing), thang được cuộn/rút ngược từ dưới chân lên trên vào ba lô của Mèo Nấm (bottomY dịch chuyển dần về topY), các bậc thang bên dưới biến mất trước.
Thang biến mất hoàn toàn vào ba lô trước khi mascot phát ngôn ("Lên được rồi!").
## Approach
### Accepted
Triển khai cơ chế Thang cục bộ (Local Ladder Constraint):
1. Giới hạn MAX_LADDER_CLIMB_HEIGHT = 160px, MIN_LADDER_CLIMB_HEIGHT = 36px.
2. Kiểm tra bottomY không vượt quá vùng an toàn trên bottom nav / floating bar.
3. Trong MascotLadder.tsx, khi state === 'packing', tính toán chiều dài thang rút từ dưới lên trên: currentBottomY = topY + currentHeight, rungs vẽ từ topY xuống currentBottomY, làm biến mất các bậc thang phía dưới và thu gọn vào balo của Mèo Nấm ở phía trên.
### Also considered
Approach B: Bỏ hoàn toàn thang leo, mascot chỉ nhảy nhót (hop/jump) giữa các tầng và dùng dù khi rơi xuống.
Approach C: Giữ thang cao nhưng chia thành nhiều đoạn thang nối nhau với các trạm dừng chân trung gian.
## Failure
Nếu không tìm được mép bám phù hợp trong bán kính 160px, mascot fallback về nhảy ngắn (jump/hop) hoặc đi tuần tra ngang (loco walk).
## Out of scope
Không can thiệp vào hành vi quăng dù rơi tự do (chute) hay cơ chế kéo thả vật lý (drag/toss).
## Kept
### mascot-test-suite
Tất cả 227 unit/component tests hiện tại tiếp tục pass 100%.
npm test
Test Files  36 passed (36)
Tests  227 passed | 46 todo (273)
## Verify
npm test && npm run lint
0 errors, 0 warnings, 227+ tests passed
## Source
this prompt & v2.4.1 feedback
