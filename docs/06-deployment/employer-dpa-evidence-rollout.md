# Employer DPA evidence rollout

## Mục tiêu

Rollout bằng chứng DPA versioned mà không bịa dữ liệu lịch sử và không mở quyền
candidate/admin approval khi policy hiện hành chưa được cấu hình chính xác.

## Cấu hình bắt buộc

```env
EMPLOYER_DPA_POLICY_VERSION=2026-08
EMPLOYER_DPA_DOCUMENT_SHA256=<sha256 lowercase của đúng nội dung pháp lý đã phát hành>
EMPLOYER_DPA_DOCUMENT_URL=https://example.com/legal/employer-dpa/2026-08
EMPLOYER_DPA_GRACE_DAYS=30
```

- Hash phải tính từ artifact pháp lý bất biến, không hash URL hoặc label.
- Production fail startup nếu version/hash/HTTPS URL thiếu hoặc sai.
- Production fail startup nếu grace khác đúng 30 ngày đã được phê duyệt.
- Cấu hình version/hash mới làm acceptance cũ thành `outdated` ngay; candidate
  data và admin approval fail closed, workspace vẫn theo ma trận grace đã chốt.

## Trình tự deploy

1. Sao lưu PostgreSQL Docker/staging theo runbook hiện hành.
2. Deploy code và chạy migrations `employers.0039_employer_dpa_acceptance`,
   `employers.0040_recruiter_dpa_grace`. Migration chỉ tạo schema, tuyệt đối
   không tạo evidence, deadline hoặc hold từ `RecruiterProfile.dpa_accepted_at`.
3. Cấu hình exact artifact version/hash/URL và restart backend.
4. Kiểm tra `GET /api/employer/me/`: legacy timestamp trả
   `legacy_unversioned`; policy trả `available=true`.
5. Xác nhận một tài khoản test; kiểm tra một row append-only có IP/session và
   UI đổi sang `current`.
6. Đổi hash trên staging để diễn tập stale 409 và `outdated`, sau đó khôi phục
   exact release hash.

## Rollout grace 30 ngày

Mọi command đều dry-run mặc định. Dùng một `rollout-id` bất biến cho toàn cohort
và ghi nó vào ticket vận hành. Ví dụ:

```bash
docker compose exec backend python manage.py rollout_employer_dpa_compliance \
  --phase start-grace --rollout-id dpa-2026-08 --batch-size 100 --cursor 0
```

Review JSON `selected`, `first_id`, `next_cursor`; đối chiếu cohort với báo cáo
ops. Chỉ sau phê duyệt mới chạy lại cùng tham số với `--apply`:

```bash
docker compose exec backend python manage.py rollout_employer_dpa_compliance \
  --phase start-grace --rollout-id dpa-2026-08 --batch-size 100 --cursor 0 --apply
```

- Lặp theo `next_cursor` cho đến `selected=0`.
- Chạy lại cùng batch là idempotent; không đổi deadline đã tạo.
- Trong grace, workspace vẫn mở; candidate-data và admin job approval bị chặn.
- UI đọc `dpa_grace_expires_at` từ server; client không tự tính quyền theo giờ.

## Áp hold sau khi grace hết hạn

Dry-run trước, dùng đúng `rollout-id` của grace:

```bash
docker compose exec backend python manage.py rollout_employer_dpa_compliance \
  --phase expired-holds --rollout-id dpa-2026-08 --batch-size 100 --cursor 0
```

Sau ops review, thêm `--apply`. Batch khóa theo thứ tự canonical, tạo tối đa một
active DPA hold/recruiter và liên kết toàn bộ campaign/job của recruiter mà
không đổi business status. Chạy lại không tạo hold/link trùng. Nếu recruiter đã
re-consent exact policy trong lúc rollout, điều kiện được recheck và bỏ qua.

Kiểm tra sau mỗi batch:

1. `dpa_status=hold`, `job_workspace_ready=false`, candidate-data và job
   approval bị chặn.
2. Public job có active DPA hold không còn xuất hiện nhưng status không bị đổi.
3. Sau re-consent, DPA hold chuyển `released`; verification/account/moderation
   hold khác vẫn active.
4. Metric số selected/created/active không lệch khỏi dry-run ngoài các account
   đã re-consent hợp lệ.

## Rollback

- Rollback code nhưng giữ bảng evidence; không xóa lịch sử acceptance.
- Nếu artifact cấu hình sai, khôi phục exact version/hash cũ và restart.
- Không sửa timestamp, không backfill IP/session/hash và không hạ quyền bằng
  cách coi `legacy_unversioned` là `current`.
- Dừng batch nếu số lượng lệch dry-run hoặc có
  `COMPLIANCE_HOLD_SOURCE_CONFLICT`; không đổi rollout ID để lách conflict.
- Rollback code không xóa hold/link audit. Nếu cần khôi phục quyền, dùng quy
  trình release theo exact DPA source sau phê duyệt; tuyệt đối không update hàng
  loạt mọi hold.
- Migration rollback khẩn cấp chỉ rollback code trước; giữ schema/evidence để
  tránh mất audit. Rollout production vẫn thuộc approval gate ER-8.
