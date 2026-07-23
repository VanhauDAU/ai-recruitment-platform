# Giai đoạn 0 — Git safety và baseline

> Đo ngày 2026-07-24 tại workspace local macOS. Báo cáo này giữ nguyên số liệu
> trước đợt audit/refactor; không dùng số local để khẳng định thời gian GitHub
> Actions thực tế.

## 1. Git safety

| Hạng mục | Giá trị |
| --- | --- |
| Nhánh ban đầu | `feature/candidate-account-recommendations` |
| HEAD ban đầu | `9e546324143c9bf7ca628d349c4b25a414db3a1b` |
| Nhánh refactor | `refactor/project-architecture-production-readiness` |
| HEAD sau khi tạo nhánh | `9e546324143c9bf7ca628d349c4b25a414db3a1b` |
| Working tree ban đầu | Sạch |
| File unstaged/staged/untracked | Không có |
| Conflict | Không có (`git ls-files -u` rỗng) |

Nhánh mới được tạo trực tiếp từ đúng HEAD hiện tại. Không chạy `reset`, `clean`,
`stash`, `rebase`, `merge`, không xóa dữ liệu và không làm mất thay đổi của nhánh
ban đầu.

## 2. Repository map

```text
.
├── .github/workflows/       # Backend CI và Frontend CI
├── backend/
│   ├── apps/                # 16 Django domain app
│   ├── common/              # Hạ tầng backend dùng chung
│   ├── config/settings/     # development/production/test settings
│   ├── media/               # Media local, bị Git ignore
│   ├── Dockerfile
│   ├── manage.py
│   └── pyproject.toml
├── deploy/nginx/            # Reverse proxy production
├── docs/
│   ├── 01-phan-tich/ … 08-frontend/
│   ├── 09-refactor/
│   └── adr/
├── frontend/
│   ├── public/              # Static source được track
│   ├── src/                 # app/pages/widgets/features/entities/shared
│   ├── tests/e2e/           # Playwright, gồm smoke tests
│   ├── Dockerfile
│   └── package.json
├── scripts/                 # Boundary, env và full-check scripts
├── docker-compose.yml
└── docker-compose.prod.yml
```

- Backend root: `backend/`; test được đặt trong cả 16 app.
- Frontend root: `frontend/`; có 106 file unit test và E2E cho ba viewport.
- Output local bị ignore: `frontend/dist`, `frontend/coverage`,
  `frontend/test-results`, `backend/media`, cache của Ruff/Pytest/import-linter.
- Static source: `frontend/public`; production static backend được tạo bằng
  `collectstatic` vào volume, `backend/staticfiles` không có trong working tree.
- File root quan trọng: `README.md`, `CHANGELOG.md`, `AGENTS.md`,
  `.pre-commit-config.yaml`, `.editorconfig`, hai Compose file.

## 3. Backend baseline

Môi trường local: Python 3.11.15, Django 5.1.5, Ruff 0.15.22,
import-linter 2.13, PostgreSQL và Redis local. Pytest dùng
`config.settings.test`.

| Check | Kết quả | Thời gian thực | Ghi chú |
| --- | --- | ---: | --- |
| `python manage.py check` | Pass | 3,31s | 1 system check được chủ đích silence |
| `makemigrations --check --dry-run` | Pass | 3,97s | Không có thay đổi model/migration pending |
| `ruff check .` | Pass | 0,12s | 0 lỗi |
| `ruff format --check .` | Pass | 0,11s | 420 file đúng format |
| `lint-imports` | Pass | 0,85s | 551 file, 808 dependency, 2 contract kept |
| `scripts/check_backend_layering.sh` | Pass | 0,02s | Service/selector không dùng DRF HTTP machinery |
| `scripts/check_env_sync.sh` | Pass | 0,19s | Backend và frontend đồng bộ `.env.example` |
| `pytest --durations=20` | Pass | 104,46s | 352 pass, 0 fail, 0 skip |
| `pytest --cov … --cov-fail-under=84` | Pass | 118,96s | 352 pass; 85,56% |

Coverage: 12.229 statements, 1.766 missing, cao hơn gate 84% đúng 1,56 điểm
phần trăm.

### 20 test chậm nhất (lượt không coverage)

| Thời gian | Phase | Test |
| ---: | --- | --- |
| 17,13s | setup | `AvatarUploadTests::test_authenticated_user_can_upload_avatar_to_media_storage` |
| 4,30s | call | `ApplicationSnapshotMigrationTests::test_clean_database_migrates_forward` |
| 2,43s | call | `CvV2ApiTests::test_pdf_renderer_uses_the_pinned_two_column_contract_without_content_conversion` |
| 1,97s | call | `ApplicationSnapshotMigrationTests::test_mismatched_snapshot_is_refused` |
| 1,91s | call | `ApplicationSnapshotMigrationTests::test_repair_is_idempotent_when_run_twice` |
| 1,85s | call | `ApplicationSnapshotMigrationTests::test_legacy_database_is_backfilled_and_contracted` |
| 1,75s | call | `ApplicationSnapshotMigrationTests::test_existing_snapshot_is_reused_not_duplicated` |
| 1,70s | call | `ApplicationSnapshotMigrationTests::test_partial_migration_columns_exist_but_unrecorded` |
| 0,76s | call | `PasswordChangeTests::test_candidate_password_change_does_not_change_same_email_employer` |
| 0,69s | call | `CvV2ApiTests::test_private_thumbnail_is_generated_from_latest_version_and_owner_scoped` |
| 0,65s | call | `RecruitmentCampaignApiTests::test_campaign_list_exposes_operational_counts_and_filters` |
| 0,64s | call | `TwoFactorAuthenticationTests::test_employer_backup_code_is_one_time_login_factor` |
| 0,59s | call | `CvV2ApiTests::test_pdf_renderer_matches_avatar_size_and_omits_empty_sections` |
| 0,59s | call | `CompanyUpdateRequestTests::test_session_marks_employer_verified_without_requiring_first_job` |
| 0,57s | call | `JoinCompanyTests::test_candidate_dpa_can_be_saved_without_mfa_requirement` |
| 0,55s | call | `RecruitmentCampaignApiTests::test_job_performance_uses_period_daily_counters_and_application_rows` |
| 0,55s | call | `TwoFactorAuthenticationTests::test_employer_can_disable_each_method_with_another_enabled_method` |
| 0,55s | call | `ConcurrentRefreshTests::test_two_simultaneous_refreshes_create_only_one_rotation_branch` |
| 0,53s | call | `CvV2ApiTests::test_pdf_export_blocks_idor_and_foreign_version_selection` |
| 0,53s | call | `SavedJobRecommendationApiTests::test_excludes_saved_applied_and_unavailable_jobs_without_cross_user_leakage` |

### Backend debt tồn tại trước refactor

- 146 pytest warning: 20 `RemovedInDjango60Warning` do
  `CheckConstraint.check`, 126 `InsecureKeyLengthWarning` do test HMAC key chỉ
  dài 28 byte.
- Local venv lệch một số version pin trong `requirements.txt`: pytest 9.1.1 so
  với 8.4.2, pytest-django 4.12.0 so với 4.11.1 và pytest-cov 7.1.0 so với
  7.0.0. Kết quả baseline local vì vậy không thay thế kết quả CI.
- Setup test upload avatar chiếm 17,13 giây và là hotspot rõ nhất.

## 4. Frontend baseline

Môi trường local: Node 25.6.1, npm 11.9.0, Playwright 1.61.1, Vite 8.1.3,
Vitest 4.1.10. CI hiện dùng Node 22 nên số thời gian local chỉ dùng làm mốc.

| Check | Kết quả | Thời gian thực | Ghi chú |
| --- | --- | ---: | --- |
| `npm ci` | Pass | 7,20s | 379 package, 0 vulnerability |
| API boundary | Pass | 0,08s | Không có axios ngoài `shared/api` |
| Feature boundary | Pass | 0,02s | Không có deep-import feature bị cấm |
| `npm run lint` | Pass | 1,24s | 0 error, 12 `max-lines` warning |
| `npm run check:architecture` | Pass | 0,94s | 619 module, 1.254 dependency, 0 violation |
| `npm run test:coverage` | Pass | 49,25s | 106 file, 374 test, không skip/fail |
| `npm run build` | Pass | 1,13s | 3.767 module; Vite nội bộ 606ms |
| `npm run check:bundle-budget` | Pass | 0,20s | JS và CSS còn trong budget |
| `npm run test:e2e:smoke` | Pass | 81,07s | 81/81 test, 5 worker, 3 viewport |

Coverage toàn `src`: statements 38,84% (4.861/12.513), branches 35,14%
(3.510/9.987), functions 34,33% (1.489/4.337), lines 41,20%
(4.307/10.453).

Bundle:

- Initial JS: 284,9/320,0 KiB gzip, còn 35,1 KiB.
- Initial CSS: 33,5/35,0 KiB gzip, chỉ còn 1,5 KiB.
- Chunk lớn nhất: `RichTextEditorImpl`, 382,00 KiB raw / 120,46 KiB gzip.
- CSS chính: 241,05 KiB raw / 34,59 KiB gzip.

Frontend debt tồn tại trước refactor:

- 12 file vượt ngưỡng `max-lines`: `CampaignApplyCvPanel.jsx`,
  `CampaignJobsPanel.jsx`, `EmployerGeneralSettings.jsx`, `CompanyForm.jsx`,
  `use-cv-draft-editor.js`, `CvDraftEditor.jsx`, `CampaignList.jsx`,
  `EmployerWorkspaceLayout.jsx`, `JobFormPreview.jsx`, `VerifyEmail.jsx`,
  `Register.jsx`, `JobList.jsx`.
- Coverage còn thấp trên toàn source, dù gate ratchet hiện hành pass.
- CSS chỉ còn 1,5 KiB headroom; thay đổi global CSS có nguy cơ chạm budget.
- Vitest/JSDOM phát 42 warning về pseudo-element `getComputedStyle` và 4 warning
  canvas `getContext`; không làm fail test nhưng tạo nhiễu log.
- Playwright phát 11 warning `NO_COLOR`/`FORCE_COLOR`; setup web server không
  được reporter đo riêng nên không có số setup độc lập.

## 5. GitHub Actions baseline

### Backend CI

```text
quality
  checkout → setup Python/cache → pip install → Ruff → import-linter
  → layering/env gates → Django/migration checks → pytest coverage
```

- 1 job, 1 lần `pip install`, PostgreSQL 16 và Redis 7 là service container.
- Không artifact, không timeout và không concurrency/cancel superseded runs.
- `push`: `main`, `feature/**`, `epic/**` với path backend; PR cũng path-filter.
- Push feature đang có PR tạo duplicate run; thay đổi riêng script boundary/env
  ở root không kích hoạt workflow.

### Frontend CI

```text
install
├── static-quality ─────────────┐
├── coverage ───────────────────┼── e2e-smoke
├── build → bundle-budget ──────┘
└── audit
```

- 7 job; `install` không chia sẻ `node_modules`, tổng cộng 6 lần `npm ci`.
- `e2e-smoke` bị chặn bởi quality, coverage và build/budget, sau đó mới cài lại
  Chromium cùng system dependencies.
- Có npm cache nhưng không cache Playwright browser. Coverage, dist, bundle
  stats và Playwright diagnostics đều được upload; nhiều artifact dùng
  `if: always()` dù chủ yếu phục vụ chẩn đoán lỗi.
- Concurrency đã có nhưng group dùng `github.ref`, vì vậy không triệt tiêu cặp
  push/PR cùng commit. Backend chưa có concurrency.
- `push`: `main`, `feature/**`, `epic/**` với frontend paths; mọi PR đều tạo
  workflow để tránh required status bị thiếu.
- `scripts/check_env_sync.sh` nói frontend CI gọi script nhưng workflow chỉ gọi
  script này từ Backend CI.

Tổng baseline khi cả hai workflow cùng kích hoạt: 8 job, 1 lần cài Python deps,
6 lần cài Node deps và 1 lần cài Playwright Chromium/OS deps. Required checks
thực tế nằm trong GitHub ruleset/branch protection và chưa thể xác minh chỉ từ
repository; tài liệu hiện liệt kê 6 frontend gates và 1 backend gate.

## 6. Kết luận Giai đoạn 0

- Tất cả baseline command bắt buộc đã chạy và pass.
- Không có migration pending, lint error, architecture violation, unit/E2E
  failure hoặc bundle-budget failure.
- Các warning, hotspot và CI bottleneck trên là tồn tại trước refactor; chưa sửa
  trong giai đoạn này.
- Không có breaking change và không tác động code sản phẩm.

Commit đề xuất: `docs(refactor): record git safety and project baseline`.
