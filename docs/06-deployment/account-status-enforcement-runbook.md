# Runbook triển khai và vận hành account status enforcement

## 1. Phạm vi

Release gồm:

- `accounts.0021_account_status_enforcement`;
- `employers.0029_campaign_policy_hold`;
- `jobs.0032_job_policy_hold`;
- API preview/confirm trạng thái và gỡ resource hold;
- transactional outbox `account_status_notice`;
- canonical read/write guard và UI quản trị theo state machine.

Hai permission mới được seed nhưng **không gán mặc định cho role**:

- `account.status.ban`;
- `account.resource_hold.release`.

P0 chỉ superuser được cấm, bắt đầu khôi phục tài khoản bị cấm và gỡ hold. Không
mở quyền này cho support trước khi có four-eyes approval.

## 2. Preflight

1. Sao lưu PostgreSQL và ghi nhận restore point.
2. Chạy trên production snapshot:

   ```bash
   docker compose exec backend python manage.py reconcile_account_status_holds
   ```

3. Ghi số account `inactive`/`banned`, campaign/job nonterminal và thời gian
   dự kiến của backfill.
4. Xác nhận worker hiện tại đã xử lý hết auth outbox pending; worker mới phải
   hiểu `account_status_notice`.
5. Xác nhận có tối thiểu hai superuser MFA hoạt động.

## 3. Triển khai

Chặn tạm thời các mutation account/job/campaign trong cửa sổ migrate nếu bảng
lớn. Triển khai migration trước code mới:

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py sync_admin_permissions
docker compose exec backend python manage.py export_admin_permissions \
  --output /app/../frontend/src/entities/admin-access/model/admin-permissions.generated.json
docker compose exec backend python manage.py reconcile_account_status_holds
```

Sau đó deploy/restart backend, worker và frontend. Không chạy `--apply` nếu báo
cáo read-only chưa được người vận hành duyệt.

Nếu cần sửa các mismatch fail-closed:

```bash
docker compose exec backend python manage.py reconcile_account_status_holds --apply
docker compose exec backend python manage.py reconcile_account_status_holds
```

`--apply` chỉ thêm `ban_review`/`legacy_lock`; không tự gỡ hold của account
active.

## 4. Quy trình quản trị

### Tạm khóa

1. Đối chiếu public ID, role, email, công ty và thông tin xác minh trên modal.
2. Chọn **Tạm khóa tài khoản**, nhập lý do, xem preview.
3. Kiểm tra số phiên, campaign/job/application và phạm vi công ty.
4. Confirm. Xác nhận account mất phiên; status nghiệp vụ không đổi và tài
   nguyên nonterminal nhận `temporary_lock`.
5. Khi mở lại, preview lại; chỉ `temporary_lock` được gỡ. Tin hết hạn/đóng vẫn
   không public.

### Cấm và khôi phục

1. Superuser chọn **Cấm tài khoản**, chọn nhóm vi phạm và ghi evidence 20–500
   ký tự; không nhập secret.
2. Preview và confirm. Employer resource nhận `ban_review`.
3. Khi có quyết định khôi phục, chọn **Bắt đầu khôi phục** để chuyển
   `BANNED → INACTIVE`; tuyệt đối không mở active trực tiếp.
4. Rà soát từng campaign/job, trạng thái, hạn nộp, khiếu nại và nghĩa vụ pháp
   lý. Ghi mã ticket/biên bản.
5. Chọn **Rà soát & gỡ giữ tài nguyên**; account vẫn inactive.
6. Preview **Mở lại tài khoản**, confirm và yêu cầu người dùng đăng nhập lại.

### Ứng viên

- Khóa/cấm không xóa CV hay application snapshot.
- Employer thấy cảnh báo candidate restricted.
- Chỉ được chuyển application sang `rejected`; mọi bước tiến khác bị API từ
  chối.

## 5. Smoke test staging

1. Employer có campaign active, job trực tiếp active và job thuộc campaign.
2. Tạm khóa: cả hai job biến mất khỏi public/search/saved detail; status gốc
   vẫn active; recruiter khác cùng công ty không bị ảnh hưởng.
3. Mở lại: job còn hạn xuất hiện lại, job hết hạn vẫn ẩn.
4. Cấm: session/JWT/refresh/link xác thực cũ bị từ chối; hold là `ban_review`.
5. Thử `BANNED → ACTIVE`: phải 400.
6. Chạy đủ ba bước khôi phục; chỉ sau bước cuối mới đăng nhập được.
7. Candidate inactive: employer không shortlist/interview/accept được nhưng
   reject được.
8. Tạo/sửa resource giữa preview và confirm: confirm phải 409, UI tải lại
   impact và không tự confirm.
9. Kiểm tra email notice không có reason/evidence; audit có actor, evidence,
   snapshot/effect count và không có secret.
10. Chạy reconciliation lần cuối; mọi mismatch phải bằng 0, ngoại trừ hold
    active đã có ticket rà soát rõ.

## 6. Quan sát

Theo dõi:

- 400 state-machine violation và 409 stale impact;
- 403 từ canonical write guard sau khi account bị khóa;
- số `temporary_lock`, `ban_review`, `legacy_lock` theo status tài khoản;
- outbox `account_status_notice` failed/cancelled;
- audit `temporarily_suspend_account`, `ban_account`,
  `begin_account_reactivation`, `release_account_resource_hold`,
  `reactivate_account`;
- public job count trước/sau rollout theo recruiter.

## 7. Rollback

- Ưu tiên rollback code, **không reverse migration** và không xóa transition/
  permission/audit.
- Trước khi chạy worker cũ, drain hoặc cancel có kiểm soát
  `account_status_notice` pending vì worker cũ không hiểu kind mới.
- Chạy reconciliation read-only và xác nhận mọi account có hold vẫn
  `is_active=false`; nếu không, giữ fail-closed và xử lý thủ công.
- Không dùng SQL để đổi campaign/job status nhằm “khôi phục”.
- Chỉ reverse schema trong maintenance window sau khi:
  - không còn code đọc field mới;
  - không còn hold;
  - transition đã được export/lưu theo retention;
  - security/product/data owner phê duyệt.
