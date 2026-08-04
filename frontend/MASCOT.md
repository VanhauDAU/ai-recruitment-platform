# ProCV mascot

## Trạng thái phase 1

Phase 1 tích hợp mascot vào portal ứng viên đã gồm:

- rig ghép layer với năm cảm xúc (`neutral`, `happy`, `thinking`, `success`,
  `error`), bốn pose (`neutral`, `wave`, `thumbsUp`, `microphone`), blink, talk,
  float và hai loại shadow;
- trợ lý mẫu sticky, panel lazy-load, hội thoại theo từ khóa, quick action điều
  hướng thật và liên hệ lấy từ site settings;
- mascot ở hero trang chủ với patrol animation phía trên cụm tìm kiếm, tự đổi
  cảm xúc/pose; cùng các empty state tìm việc, việc đã lưu, CV, hồ sơ đã ứng
  tuyển và việc làm phù hợp;
- robot cầm micro trong trình đọc bài viết, phản ứng theo trạng thái chuẩn bị,
  đang đọc, tạm dừng, hoàn tất hoặc lỗi;
- blink dùng hai animation nghịch đảo: lớp mắt thường được ẩn đúng lúc lớp mắt
  nhắm xuất hiện, tránh hiện tượng chồng hai bộ mắt;
- xử lý va chạm với banner cookie theo chiều cao thực tế, thanh ứng tuyển mobile
  và `prefers-reduced-motion`;
- unit/regression test và smoke test responsive cho workflow trợ lý.

Phase này không thay đổi backend, API payload, route, auth guard, storage token
hoặc `BrandLoader`. Chatbot luôn ghi rõ câu trả lời đang dùng kịch bản mẫu.

## Tái tạo asset

PNG thiết kế gốc không được commit. Sinh lại WebP từ thư mục nguồn:

```bash
cd frontend
npm run build:mascot-assets -- --src /đường/dẫn/tới/procv-robot
```

Pipeline dùng `cwebp` với quality 82, alpha quality 90 và method 6. Mỗi output
được kiểm tra bằng `webpinfo` và phải có canvas 500×500. Script chuẩn hóa hai tên
file nguồn bị lỗi và vẫn có fallback pad trong suốt, không scale, cho bản bàn tay
415×491 cũ. Thư mục `states/` không được xuất vì rig dựng lại các state đó; file
`.DS_Store` cũng không nằm trong danh sách đầu vào.

## Hướng phase tiếp theo

Các mục sau được chủ động để ngoài phase 1:

1. Kết nối conversation API/LLM, streaming và cơ chế safety/feedback.
2. Các pose đạo cụ còn lại (`hold`, `carry`) và scene interview coach.
3. Telemetry có consent cho open rate, quick action và helpfulness.
4. Thử nghiệm nội dung/chuyển động theo ngữ cảnh trước khi mở rộng sang portal
   nhà tuyển dụng hoặc admin.
