# UNIVERSAL AGENT CODING & EXECUTION PROTOCOL (ELITE EDITION)

## 1. HARD CONSTRAINTS & ZERO-TOLERANCE (BẮT BUỘC)
* **Zero Dead Code & Sweep:** Cấm hoàn toàn hàm, biến, type, tham số hoặc import không sử dụng. Luôn tự động quét dọn sạch sẽ mã thừa sau khi refactor.
* **No Hardcoding / Zero Magic Values:** Tuyệt đối không hardcode URL, port, timeout, chuỗi tĩnh, magic numbers hay mã màu. Bắt buộc trừu tượng hóa ra Constants, Enums, Config hoặc Environment Variables.
* **Production-Ready Only:** CẤM placeholder (`TODO`, `FIXME`, mock returns, stub function). Mọi dòng code phải đầy đủ logic và sẵn sàng deploy.
* **Algorithmic & Memory Efficiency:** Tối ưu O(1), O(n) thay vì O(n²). Tái sử dụng buffer/object, giải phóng resource/listener tránh rò rỉ bộ nhớ (memory leaks).

## 2. QUALITY ASSURANCE & "DEFINITION OF DONE"
* **Zero Warning Policy:** Code không được phép phát sinh bất kỳ warning nào (từ compiler, linter, runtime hoặc deprecation).
* **[MANDATORY] Pre-Completion Lint Gate:** 
  - Trước khi báo hoàn tất task, BẮT BUỘC chạy hoặc kiểm tra linting / type-check của dự án (ví dụ: `npm run lint`, `tsc --noEmit`, hoặc linter tương đương).
  - Chỉ được xác nhận hoàn thành khi: **0 Errors & 0 Warnings**.
* **Regression Prevention:** Đảm bảo thay đổi mới không làm gãy các module phụ thuộc hoặc phá vỡ type-contract hiện tại.

## 3. ELITE AGENT INTELLIGENCE (TƯ DUY KỸ SƯ CẤP CAO)
* **Root-Cause Analysis (Trị tận gốc):** Không bao giờ dùng hack bề mặt (`@ts-ignore`, ép kiểu mù quáng, try-catch rỗng) để che giấu lỗi. Luôn tìm và giải quyết nguyên nhân gốc rễ của bug.
* **Proactive Edge-Case Defense:** Tự động tính toán và xử lý trước các trường hợp biên mà không cần user nhắc:
  - Null/undefined handling, empty states, boundary limits.
  - Race conditions, retry logic, timeout, network failure, unhandled promise rejections.
* **Strict Type Safety:** Tránh lạm dụng `any` hoặc type casting lỏng lẻo. Xây dựng interface/type chặt chẽ, tận dụng Discriminated Unions và Pattern Matching của ngôn ngữ.
* **Failure Modes & Observability:** Mọi khối error handling phải có context rõ ràng, log có cấu trúc để dễ dàng debug khi gặp sự cố trên production.

## 4. UI ARCHITECTURE ENGINE
Kiểm tra ngữ cảnh trước khi render UI:
* **MODE A: BROWNFIELD (Dự án đã có sẵn - ƯU TIÊN SỐ 1)**
  1. *Audit:* Kiểm tra components và design tokens tại `/Components/Common`, `App.xaml` hoặc styles gốc.
  2. *Strict Reuse:* Dùng lại Button, Input, Modal, Layout Shell sẵn có. Cấm tạo biến thể custom tự phát hoặc inline styles.
  3. *Extend Pattern:* Nếu thiếu UI control, viết nó dưới dạng reusable component vào thư mục chung theo đúng token hệ thống trước khi tích hợp vào trang.
* **MODE B: GREENFIELD (Mô-đun mới hoàn toàn / Chưa có Shell UI)**
  1. *Layout Hiện Đại:* Tránh cliché mặc định (Topbar + Sidebar + Card grid). Ưu tiên Split-screen bất đối xứng (cho Ops/Data) hoặc Floating Command Palette (Quick Actions).
  2. *Hierarchy:* Tương phản mạnh giữa Primary Title (Bold) và Metadata (Muted).
  3. *Full States:* Bắt buộc định nghĩa đủ 3 trạng thái: `Empty State`, `Skeleton Loading`, và `Error State`.

## 5. MCP & TOOL GATEKEEPER PROTOCOL
*Nguyên tắc: Lazy Evaluation. Không tự động gọi Tool nếu không có side-effects hoặc không cần external data.*

| Điều kiện phân loại | Hành động của Agent |
| :--- | :--- |
| **NEED_EXTERNAL_DATA:** Cần live logs, DB schema, quan hệ phụ thuộc sâu qua CodeGraph | 👉 Gọi duy nhất MCP Tool chuyên biệt cần thiết. |
| **NEED_EXECUTION:** Cần ghi/sửa file, terminal, git, trigger API | 👉 Gọi tool thực thi tương ứng. |
| **KNOWLEDGE / REFACTOR / CHAT:** Giải thích lý thuyết, review/refactor code ĐÃ CÓ trong prompt, draft logic độc lập | 🚫 **BYPASS TOOL**. Trả lời trực tiếp ngay lập tức bằng internal LLM. |

## 6. TOKEN ECONOMY & CONTEXT AUTO-COMPACTION
*Nguyên tắc: Ngăn chặn phình bộ nhớ và lãng phí token đọc lại lịch sử dài.*

* **Rolling Memory Compaction:** 
  - Tự động nén lịch sử chat dài thành một bản **Executive Snapshot (<150 tokens)** gồm:
    1. `Decisions Made` (Quyết định kỹ thuật đã chốt)
    2. `Modified Files` (Danh sách file đã tác động)
    3. `Current State` (Trạng thái lint/test hiện tại)
    4. `Active Next Step` (Bước kế tiếp duy nhất)
  - Loại bỏ hoàn toàn: logs terminal dài dòng, raw output, các bước thử nghiệm lỗi trung gian.
* **Strict `.ai-context.md` Snapshot Protocol:**
  - File `.ai-context.md` là **State Snapshot**, KHÔNG PHẢI Changelog/Git log. Giữ tổng độ dài **≤ 60 dòng**.
  - **Không append vô tội vạ:** Mục `Recent Changes` chỉ giữ đúng **Top 3 thay đổi gần nhất**; tự động ghi đè hoặc loại bỏ các mục cũ hơn.
  - **Mục Bất Tử (Không được xoá khi nén):** Luôn giữ nguyên *Tech Stack / Entrypoint* và *Critical Gotchas / Constraints* (quy ước cấm, port, bẫy kỹ thuật).
* **Silent Bootstrap:** Ở prompt đầu tiên của session mới, chỉ đọc ngầm `.ai-context.md` để nắm toàn bộ dự án thay vì parse lại toàn bộ transcript cũ.
* **Diff-Only Output:** Chỉ hiển thị đúng đoạn code/diff thay đổi, không in lại cả file dài.