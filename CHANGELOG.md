# Changelog

Tất cả thay đổi đáng chú ý của dự án được ghi lại tại đây. Dựa trên [Keep a Changelog](https://keepachangelog.com/).

Các tag được đánh theo [Semantic Versioning](https://semver.org/lang/vi/).

---

## [2.4.1] — 2026-10-11

🔗 [So sánh với v2.4.0](https://github.com/manhquoc2013/quan-ly-thu-chi/compare/v2.4.0...v2.4.1)

### Chuyển Động Leo Thang Thực Tế & Thanh Lọc Hoàn Toàn Tàn Dư Quăng Dây
- **Quỹ Đạo Leo Thang Thực Tế (`MascotOverlay.tsx`)**:
  - Mascot được định vị ngay tại cột thang (`ladderX - W / 2`), loại bỏ hoàn toàn chuyển động trôi chéo không gian.
  - Quỹ đạo leo theo trục Y thẳng đứng dọc các bậc rungs thang với `spinAngle = 0`, chấm dứt hoàn toàn góc nghiêng lắc lư đu dây cũ (-6°).
  - Trình tự bắc thang thực tế: Đứng chờ tại chân/đỉnh thang (`idle`) trong lúc thang bung (`deploying`) ➔ Bám thang leo thẳng đứng (`climb`) ➔ Chạm sàn an toàn (`idle`) và thu gọn thang vào ba lô (`packing`).
- **Thanh Lọc Triệt Để Tàn Dư Quăng Dây (Grapple Purge)**:
  - Loại bỏ hoàn toàn type `grapple`, alias `normalizeAction('grapple')`, và các cờ đu dây cũ.
  - Xóa `'grapple'` khỏi `LandVibe` và `LAND_LINES` trong `mascotLines.ts`, đồng bộ toàn bộ thoại và âm thanh sang `climb`.
- **Tối Ưu Hoạt Hoạ Puppet Bám Bậc Thang (`NamCatPuppet.tsx`)**:
  - Sửa `@keyframes body-climb`: giữ lưng thẳng (`rotate(0)`), chuyển động nâng hông nhẹ nhàng theo từng bước trèo.
  - Hoạt họa tay (`larm-climb`, `rarm-climb`) và chân (`lleg-climb`, `rleg-climb`) luân phiên theo nhịp bám và đạp lên các bậc thang.

---

## [2.4.0] — 2026-10-11

🔗 [So sánh với v2.3.0](https://github.com/manhquoc2013/quan-ly-thu-chi/compare/v2.3.0...v2.4.0)

### Tối Ưu Hoạt Hoạ Mascot, Bắt Thang Leo Trèo & Cấu Hình Bật / Tắt Linh Vật
- **Thang Gấp Leo Trèo Kỹ Thuật Số (`MascotLadder.tsx`)**:
  - Loại bỏ hoàn toàn cơ chế quăng dây neo (grappling hook) di chuyển màn hình vốn tạo cảm giác đột ngột và cứng nhắc.
  - Thiết kế module thang nhôm kỹ thuật số dạng SVG rút từ ba lô: có chân đế cao su chống trượt, thanh đứng vát bo góc, các bậc thang phản quang và móc khóa đỉnh an toàn.
  - Hiệu ứng mở thang mượt mà (extend/retract) và tự động thu gọn vào ba lô khi Nấm leo lên đến nơi hoặc tiếp đất.
- **Quy Tắc Hạ Độ Cao Đa Nhánh Tự Nhiên (Descent Branching)**:
  - Khi cần xuống bục thấp (< 250px): Nấm triển khai thang và leo xuống từng bậc an toàn, tự nhiên.
  - Khi độ cao lớn (≥ 250px) hoặc rơi tự do giữa không trung: Nấm bung dù lượn (`parachute`) chao liệng nhẹ nhàng trong gió với góc nghiêng tự nhiên trước khi tiếp đất.
- **Tối Ưu Độ Mượt & Tính Vật Lý Của Hoạt Hoạ (`NamCatPuppet.tsx`)**:
  - Bổ sung quán tính chuyển động cho tai (`earWiggle`), vẫy đuôi tự nhiên khi di chuyển hoặc đứng yên (`tailWiggle`).
  - Hiệu ứng co giãn biến dạng vật lý (Squash & Stretch) khi tiếp đất (`landingSquash`) tạo cảm giác êm ái, bớt cứng nhắc.
  - Nâng cấp tương tác véo má/chạm vào má phúng phính (`cheekPinch`) phản hồi sinh động khi người dùng tương tác chuột.
- **Cấu Hình Bật / Tắt Mascot Toàn Diện**:
  - Bổ sung nút chuyển Bật / Tắt Master trong **Cài đặt ➔ tab Mascot** (`SettingsScreen.tsx`), lưu trạng thái bền vững với cơ chế fallback an toàn phòng trường hợp hỏng storage.
  - Bổ sung nút **Ẩn nhanh (Quick Hide)** tiện lợi ngay trên bảng điều khiển `LucyControlDeck.tsx` để người dùng có thể ẩn linh vật ngay lập tức chỉ với 1 click khi cần tập trung làm việc.
  - Tự động dừng mọi timer hoạt hoạ, giải phóng event listener và ẩn toàn bộ overlay khi mascot ở trạng thái tắt.

---

## [2.3.0] — 2026-10-11

🔗 [So sánh với v2.2.0](https://github.com/manhquoc2013/quan-ly-thu-chi/compare/v2.2.0...v2.3.0)

### Tái Thiết Kế Mascot Mèo Nấm 3D Pixar Chibi & Hệ Thống Tương Tác Đa Năng
- **Hình tượng Nhân vật Mèo Nấm (`NamCatPuppet.tsx`)**:
  - Tái thiết kế toàn diện linh vật từ mô hình mèo cũ thành **Mèo Nấm** (mèo mướp xám bạc sọc M trán, mắt ngọc lục bảo to tròn ngây thơ, nơ cổ hồng pastel, đuôi sọc vòng, tỉ lệ Chibi 3.5 đầu chuẩn phong cách Pixar/Disney).
  - Tích hợp hiệu ứng đổ bóng đa tầng (Gradients & Radial highlights), phản chiếu ánh sáng tự nhiên và chuyển động tai/đuôi/chân/tay độc lập.
- **5 Bộ Trang Phục Module Đa Năng (Modular Outfits)**:
  - 💼 **Tài chính (Financial)**: Vest navy trang trọng, sơ mi trắng, cà vạt đỏ cam, kẹp sổ cái vàng kim lấp lánh.
  - 🎧 **Hỗ trợ khách hàng (Support)**: Tai nghe headset công nghệ cao với micro phát sáng, thẻ nhân viên đeo cổ dây xanh cyan.
  - 💻 **Kỹ thuật & Hệ thống (Tech)**: Kính gọng tròn trí tuệ, áo hoodie xám/xanh hiện đại, ba lô công nghệ phía sau.
  - 📢 **Kinh doanh & Marketing (Marketing)**: Áo khoác thời trang, loa pin cầm tay, huy hiệu doanh số rực rỡ.
  - ☕ **Thư giãn & Thường ngày (System / Casual)**: Tạp dề nâu cà phê, cốc trà sữa/cà phê mini trên tay, phong thái thư thái.
- **Hệ Thống Hoạt Hoạ Tương Tác Vật Lý Đa Dạng (`MascotOverlay.tsx`)**:
  - Bổ sung ma trận cử động phong phú: Đi bộ (`walk`), chạy nước rút (`run`), nhảy cao nảy bóng (`jump`), vấp ngã chúi đầu vui nhộn (`trip`), bò trườn nấp mép trang (`sneak` / `peek`), leo trèo lề màn hình (`climb`), và ăn mừng vung tay reo vui (`celebrate`).
  - Dò tìm và bước đi trên các dòng văn bản DOM thực tế (`detectTextLinesLocomotion`), tự động bám thanh footer / header.
  - Hệ thống âm thanh procedural Web Audio synthesizer: Tiếng biến hình ma thuật khi đổi đồ (`transform`), tiếng va chạm vấp ngã (`trip`), tiếng bò rón rén (`sneak`), kết hợp giọng meow và purr êm dịu.
- **Tự Động Thích Ứng Trang Phục Theo Ngữ Cảnh (Smart Auto-Outfit Switching)**:
  - Khi bật chế độ `autoOutfit`, Nấm tự động đổi trang phục tương ứng với tính năng người dùng đang mở:
    - Trang Chi phí / Doanh thu / Báo cáo ➔ Trang phục **Tài chính (Financial)**
    - Trang Trò chuyện AI / Khách hàng ➔ Trang phục **Hỗ trợ (Support)**
    - Trang Cài đặt / Đồng bộ / Cấu hình ➔ Trang phục **Kỹ thuật (Tech)**
    - Thao tác đơn hàng / Thêm nhanh ➔ Trang phục **Kinh doanh (Marketing)**
    - Trang Tổng quan / Nghỉ ngơi ➔ Trang phục **Thư giãn (Casual)**
- **Nâng Cấp Bảng Điều Khiển Mèo Nấm (Control Deck)**:
  - Bổ sung **Tủ đồ trang phục (Wardrobe Selector)** cho phép đổi 1-chạm giữa 5 phong cách kèm nút gạt Tự động đổi thông minh.
  - Bổ sung **Khu vực diễn tập (Action Playground)** với 8 nút kích hoạt hành động tức thì để người dùng trực tiếp vui đùa cùng Nấm.
- **Đồng Bộ Toàn Bộ Tên Trợ Lý Thành Mèo Nấm**:
  - Chuẩn hoá toàn bộ tên gọi từ Mèo Lucy sang **Mèo Nấm** trên tất cả các màn hình (Khung trò chuyện AI, Bảng cài đặt, lời thoại tương tác, thông báo đơn hàng và tài liệu hệ thống Wiki).

---

## [2.2.0] — 2026-10-10

🔗 [So sánh với v2.1.0](https://github.com/manhquoc2013/quan-ly-thu-chi/compare/v2.1.0...v2.2.0)

### Chuẩn hoá Dữ liệu Nhập liệu Thông minh (AI Data Standardization)
- **Engine Chuẩn hoá Dữ liệu (`dataStandardizer.ts`)**:
  - Quét tự động toàn bộ 4 nhóm dữ liệu cốt lõi: Chi phí, Khách hàng, Sản phẩm, Đơn hàng doanh thu.
  - Nhận diện các lỗi nhập liệu phổ biến: thiếu/sai dấu tiếng Việt, viết hoa lộn xộn, số điện thoại không chuẩn 10 số (chứa khoảng trắng/dấu chấm/đầu số quốc tế +84), danh mục chi phí sai lệch, đơn vị tính sản phẩm không đồng nhất (lon, chai, cái, kg, ly...).
  - Cơ chế đa tầng (Cascade AI): Tự động phân tích bằng mô hình ngôn ngữ lớn (Kilo Free / Groq / Gemini / OpenRouter / WebLLM) hoặc bộ quy tắc Heuristic ngoại tuyến thông minh.
- **Giao diện Trực quan & Xem trước Thay đổi (`DataStandardizationDialog.tsx`)**:
  - Hiển thị thống kê tổng quan (đã quét, cần chuẩn hoá, đã đề xuất, đã cập nhật).
  - Phân loại theo tab (Tất cả, Chi phí, Khách hàng, Sản phẩm, Đơn hàng) kèm bộ lọc tìm kiếm nhanh.
  - Thẻ so sánh trực quan Trước ➔ Sau (Diff Card) làm nổi bật các trường dữ liệu được hiệu chỉnh.
  - Xem trước và cho phép người dùng chọn lọc từng mục hoặc áp dụng chuẩn hoá hàng loạt an toàn.
- **Tích hợp Nhanh Toàn diện**:
  - Nút bấm Sparkles ✨ trên thanh Header điều hướng.
  - Phím tắt trong Command Palette (`⌘K` → `✨ Chuẩn hoá dữ liệu (AI)`).
  - Tích hợp vào Cài đặt tab AI và gợi ý nhanh trong màn hình Trò chuyện AI.
  - Trợ lý Lucy tự động nhận diện ý định `standardize_data` khi người dùng nhắn "chuẩn hoá dữ liệu" hoặc "làm sạch sổ sách".

### Bộ Quản lý & Tối ưu Hoạt hoạ (Motion & Animation Engine)
- **Kho trạng thái `useMotionStore`**:
  - Hỗ trợ 3 cấp độ hoạt hoạ: **Đầy đủ (Full)**, **Tối giản (Reduced)**, **Tắt toàn bộ (Off)**.
  - 5 công tắc tinh chỉnh độc lập: Vệt sáng con trỏ (Cursor Glow), Hoạt hoạ Splash & Loading, Chuyển cảnh trang (Page Transitions), Hoạt hoạ Linh vật (Mascot Animations), Tăng tốc GPU.
  - Tự động đồng bộ thuộc tính `data-motion` lên thẻ gốc `<html>` và biến CSS toàn cục `--motion-duration-factor`.
- **Pre-mount Splash Screen**:
  - Nhúng splash screen siêu nhẹ inline trong `index.html`, đọc trực tiếp cấu hình từ `localStorage` trước khi React render, ngăn chặn hoàn toàn hiện tượng nhấp nháy màn hình trắng (FOUC).
- **Tab Cài đặt Hoạt hoạ & Khung thử nghiệm**:
  - Bổ sung tab **Hiệu ứng & Hoạt hoạ** trong `SettingsScreen.tsx`.
  - Khung thử nghiệm chuyển động tương tác (**Motion Playground**) hỗ trợ kiểm tra trực quan các hiệu ứng Bounce, Spin, Pulse, Slide theo cấp độ đã chọn.
- **Tiết kiệm Pin & Phần cứng**:
  - Tự động hủy animation loop (`requestAnimationFrame`) của con trỏ và tạm dừng chu kỳ di chuyển tự do của Linh vật Lucy khi chuyển sang chế độ tiết kiệm/tắt hoạt hoạ.

### Cải tiến Đồng bộ Đám mây & Ổn định Dữ liệu
- **Khắc phục Đồng bộ Khách hàng & Sản phẩm**: Đảm bảo toàn vẹn dữ liệu khi tải từ Supabase Cloud về kho lưu trữ IndexedDB cục bộ.
- **Mở rộng Kiểm thử Đơn vị**: Bổ sung bộ kiểm thử cho `dataStandardizer.test.ts` và `reportService.test.ts`, nâng tổng số test lên 215 tests với tỷ lệ vượt qua 100%.

---

## [2.1.0] — 2026-10-10

🔗 [So sánh với v2.0.0](https://github.com/manhquoc2013/quan-ly-thu-chi/compare/v2.0.0...v2.1.0)

### Thêm mới & Cải tiến Giao diện (UI/UX)
- **Thiết kế lại toàn bộ Layout Shell**:
  - Sidebar hiện đại với huy hiệu thương hiệu phát quang nhẹ (`glow-teal-sm`), mục điều hướng pill bo góc với hiệu ứng chuyển động mượt mà và thẻ người dùng tích hợp trạng thái trực tuyến.
  - Header kính mờ (`backdrop-blur-md bg-surface/85`), chip đồng bộ đám mây (Cloud Sync) trực tiếp với chấm trạng thái nhấp nháy và nút đồng bộ một chạm.
  - Trung tâm thông báo trực quan phân loại thông báo theo nguồn (sync, ai, realtime, error) kèm mốc thời gian tương đối.
  - Đồng hồ thời gian thực dạng thẻ monospace tinh tế.
  - Nút bấm Trợ lý AI nổi bật với ánh sáng đa tầng và chuyển động êm ái.
- **Màn hình Dashboard Hiện đại**:
  - Banner chào mừng cá nhân hóa kèm ngày tháng tiếng Việt thực tế và tóm tắt tiến độ đơn hàng.
  - Thanh thao tác nhanh (Quick Action Ribbon) với 4 thẻ hành vi trực quan: Thêm đơn bán, Ghi chi tiêu, Xem báo cáo, Trợ lý AI.
  - Thẻ chỉ số tài chính (KPI) phân cấp màu theo tính chất (Đã thu, Chi phí, Công nợ / Lãi tháng) với font số dạng bảng `tabular-nums`.
  - Hàng đợi “Cần xử lý” và danh sách sản phẩm hiển thị dạng danh thiếp chuyên nghiệp, hỗ trợ phím tắt và tiếp cận cao.
  - Biểu đồ dòng tiền 7 ngày thiết kế lại với cột bo góc, lưới dịu mắt và tooltip thẻ kính tối ưu độ tương phản.
- **Design Tokens & Tiện ích Tiếp cận**:
  - Hỗ trợ toàn diện chuẩn tiếp cận `prefers-reduced-motion` WCAG.
  - Các tiện ích gradient tài chính `.stat-card-income`, `.stat-card-expense`, `.stat-card-profit`, `.stat-card-debt`.
  - Đạt điểm kiểm định UI/UX tuyệt đối: `validate_ui_code` 100/100, `audit_ux_interface` 100/100 (0 smells).
- **Trợ lý Linh vật Mèo Lucy & Bảng điều khiển LucyControlDeck**:
  - Tích hợp mô phỏng vật lý chân thực (kéo thả quăng ném, trọng lực, gia tốc rơi tự do và bật nảy đàn hồi).
  - Cấu hình âm thanh: Cho phép tắt/bật âm thanh (`soundEnabled`), ngắt hoàn toàn bộ tổng hợp Web Audio khi tắt âm (im lặng tuyệt đối).
  - Khóa mức độ hoạt động: Mức độ hoạt động (`low`, `medium`, `high`) luôn tuân thủ nghiêm ngặt cấu hình người dùng, không bị đột biến khi click.
  - Tổng hợp giọng nói tiếng Việt (Web Speech API TTS), tự động quét giọng hệ thống và cung cấp 4 bộ âm sắc giọng (Dễ thương, Tự nhiên, Điềm đạm, Năng động).
  - Tự động cất giọng thông báo bằng tiếng Việt khi có đơn hàng mới và reo vui ăn mừng khi đơn hàng hoàn thành (có debounce chống lặp âm).
  - Chế độ tập trung Pomodoro (15m, 25m, 45m) có đếm ngược, chuông báo hoàn thành và tư vấn tài chính theo thời gian thực.
- **Tự động hoá Kiểm thử & Tài liệu Wiki**:
  - Xây dựng kịch bản Playwright tự động (`scripts/capture-wiki-screenshots.mjs`) khởi chạy Vite server, nạp dữ liệu mẫu thực tế và chụp 8 ảnh chụp màn hình độ phân giải cao Retina 2x.
  - Cập nhật toàn bộ tài liệu Wiki (`wiki/Mèo-Lucy.md`, `wiki/Cài-đặt.md`, `wiki/Dashboard.md`, `wiki/Quản-lý-Doanh-thu.md`, v.v.) đồng bộ chuẩn xác với logic hiện tại.

---

## [2.0.0] — 2026-08-13

🔗 [So sánh với v1.7.0](https://github.com/manhquoc2013/quan-ly-thu-chi/compare/v1.7.0...v2.0.0)

### Thêm mới
- Dashboard tập trung: KPI tháng, hàng đợi “Cần xử lý”, sản phẩm cần làm, deep-link mở đơn
- Báo cáo: tổng quan, nhóm Tài chính / Vận hành, Top khách–sản phẩm, công nợ sắp xếp / deep-link
- In hóa đơn A6 (xem trước + in; portal body để `@media print` không bị dialog transform)
- Tìm đơn theo tên khách (local + cloud RPC `search_revenues_page`, walk-in ilike)
- Brand Auth / Onboarding: ink navy + soft sand; typography Be Vietnam Pro + Figtree
- `mascotLines.ts` — thoại Lucky thống nhất (idle / CRUD / auth / tap)

### Thay đổi
- List doanh thu / chi phí: filter dùng chung, debounce tìm kiếm, empty vs không khớp
- Realtime hydrate cloud (debounce); `loadLedger` phân trang 1000; `updateRevenuesBatch`
- LLM: slot-fill local-first, bỏ bulk cascade thừa, `mascot_say` ngắn ≤12 từ
- Header Báo cáo gọn: kỳ + DatePicker + switch nhóm / một hàng tab

### Sửa lỗi
- In bill trong dialog Radix; race deep-link chi tiết đơn; normalize walk-in id
- Hydrate PostgREST không còn cắt silent ở 1000 dòng

### Tài liệu / Ops
- Migration: `20260812110000_search_revenues_page.sql`, `20260812120000_search_revenues_walkin_ilike.sql` (cần apply trên Supabase)
- CHANGELOG.md, RELEASE.md

---

## [1.7.0] — 2026-08-12

🔗 [So sánh với v1.6.0](https://github.com/manhquoc2013/quan-ly-thu-chi/compare/v1.6.0...v1.7.0)

### Thêm mới
- Chat hoàn toàn qua LLM: tạo đơn / chi phí / SKU / điều hướng / paste bảng — bỏ parser regex (`textDraftParser`, table parsers)
- Cascade tách nhiệm vụ: extract (tạo đơn/chi/paste) Groq → Gemini → Kilo; chat theo thứ tự user (Kilo Free trước)
- Gemini / Groq tự lấy danh sách model (`models.list` / `/models`) và đổi model khi 429/404 (Flash cho extract/OCR, Flash-Lite / instant cho chat)

### Sửa lỗi
- `"tạo đơn hàng khách …"` không còn bị nhận nhầm chi phí
- Gemini không còn ép schema `BAN_HANG` đè extract JSON
- Groq sticky model theo task (extract ≠ chat); badge nguồn hiện đúng Groq
- `ImagePreview` gọi hook trước early return; Groq test dùng đúng state loading

### Thay đổi
- `guessCategory` tách sang `categoryGuess.ts` (OCR / CSV / bulk)
- ESLint sạch (`npm run lint`); tắt metric complexity/max-depth/max-params
- `eqeqeq` cho phép `== null`

### Tài liệu
- CHANGELOG.md, RELEASE.md

---

## [1.6.0] — 2026-08-10

🔗 [So sánh với v1.5.0](https://github.com/manhquoc2013/quan-ly-thu-chi/compare/v1.5.0...v1.6.0)

### Thêm mới
- Dashboard: khối "Sản phẩm cần làm" — tổng hợp SL theo món từ đơn chưa hoàn thành / chưa hủy, ưu tiên món có đơn ưu tiên
- Grid doanh thu: cột "Sản phẩm" (badge tên × SL) trên desktop; card mobile hiển thị danh sách món

### Thay đổi
- `REVENUE_MIN_WIDTH` 1100 → 1270; hàng grid `min-h` linh hoạt khi nhiều badge sản phẩm

### Tài liệu
- CHANGELOG.md, RELEASE.md

---

## [1.5.0] — 2026-08-09

🔗 [So sánh với v1.4.2](https://github.com/manhquoc2013/quan-ly-thu-chi/compare/v1.4.2...v1.5.0)

### Thêm mới
- Ưu tiên đơn hàng: đánh dấu / bỏ ưu tiên (UI + lệnh chat), lọc danh sách ưu tiên, migration Supabase `priority` / `priority_at`
- Parse local "tạo đơn" đa dòng / nhiều món không tách sai line items
- `TableHScroll` — scroll ngang chỉ trong bảng, không đẩy layout trang

### Sửa lỗi
- Khoảng trắng / scroll ngang giả sau cột cuối (ripple button `scale(10)` + `clip-path` phình `scrollWidth`)
- `giá` trần trong câu "khách … mua N … giá Xk" = tổng gói (không nhân SL)
- Tên khách 1 ký tự hợp lệ trong dialog / parse đơn

### Thay đổi
- Hover / press animation nút (overflow:hidden chứa ripple)
- Grid doanh thu / chi phí dùng CSS grid + minWidth trong TableHScroll

### Tài liệu
- CHANGELOG.md, RELEASE.md

---

## [1.4.2] — 2026-08-09

🔗 [So sánh với v1.4.1](https://github.com/manhquoc2013/quan-ly-thu-chi/compare/v1.4.1...v1.4.2)

### Thay đổi
- Deploy GitHub Pages qua Actions thuần (`upload-pages-artifact` + `deploy-pages`) — bỏ push nhánh `gh-pages`
- Chỉ deploy tag `v*` khi commit nằm trên `main`

### Tài liệu
- SECURITY.md
- Wiki (Home, FAQ, Cài đặt, Supabase, Dashboard, Chi phí, Doanh thu, Báo cáo, Trợ lý AI)
- RELEASE.md cập nhật cấu hình Pages Source = GitHub Actions

---

## [1.4.1] — 2026-08-09

🔗 [So sánh với v1.4.0](https://github.com/manhquoc2013/quan-ly-thu-chi/compare/v1.4.0...v1.4.1)

### Thay đổi
- Version UI lấy từ `package.json` qua Vite `__APP_VERSION__` (Layout, Auth, Onboarding, Settings) — hết hardcode lệch nhau

### Tài liệu
- CHANGELOG.md, RELEASE.md, README.md

---

## [1.4.0] — 2026-08-09

🔗 [So sánh với v1.3.0](https://github.com/manhquoc2013/quan-ly-thu-chi/compare/v1.3.0...v1.4.0)

### Thêm mới
- AuthGuard loading screen: logo 80px, subtitle "Đang tải dữ liệu..." với chấm nhảy
- AuthScreen: form đăng ký có storeName + confirmPassword, validation tooltip
- Mascot phản ứng CRUD: thông báo khi thêm/xoá/sửa expense + revenue
- Hiển thị rate limit cho từng AI provider trong Settings
- AuthGuard background: upscale 600→1920px

### Thay đổi
- Bulk toolbar: `fixed bottom-0` như FAB, luôn hiển thị
- PaginationBar: responsive mobile `← 3/12 →` / desktop đầy đủ
- Dashboard KPI: "Doanh thu"/"Chi phí", thêm hint, bỏ Math.round
- ReportScreen: subtitle + preset dạng segmented control
- AuthScreen icons: `ArrowRight` → `LogIn`/`UserPlus`, CardDescription → Info tooltip
- Dashboard icon: `Briefcase` → `Clock`, Settings: `SettingsIcon` → `FlaskConical`
- Page transition animation: `scale(0.97→1) + fade-in`, card stagger 0.04s
- Scrollbar CSS toàn cục: 6px mảnh, dark mode + Firefox

### Sửa lỗi
- Mascot animation: `tossed`/`spin`/`grapple` fallback về idle
- Layout `min-h-full` — fix height chain cho `h-full` children
- AuthGuard background: bỏ `scale()` animation gây mờ
- RevenueGrid: thêm checkbox mobile, dùng `formatDate()`

### Tài liệu
- README.md, RELEASE.md, CHANGELOG.md cập nhật

---

## [1.3.0] — 2026-08-09

🔗 [So sánh với v1.2.0](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.2.0...v1.3.0)

### Thêm mới
- Supabase Auth: đăng nhập/đăng ký email + password
- Onboarding screen sau đăng ký
- Mascot Lucky: mèo SVG hoạt hình đi lại trên giao diện
- Inventory report (FIFO COGS): nhập hàng, lãi gộp, tồn kho
- Sticky banner + hybrid pagination

---

## [1.2.0] — 2026-08-08

🔗 [So sánh với v1.1.2](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.1.2...v1.2.0)

### Thêm mới
- Deposit/payment tracking cho đơn hàng
- Order shipping fee
- Kilo Free AI integration
- Supabase shared ledger + realtime sync

---

## [1.1.2] — 2026-08-08

🔗 [So sánh với v1.1.1](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.1.1...v1.1.2)

### Sửa lỗi
- Stale SW asset 404s
- WebLLM eager-load trên GitHub Pages

---

## [1.1.1] — 2026-08-08

🔗 [So sánh với v1.1.0](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.1.0...v1.1.1)

### Thêm mới
- Product catalog + AI resolve
- Order platform management
- AI multimodal intake (OCR, CSV, voice)
- Order payment status
- Revenue mobile layout
- Smart chat intent
- Customer management
- Bulk line expense
- Order table paste

---

## [1.1.0] — 2026-08-08

🔗 [So sánh với v1.0.6](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.0.6...v1.1.0)

### Thêm mới
- Supabase realtime broadcast sync
- Deposit + payment tracking
- Shipping fee management
- Kilo Free AI provider
- Supabase shared ledger multi-device

---

## [1.0.6] — 2026-08-08

🔗 [So sánh với v1.0.5](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.0.5...v1.0.6)

### Thêm mới
- Supabase Auth: đăng nhập/đăng ký
- Shared ledger (multi-device)
- Settings sync qua Supabase

---

## [1.0.5] — 2026-08-03

🔗 [So sánh với v1.0.4](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.0.4...v1.0.5)

---

## [1.0.4] — 2026-08-03

🔗 [So sánh với v1.0.3](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.0.3...v1.0.4)

---

## [1.0.3] — 2026-08-02

🔗 [So sánh với v1.0.2](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.0.2...v1.0.3)

📦 [GitHub Release](https://github.com/tranquoc/quan-ly-thu-chi/releases/tag/v1.0.3)

### Thêm mới
- Google Drive OAuth thực + app-data sync

---

## [1.0.2] — 2026-08-02

🔗 [So sánh với v1.0.1](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.0.1...v1.0.2)

📦 [GitHub Release](https://github.com/tranquoc/quan-ly-thu-chi/releases/tag/v1.0.2)

### Sửa lỗi
- Logo.svg path dưới Vite `BASE_URL` trên GitHub Pages

---

## [1.0.1] — 2026-08-02

🔗 [So sánh với v1.0.0](https://github.com/tranquoc/quan-ly-thu-chi/compare/v1.0.0...v1.0.1)

📦 [GitHub Release](https://github.com/tranquoc/quan-ly-thu-chi/releases/tag/v1.0.1)

### Sửa lỗi
- GitHub Pages base path cho router, service worker, fonts

---

## [1.0.0] — 2026-08-02

📦 [GitHub Release](https://github.com/tranquoc/quan-ly-thu-chi/releases/tag/v1.0.0)

### Thêm mới
- Khởi tạo dự án: React 19 + Vite 6 + Tailwind CSS 4 + shadcn/ui
- SQLite (sql.js WASM) + IndexedDB local storage
- Expense CRUD với 10 danh mục
- Revenue CRUD với quản lý khách hàng, sản phẩm
- 7 loại báo cáo với biểu đồ Recharts
- Trợ lý AI chat + WebLLM local
- PWA + GitHub Pages deploy
