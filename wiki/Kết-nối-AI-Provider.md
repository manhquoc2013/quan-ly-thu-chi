# Kết nối AI Provider

Ứng dụng hỗ trợ 6 AI provider. Vào **Cài đặt → tab AI** để cấu hình.

## Thứ tự ưu tiên

Có thể kéo thả để thay đổi thứ tự. Mặc định: Kilo Free → Gemini → OpenRouter → SiliconFlow → Groq → WebLLM.

## Kilo Free

- **Chi phí**: Miễn phí
- **Limit**: ~200 req/giờ/IP
- **Cấu hình**: Không cần API key — bật/tắt trong Cài đặt

## Gemini

- **Chi phí**: Free-tier 1.500 req/ngày (model Flash)
- **Limit**: Xem [Google AI rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- **Cấu hình**: Lấy key từ [Google AI Studio](https://aistudio.google.com/apikey)

## OpenRouter

- **Chi phí**: Theo gói API key
- **Cấu hình**: Lấy key từ [OpenRouter Keys](https://openrouter.ai/keys)

## SiliconFlow

- **Chi phí**: Theo gói API key
- **Cấu hình**: Lấy key từ [SiliconFlow](https://cloud.siliconflow.com/account/ak)

## Groq

- **Chi phí**: Free-tier ~30 req/phút, ~14.400 req/ngày
- **Cấu hình**: Lấy key từ [Groq Console](https://console.groq.com/keys)

## WebLLM (Local)

- **Chi phí**: Miễn phí, không giới hạn
- **Model**: Qwen3-4B (~4GB, tải 1 lần)
- **Yêu cầu**: WebGPU (Chrome/Edge mới nhất)

---

→ [Trang chủ Wiki](Home)
