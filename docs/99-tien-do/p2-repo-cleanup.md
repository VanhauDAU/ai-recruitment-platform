# P2 Dọn artifact và media test

P2 chạy trên nhánh `chore/repo-cleanup`, bắt đầu từ `dev` tại commit
`711b50abb61262b1e47c4fb09854d7053944b6fc`. Phạm vi chỉ gồm output có thể tái
tạo, ignore và media root đã được xác minh là fixture phát sinh. Không xóa volume,
file `.env`, venv, node_modules hoặc dữ liệu runtime.

## Phân loại media root

21 file được thêm ở commit `4e6e4cee` trong lúc phát triển domain verification:

- 10 PDF tối giản giống hệt nhau, 45 byte/file;
- 3 DOCX placeholder giống hệt nhau, 68 byte/file;
- 8 PNG 1x1 giống hệt nhau, 67 byte/file;
- tổng 1.212 byte;
- không có đường dẫn, public ID hoặc tên file nào được code/test tham chiếu trực tiếp;
- runtime native mặc định dùng `backend/public-media` và `backend/private-media`;
  Docker dùng named volume, không dùng hai thư mục media ở root.

Kết luận: đây là test artifact mang đường dẫn runtime, không phải fixture được đọc.
P2 bỏ chúng khỏi Git index và ignore `/public-media/`, `/private-media/`. File vật
lý vẫn còn nguyên trên máy. P0 đã lưu path và Git blob trong
`baseline/tracked-files.csv`; có thể phục hồi bằng revert commit P2 hoặc đọc blob
từ lịch sử Git.

## Clean script

`scripts/clean_artifacts.sh` hỗ trợ `--dry-run`, từ chối tham số lạ và chỉ xóa
đường dẫn artifact/cache đã biết. Script prune toàn bộ `.git`, `venv`, `.venv` và
`node_modules`; không đọc/xóa media hoặc env. Hai lượt clean thật liên tiếp đều
hoàn tất và giữ nguyên:

- `backend/.env`;
- `backend/venv`;
- `frontend/node_modules`;
- toàn bộ 21 file media vật lý.

Root `.gitignore` bổ sung `blob-report/`, `coverage/` và hai media root. Frontend
đã có ignore riêng cho coverage, Playwright report, blob report và test results.

## Gate P2

- Dry-run không làm thay đổi working tree và không liệt kê dependency/env/media.
- Clean chạy hai lần idempotent.
- Upload pipeline test
  `test_clean_scan_creates_private_unclaimed_asset_and_deletes_quarantine` chạy
  hai lượt độc lập trên PostgreSQL 16 UTF-8: cả hai pass.
- Hash SHA-256 của toàn bộ 21 file media trước và sau hai lượt test giống hệt;
  test không sửa hoặc sinh thêm dữ liệu root.
- File vật lý không bị xóa; Git history và manifest P0 giữ điểm phục hồi.

P2 chỉ chuyển sang `Verified` sau khi PR được squash merge vào `dev`.
