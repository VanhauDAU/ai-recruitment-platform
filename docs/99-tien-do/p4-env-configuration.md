# P4 Chuẩn hóa cấu hình môi trường

P4 được merge vào `dev` tại commit `610b379e60b9ab1646e2fe157a201d7e0e3e7941`
ngày 10/10/2026. Follow-up `codex/p4-env-gate-followup` khép các khoảng trống
phát hiện khi chạy gate. Docker runtime smoke đạt ngày 11/10/2026; P4 chỉ chuyển
sang Verified sau khi follow-up được merge và full CI đạt trên SHA cuối.

## Kết quả triển khai

- Backend và frontend có mẫu local tối thiểu cùng catalog optional không tự nạp.
  Root có `.env.example` riêng cho tùy chọn Compose; không sở hữu secret ứng dụng
  hoặc biến `VITE_*`.
- Backend đọc duy nhất `backend/.env` cùng process environment. Loader không đi
  ngược lên `.env` ở root và có unit test cho độ ưu tiên, cast và catalog optional.
- Compose giữ override hạ tầng nội bộ cho DB, Redis, media và ClamAV. Override
  `AI_RUNTIME_ENABLED` và `VITE_ANNOUNCEMENT_ROLLOUT_SURFACES` đã bỏ để mỗi cờ
  chỉ có một owner.
- Vite dùng `loadEnv` cho `API_PROXY_TARGET`, `PORT` và `ANALYZE`; các biến
  tooling không có tiền tố `VITE_` không bị đưa vào bundle. Playwright tiếp tục
  nhận `PLAYWRIGHT_PORT` từ process/runner.
- Khai báo lặp `SAVED_JOB_REMARKETING_ENABLED` trong settings đã bỏ. Sai lệch
  `OAUTH_CODE_TTL` được ghi rõ: catalog local giữ 120 giây, fallback code 60 giây
  và chỉ được đổi trong bugfix auth riêng.
- Env checker kiểm union catalog, owner, tên trùng, consumer thiếu/thừa, cast,
  default drift đã ghi nhận, JSON, Compose interpolation và tên `VITE_*` có dấu
  hiệu secret. Khi có `.env` local, checker chỉ in tên key cần xem xét, không in
  giá trị và không tự sửa file.
- Inventory P4 được sinh lại từ checker. 14 key TTS đã xác nhận hết consumer và
  bản rollout trùng owner ở root đã được xóa khỏi env local sau khi sao lưu ngoài
  Git với quyền chỉ chủ sở hữu. Ba key `SPEECH_*` khác và hai key trùng chưa có
  quyết định hành vi nên chỉ được báo cáo.

## Bằng chứng gate

| Gate | Kết quả ngày 10/10/2026 |
| --- | --- |
| Env catalog | Đạt: 199 backend consumer, 196 backend declaration, 18 frontend consumer, 16 frontend declaration, 18 Compose interpolation và 17 Compose declaration |
| Unit env | Đạt 6 test loader/checker; báo cáo local không chứa giá trị |
| Backend lint và kiến trúc | Ruff check/format đạt trên 758 file; import-linter giữ 2 contract |
| Django và migration | `check` development/test đạt; không phát sinh migration |
| Backend test | Full run 1.265 pass, 2 skip, coverage 87,59%; một test PDF lỗi do macOS không tìm thấy thư viện Homebrew, rerun với `DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib` đạt |
| Frontend unit | 333 file, 1.235 test đạt; statements 55,10%, branches 53,15%, functions 49,67%, lines 57,62% |
| Frontend lint và kiến trúc | Lint đạt với cảnh báo max-lines baseline; dependency graph 1.329 module và 2.724 dependency đạt |
| Build và bundle | Build đạt; initial JavaScript 317,4/320 KiB gzip, CSS 37,4/38 KiB gzip |
| E2E smoke | 270 pass, 6 skip trên desktop, tablet 834x1112 và mobile Chromium |
| Tài liệu và repository | 233 link nội bộ đạt; permission sync đạt; clean dry-run và `git diff --check` đạt |
| Docker runtime | Đạt ngày 11/10/2026: đủ 9 service parse; DB/Redis/backend/frontend healthy; API và frontend phản hồi; backend/worker/AI worker/beat nhận đúng cờ từ backend owner; Vite đọc rollout từ frontend owner; bốn media root còn nguyên; worker thường nghe 6 queue, AI worker chỉ nghe `ai-generation`; task CV đăng ký đúng tên và beat phát lịch |

## Điều kiện chuyển P4 sang Verified

1. Merge follow-up P4 vào `dev` và chốt SHA.
2. Chạy lại full gate trên cùng SHA. Test PDF trên macOS phải dùng thư viện
   Homebrew hiện có hoặc chạy trong image CI đã cài đủ WeasyPrint dependency.
3. Chỉ xử lý ba key `SPEECH_*` chưa catalog và hai key lặp trong env cá nhân sau
   khi có quyết định cụ thể; không xóa theo wildcard.
