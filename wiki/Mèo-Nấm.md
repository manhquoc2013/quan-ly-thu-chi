# Trợ lý Linh vật Mèo Nấm

**Mèo Nấm** là trợ lý tài chính ảo kiêm bạn đồng hành tương tác được tích hợp sẵn trên ứng dụng Quản Lý Tài Chính. Lấy cảm hứng từ chuẩn VRM và phong cách hoạt hình 3D Pixar / Disney (Chibi tỉ lệ 3.5 đầu), Nấm giúp bạn theo dõi dòng tiền, giữ tập trung làm việc, thông báo đơn hàng bằng giọng nói tiếng Việt và sở hữu tủ đồ 5 bộ trang phục module tương tác vật lý sinh động.

![Bảng điều khiển Mèo Nấm](images/02-lucy-control-deck.png)

---

## 1. Thiết kế Hình tượng 3D Pixar & Nhận diện Ngoại hình

- **Chủng loài & Phong cách**: Mèo mướp xám bạc hình người (Female Anthropomorphic Silver-Gray Tabby Cat), phong cách tạo hình hoạt hình 3D Pixar / Disney Chibi với tỉ lệ 3.5 đầu dễ thương.
- **Khuôn mặt & Biểu cảm**:
  - Họa tiết chữ **M** đặc trưng trên trán màu xám đậm.
  - Đôi mắt to tròn màu **ngọc lục bảo (Emerald Green)** trong veo với điểm sáng phản chiếu (Catchlights) ngây thơ, biểu cảm tinh nghịch.
  - Mũi nhỏ màu hồng phấn, má ửng hồng pastel và miệng cười mỉm đáng yêu.
- **Điểm nhấn cố định**: Nơ ruy băng lụa mềm màu hồng pastel thắt duyên dáng trước cổ áo và chiếc đuôi dài lông xù sọc vòng uốn lượn theo quán tính chuyển động (Spring bone physics).

---

## 2. Tủ đồ 5 Bộ Trang Phục Module (Modular Wardrobe)

Nấm sở hữu 5 bộ trang phục chuyên nghiệp, hỗ trợ thay đổi nhanh 1-chạm hoặc tự động đổi trang phục theo ngữ cảnh làm việc:

| Trang phục | Biểu tượng | Mô tả diện mạo & Phụ kiện kèm theo | Ngữ cảnh sử dụng |
|:---|:---:|:---|:---|
| **Tài chính** (*Financial*) | 💼 | Áo vest navy cắt may vừa vặn, áo sơ mi trắng bên trong, cà vạt đỏ cam thắt ngay ngắn, tay kẹp **sổ cái bìa da viền vàng kim**. | Quản lý Chi phí, Quản lý Doanh thu, Báo cáo & Phân tích tài chính |
| **Hỗ trợ khách hàng** (*Support*) | 🎧 | Tai nghe **headset công nghệ cao** với micro phát sáng cyan, thẻ nhân viên dây đeo xanh ngọc trước ngực. | Trò chuyện AI, Hỗ trợ người dùng, Quản lý Khách hàng |
| **Kỹ thuật & Hệ thống** (*Tech*) | 💻 | Kính mắt gọng tròn trí tuệ, áo hoodie xám bo gấu trẻ trung, ba lô công nghệ nhỏ gọn phía sau. | Cài đặt hệ thống, Cấu hình Supabase, Đồng bộ đám mây Cloud Sync |
| **Kinh doanh & Bán hàng** (*Marketing*) | 📢 | Áo khoác phong cách hiện đại phối màu nổi bật, **loa pin cầm tay mini** màu cam, huy hiệu ngôi sao doanh số lấp lánh. | Quản lý Đơn hàng, Thao tác Thêm nhanh đơn mới |
| **Thư giãn & Thường ngày** (*Casual / System*) | ☕ | Tạp dề màu nâu cà phê ấm cúng, hai tay ôm **cốc trà sữa/cà phê mini** bốc khói nhẹ, phong thái thư thả. | Màn hình Tổng quan Dashboard, Chế độ nghỉ ngơi |

### 🔄 Chế độ Tự động Thay đổi Trang phục Thông minh (`autoOutfit`)
- Khi kích hoạt công tắc **"Tự động đổi đồ theo ngữ cảnh"** trên Bảng điều khiển:
  - Khi bạn chuyển sang các trang tài chính thu chi ➔ Nấm tự động mặc vest Tài chính.
  - Khi bạn mở khung Trò chuyện AI ➔ Nấm tự động đeo tai nghe Hỗ trợ.
  - Khi bạn vào Cài đặt hoặc đồng bộ dữ liệu ➔ Nấm tự động đeo kính Kỹ thuật.
  - Khi bạn mở menu Thêm nhanh ➔ Nấm tự động cầm loa Bán hàng.
- Nấm phát hiệu ứng âm thanh lấp lánh huyền ảo (**Magic Transform SFX**) mỗi khi thay đổi trang phục.

---

## 3. Hoạt hoạ Tương tác Vật lý & Vận động Đa dạng

Nấm được trang bị hệ thống vật lý và ma trận cử động sinh động, mô phỏng các hành vi như một nhân vật thực tế:

- **Đi bộ & Chạy nước rút** (`walk`, `run`): Chân tay đánh nhịp tự nhiên, đuôi lắc lư theo quán tính.
- **Nhảy cao & Bật nảy đàn hồi** (`jump`): Co gối lấy đà và bật nhảy vươn người trong không trung.
- **Vấp ngã hài hước** (`trip`): Khi vấp phải góc màn hình hoặc di chuyển quá nhanh, Nấm sẽ ngã chúi đầu ra phía trước, kèm mắt xoay tròn bối rối và âm thanh va chạm ngộ nghĩnh.
- **Bò trườn nấp mép trang** (`sneak`, `peek`): Hạ thấp trọng tâm, bò rón rén sát mép màn hình và thò đầu ra quan sát tò mò.
- **Leo trèo lề màn hình** (`climb`): Hai tay hai chân bám tường và leo dọc theo cạnh trái/phải màn hình.
- **Ăn mừng thành công** (`celebrate`): Giơ hai tay lên cao, lắc lư phấn khích và mỉm cười rạng rỡ khi bạn hoàn thành đơn hàng hoặc đạt mục tiêu.
- **Di chuyển trên các dòng văn bản DOM (`detectTextLinesLocomotion`)**:
  - Nấm có khả năng quét các dòng tiêu đề, đoạn văn và thẻ nội dung trên trang web để nhảy lên và bước đi dọc theo mép các dòng chữ như một chú mèo tinh nghịch.

---

## 4. Khu vực Diễn tập Hành động (Action Playground)

Trên **Bảng điều khiển Nấm Control Deck** (chuột phải hoặc bấm nút cài đặt nhỏ dưới chân Nấm):
- Mục **"Thử thách & Hành động của Nấm"** cung cấp 8 nút thao tác nhanh:
  - 🚶 **Đi bộ** · 🏃 **Chạy** · 🦘 **Nhảy cao** · 🪜 **Leo trèo**
  - 🐾 **Bò nấp** · 💫 **Vấp ngã** · 🎉 **Ăn mừng** · 💤 **Đi ngủ**
- Giúp người dùng có thể tương tác và thử nghiệm các cử động bất cứ lúc nào.

---

## 5. Âm thanh Procedural Web Audio & Giọng nói Tiếng Việt

- **Âm thanh tổng hợp thời gian thực (Procedural Audio)**:
  - Không cần tải file âm thanh nặng, hệ thống tạo âm trực tiếp qua Web Audio API: tiếng biến hình phép thuật (`transform`), tiếng vấp ngã đập đất (`trip`), tiếng bò rón rén (`sneak`), tiếng chuông reo leng keng.
  - Tắt âm thanh một chạm sẽ ngắt hoàn toàn mọi âm thanh ngay tức khắc.
- **4 Âm sắc Giọng nói Tiếng Việt (Voice Tones)**:
  1. 🌸 **Dễ thương (Mèo con)**: Giọng cao trong trẻo, vui tươi.
  2. 🍃 **Tự nhiên (Thân thiện)**: Giọng ấm áp và gần gũi.
  3. ☕ **Điềm đạm (Trợ lý)**: Giọng trầm ổn, từ tốn, chuẩn mực.
  4. ⚡ **Năng động (Cổ vũ)**: Giọng nói nhanh nhẹn, truyền năng lượng tích cực.
- **Đọc Thông Báo Đơn Hàng**: Tự động phát thanh chào mừng khi có đơn hàng mới và reo mừng khi đơn hàng chuyển sang trạng thái hoàn thành.
- **Chế độ Tập Trung Pomodoro**: Hẹn giờ 15 / 25 / 45 phút, Nấm ngồi canh góc màn hình giúp chủ tiệm tập trung cao độ.

---

→ [Trang chủ Wiki](Home) · [Cài đặt hệ thống](Cài-đặt) · [Trợ lý AI](Trợ-lý-AI)

