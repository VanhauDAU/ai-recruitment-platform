# P1 Ổn định và chẩn đoán CI

P1 chạy trên nhánh `fix/ci-test-stability`, bắt đầu từ `dev` tại commit
`8421e3fc0e6ad2a39460cf69b78a75064107fc40`. Phạm vi chỉ gồm diagnostics,
fixture/test contract và lỗi test tái hiện được. Không giảm coverage, thêm skip,
đổi UI/API hoặc nâng dependency.

## Diagnostics đã bổ sung

- Pytest chạy `-vv`, `--durations=30`, JUnit và `faulthandler_timeout=120`.
- Backend và frontend có timeout chủ động ngắn hơn job timeout để bước
  `always()` còn thời gian xuất summary và upload log/JUnit/coverage.
- Vitest xuất verbose + JUnit; summary đọc test count và coverage machine-readable.
- Playwright giữ trace ngay trong lượt chính và bỏ rerun toàn bộ failure. Lượt
  rerun cũ tốn khoảng 5,5 phút nhưng 33/34 test vẫn fail.
- E2E CI khóa `VITE_API_BASE_URL=http://localhost:8000/api` để mock không phụ
  thuộc file `.env` cá nhân.

## Frontend

### E2E

- Baseline P0: 236 pass, 34 fail, 6 skip; rerun 34 lỗi chỉ có 1 pass.
- Sau sửa fixture: 270 pass, 6 skip, 0 fail trong 9,4 phút, ba viewport Chromium.
- Nhóm 33 test từng lỗi chạy thêm hai lượt, mỗi lượt 33/33 pass trong 1,5 phút.
- Nguyên nhân: ordering assertion cũ, route mock khóa hostname, readiness/DPA
  payload cũ, upload-session chưa mock, response shape `/jobs/best/` sai, fixture
  ảnh 1x1, nhãn accessibility cũ và ngày visibility đã hết hạn.

### Unit coverage

- 1.235 test pass, 0 fail.
- Coverage: statements 55,10%; branches 53,17%; functions 49,66%; lines 57,63%.
- Tổng thời gian testcase trong JUnit: 227,08 giây. Test chậm nhất là
  `AdminCompanyWorkspace` 16,21 giây ở lượt cold/coverage; chạy riêng còn 4,41
  giây. Các test layout thiếu provider đã được mock widget ngoài phạm vi, loại bỏ
  stack trace giả mà không đổi component.
- Coverage CI dùng timeout job 20 phút và dừng test ở phút 17 để giữ artifact.

## Backend

### Lượt full chẩn đoán

- 1.263 test được thu thập.
- Kết quả ban đầu: 1.226 pass, 35 fail, 2 skip trong 14m31s local.
- Nhóm migration chiếm phần lớn thời gian: test chậm nhất 65,40 giây; sáu test
  application snapshot từ 45,34 đến 51,39 giây/test.
- 35 failure quy về bốn nguyên nhân: venv thiếu dependency đã khóa
  `tldextract`; test dùng ngày UTC thay vì ngày lifecycle Việt Nam; fixture phone
  verification thiếu ba trường canonical; migration jobs dùng historical state
  không khớp schema employers và làm bẩn schema sau lỗi `setUp`.
- Sau khi đồng bộ venv và sửa fixture: nhóm 35 failure đạt 33/35; hai test còn lại
  được sửa và đạt 2/2. Một lượt full cuối đi qua 62% không lỗi trước khi Docker
  Desktop local dừng; PostgreSQL service của CI là gate full độc lập trước merge.
- Các static gate đạt: Ruff/format, import-linter, Django check, migration dry-run,
  layering, permission sync và env sync. Migration dry-run local cảnh báo DB không
  chạy nhưng vẫn xác nhận không có model change; CI sẽ kiểm tra với PostgreSQL thật.

### Timeout

Local full suite hoàn tất trong 14m31s nhưng GitHub-hosted runner đã chạm 35 phút
ở hai SHA liên tiếp. P1 tăng backend job lên 50 phút, dừng pytest ở phút 47 để
giữ diagnostics. Đây là headroom ổn định tạm thời; profile/sharding và mục tiêu
10–12 phút thuộc P8.

## Gate còn lại

1. Push PR P1 và chạy full backend với coverage >=84% trên PostgreSQL service.
2. Kiểm chứng diagnostics artifact, frontend coverage/build/budget và E2E trên CI.
3. Chỉ đánh dấu P1 `Verified` và tạo P2 sau khi PR được squash merge vào `dev`.
