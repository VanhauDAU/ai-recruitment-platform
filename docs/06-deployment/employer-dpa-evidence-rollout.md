# Employer DPA evidence rollout

## Mục tiêu

Rollout bằng chứng DPA versioned mà không bịa dữ liệu lịch sử và không mở quyền
candidate/admin approval khi policy hiện hành chưa được cấu hình chính xác.

## Cấu hình bắt buộc

```env
EMPLOYER_DPA_POLICY_VERSION=2026-08
EMPLOYER_DPA_DOCUMENT_SHA256=<sha256 lowercase của đúng nội dung pháp lý đã phát hành>
EMPLOYER_DPA_DOCUMENT_URL=https://example.com/legal/employer-dpa/2026-08
```

- Hash phải tính từ artifact pháp lý bất biến, không hash URL hoặc label.
- Production fail startup nếu version/hash/HTTPS URL thiếu hoặc sai.
- Cấu hình version/hash mới làm acceptance cũ thành `outdated` ngay; candidate
  data và admin approval fail closed, workspace vẫn theo ma trận grace đã chốt.

## Trình tự deploy

1. Sao lưu PostgreSQL Docker/staging theo runbook hiện hành.
2. Deploy code và chạy migration `employers.0039_employer_dpa_acceptance`.
   Migration chỉ tạo schema, tuyệt đối không tạo evidence từ
   `RecruiterProfile.dpa_accepted_at`.
3. Cấu hình exact artifact version/hash/URL và restart backend.
4. Kiểm tra `GET /api/employer/me/`: legacy timestamp trả
   `legacy_unversioned`; policy trả `available=true`.
5. Xác nhận một tài khoản test; kiểm tra một row append-only có IP/session và
   UI đổi sang `current`.
6. Đổi hash trên staging để diễn tập stale 409 và `outdated`, sau đó khôi phục
   exact release hash.

## Rollback

- Rollback code nhưng giữ bảng evidence; không xóa lịch sử acceptance.
- Nếu artifact cấu hình sai, khôi phục exact version/hash cũ và restart.
- Không sửa timestamp, không backfill IP/session/hash và không hạ quyền bằng
  cách coi `legacy_unversioned` là `current`.

## Residual gate

Grace timer, DPA compliance-hold batch/reconcile và release đúng source vẫn nằm
trong ER-6B/ER-8; chỉ bật rollout cohort sau dry-run và product/ops sign-off.
