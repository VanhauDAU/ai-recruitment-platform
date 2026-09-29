# Hợp đồng hành vi ProCV tại P0

Tài liệu này đóng băng các registry và surface cần so sánh ở P5, P6 và P10. Nó
không khẳng định baseline đang xanh; các sai lệch phát hiện được giữ nguyên làm
đầu vào cho P1 hoặc giai đoạn sở hữu tương ứng.

## Django app và migration

Commit baseline có 17 app dự án, không còn 18 app như SHA cũ trong kế hoạch.
`interviews` đã được loại trước P0. Migration graph tĩnh có 230 migration.

| App | Model | Leaf migration |
| --- | ---: | --- |
| accounts | 12 | `0027_employer_domain_permissions` |
| ai_core | 2 | `0001_initial` |
| applications | 2 | `0012_application_auto_rejected_at_and_more` |
| blog | 7 | `0004_blog_media_asset` |
| candidates | 9 | `0007_candidate_preference_positions_and_skills` |
| cv_templates | 11 | `0010_lock_contact_marker` |
| cvs | 9 | `0010_cvasset` |
| dashboard | 0 | Không có migration |
| employers | 29 | `0047_company_public_search_indexes` |
| jobs | 28 | `0045_candidate_hidden_job` |
| knowledgebase | 4 | `0003_seed_verified_help_content` |
| locations | 1 | `0002_location_merged_from` |
| privacy | 0 | Không có migration |
| services | 15 | `0011_job_refresh_ranking_index` |
| sitecontent | 10 | `0020_employer_badge_setting_constraints` |
| skills | 2 | `0002_alter_skill_options_remove_skill_category_skillgroup_and_more` |
| uploads | 3 | `0001_initial` |

P5 không được đổi AppConfig name/label, migration graph, `AUTH_USER_MODEL`,
`db_table`, `related_name`, content type hoặc permission codename.

## OpenAPI

Lệnh baseline:

```bash
DJANGO_SETTINGS_MODULE=config.settings.test \
  backend/venv/bin/python backend/manage.py spectacular \
  --file /tmp/procv-p0-openapi.yaml --validate
```

| Nguồn | Byte | SHA-256 | Path | Operation | Schema |
| --- | ---: | --- | ---: | ---: | ---: |
| Sinh từ code tại P0 | 841.769 | `3744aeb2797f4dc089ee5b41b4c250489d77a911b6ffc76ab8cc3a675c5995d5` | 395 | 517 | 640 |
| `docs/04-api/openapi.yaml` | 746.048 | `2483df604b6cb11f87970437ecddfe05a692845929adfc2a9fb463130422a0d1` | 353 | 470 | 563 |

Hai schema không giống nhau. Generator trả exit code 0 nhưng báo 417 warning
(344 duy nhất) và 224 error (52 duy nhất), gồm APIView không suy ra serializer và
collision operation/enum. P0 chỉ ghi nhận drift; sửa schema thuộc PR riêng trước
hoặc trong giai đoạn có owner, sau đó P5/P10 phải diff schema đã chuẩn hóa thứ tự.

## Permission registry

Nguồn chuẩn là `backend/apps/accounts/constants/admin_permissions.py`. Baseline có
67 permission code và dependency giữa quyền thao tác với quyền xem. Gate hiện tại
`scripts/check_admin_permissions_sync.sh` đối chiếu backend với frontend. P5/P10
phải giữ nguyên tập code và dependency trừ khi có yêu cầu sản phẩm riêng.

## Celery task và queue

Celery autodiscovery đăng ký 36 task dự án:

| App | Số task |
| --- | ---: |
| accounts | 2 |
| ai_core | 1 |
| applications | 1 |
| cv_templates | 2 |
| cvs | 6 |
| employers | 8 |
| jobs | 8 |
| services | 5 |
| uploads | 3 |

Queue mặc định là `default`. Route hiện tại:

| Pattern | Queue |
| --- | --- |
| `apps.accounts.tasks.auth_email.*` | `auth-email` |
| `apps.employers.tasks.phone_sms.*` | `auth-sms` |
| `apps.employers.tasks.tax_lookup.*` | `default` |
| `apps.employers.tasks.domain_claims.*` | `default` |
| `apps.cvs.tasks.*` | `cv-export` |
| `apps.uploads.tasks.*` | `upload-scan` |
| `apps.jobs.tasks.ai_generation.*` | `ai-generation` |
| `apps.jobs.tasks.*` | `candidate-email` |
| `apps.applications.tasks.*` | `candidate-email` |
| Ba task alert cụ thể của services | `candidate-email` |
| `apps.services.tasks.*` | `default` |

Không đổi tên task hoặc queue khi tổ chức module vì message cũ có thể còn trong
broker.

## Baseline UI

Ảnh dùng dữ liệu API mock xác định, locale `vi-VN`, timezone
`Asia/Ho_Chi_Minh`, Chromium 149 và `reducedMotion=reduce`. Route `/`, role guest,
state là trang chủ đã tải với danh sách việc làm rỗng hợp lệ.

| Ảnh | Viewport | SHA-256 |
| --- | --- | --- |
| [Desktop](ui/home-guest-desktop.png) | 1440 x 900 | `c0215c28bf1f524e1ce7c07590b5da6493fd067059f783d54d35b8291fe1c5ec` |
| [Tablet](ui/home-guest-tablet.png) | 834 x 1112 | `b5fc82f86acdf1ce1c149d239c305b486340440932e1f4d4348541af4f9e7f8c` |
| [Mobile](ui/home-guest-mobile.png) | 393 x 851 | `ac6bbaecbf61f2f8136f1b13ff863f4da13e2eb90165f322e4bc629e597fa0d7` |

Vùng động được định nghĩa trước cho P10: ngày trong khối “Thị trường việc làm
hôm nay”, animation mascot/hero và vòng quay việc làm tốt nhất. Khi so ảnh chỉ
mask các vùng này; không tăng ngưỡng để giấu thay đổi layout. Các luồng role sâu
được bảo vệ bởi E2E hiện có và phải chạy đủ ba viewport ở P6/P9/P10.

## Ma trận luồng cần giữ

| Nhóm | Hợp đồng chính |
| --- | --- |
| Candidate | Auth, hồ sơ, CV create/edit/upload/export, tìm/lưu/ứng tuyển và trạng thái |
| Employer | Auth, onboarding/readiness, công ty, tin/chiến dịch, ứng viên và chuyển trạng thái |
| Admin | Auth/guard, RBAC, duyệt tin/công ty, nội dung, danh mục và cấu hình |
| Auth liên cổng | Session, refresh/logout, cookie, CSRF/CORS, OAuth callback, chặn trái quyền |
| AI và queue | Provider contract, quyền/hạn mức, lỗi/timeout, routing và trạng thái kết quả |
| Upload | Public/private/quarantine, owner access, download, lỗi, cleanup và chống rò dữ liệu |
| UI/router | Direct route, reload, lazy load, loading/empty/error, asset, animation và responsive |
| Bổ sung | Thông báo, dịch vụ, blog/FAQ và tích hợp đang bật trong baseline |
