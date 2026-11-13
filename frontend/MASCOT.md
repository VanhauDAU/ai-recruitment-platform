# ProCV mascot

## Trạng thái phase 1

Phase 1 tích hợp mascot vào portal ứng viên đã gồm:

- rig ghép layer với năm cảm xúc (`neutral`, `happy`, `thinking`, `success`,
  `error`), bảy pose (`neutral`, `wave`, `thumbsUp`, `checklist`,
  `frameGrip`, `coverEyes`, `peek`), hướng nhìn xuống,
  blink, talk, float và hai loại shadow;
- trợ lý mẫu sticky, panel lazy-load, hội thoại theo từ khóa, quick action điều
  hướng thật và liên hệ lấy từ site settings;
- mascot ở hero trang chủ với patrol animation phía trên cụm tìm kiếm, tự đổi
  cảm xúc/pose; cùng các empty state tìm việc, việc đã lưu, CV, hồ sơ đã ứng
  tuyển và việc làm phù hợp;
- robot dẫn cuộc phỏng vấn onboarding ứng viên, đổi mắt/miệng theo trả lời đúng,
  thiếu thông tin hay đang lưu;
- blink và talk đều dùng hai animation nghịch đảo: lớp mắt thường ẩn đúng lúc
  lớp mắt nhắm xuất hiện, lớp miệng theo cảm xúc ẩn đúng lúc lớp miệng mở xuất
  hiện — tránh chồng hai bộ mắt hoặc hai khẩu hình (rõ nhất ở `success`);
- xử lý va chạm với banner cookie theo chiều cao thực tế, thanh ứng tuyển mobile
  và `prefers-reduced-motion`;
- form đăng nhập/đăng ký ứng viên: mắt nhìn xuống khi nhập email, che hai mắt
  khi nhập mật khẩu ẩn và hé một mắt khi người dùng bật hiển thị mật khẩu; robot
  nằm ngoài card và dùng hai bàn tay bám vào mép trên nên không chiếm chỗ form;
- unit/regression test và smoke test responsive cho workflow trợ lý.

Phase này không thay đổi backend, API payload, route, auth guard, storage token
hoặc `BrandLoader`. Chatbot luôn ghi rõ câu trả lời đang dùng kịch bản mẫu.
Onboarding phỏng vấn cũng giữ nguyên payload `PUT /api/candidate/job-preferences/`
và cờ `job_preferences_configured`.

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
2. Các pose đạo cụ còn lại: `carry` và các đạo cụ chưa nối (`badge`,
   `briefcase`, `cv`, `magnifier`, `tie`); scene interview coach. Bộ tay `hold`
   đã dùng cho pose `checklist`.
3. Telemetry có consent cho open rate, quick action và helpfulness.
4. Thử nghiệm nội dung/chuyển động theo ngữ cảnh trước khi mở rộng sang portal
   nhà tuyển dụng hoặc admin.
