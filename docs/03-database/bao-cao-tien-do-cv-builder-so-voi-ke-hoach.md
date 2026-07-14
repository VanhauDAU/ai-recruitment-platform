# Báo cáo tiến độ CV Builder so với kế hoạch production

**Cập nhật:** 2026-07-14  
**Nguồn đối chiếu:** [Kế hoạch kiến trúc CV Builder](./ke-hoach-kien-truc-database-cv-builder-production.md) và code hiện tại trong repository.  
**Phạm vi đánh giá:** trạng thái code hiện có (bao gồm thay đổi chưa commit trong workspace), không phải xác nhận đã deploy production.

## Kết luận ngắn

Nền tảng Candidate CV Builder đã hoàn thành phần lớn luồng cốt lõi: canonical schema, template version, draft optimistic locking, immutable version, template catalog, Builder cơ bản/nâng cao, application snapshot, recruiter read-only snapshot, owner view, shared link và PDF export bất biến.

Tuy nhiên **Phase 1 theo Definition of Done của kế hoạch chưa hoàn tất**. Các hạng mục chính còn thiếu là Admin CV/template workflow đầy đủ, giới hạn/rate limit shared link, migration cutover/cleanup có vận hành thực tế, candidate “My CV list”/apply flow hoàn chỉnh trên frontend, và xác minh E2E sau thay đổi export.

Ký hiệu:

- ✅ Hoàn thành trong code hiện tại.
- 🟡 Hoàn thành một phần hoặc cần điều kiện vận hành/deployment.
- ⬜ Chưa triển khai theo kế hoạch.

## Đối chiếu Phase 1 — Core MVP, bảo mật và quản trị

| Hạng mục kế hoạch | Trạng thái | Những gì đã có | Khoảng trống / ghi chú |
| --- | --- | --- | --- |
| Template taxonomy normalized | ✅ | `CvCategory` có type (`style`, `feature`, `position`, `audience`), localization và liên kết nhiều-nhiều với template. | `category` legacy trên `CvTemplate` vẫn giữ cho giai đoạn chuyển đổi. |
| Template version immutable | ✅ | `CvTemplateVersion`, renderer key/version, default layout/style, capabilities; published version không cho sửa config. | Cần Admin workflow để quản trị version trong UI. |
| Section Registry + Renderer Contract | ✅ | Registry backend/frontend, validation schema canonical, renderer `classic_single_column_v1` và `classic_two_column_v1`. | Thêm renderer mới cần code release và test parity backend/frontend. |
| Public template catalog | ✅ | List/card gọn, detail, related, filter locale/category/tag, ETag và Cache-Control. | “Tag” hiện được biểu diễn bằng typed category (đặc biệt type `feature`), không có bảng tag độc lập. |
| Create CV từ template/nội dung mẫu/trắng | ✅ | Chỉ Candidate email đã verify; ghim published template version, tạo `CvVersion` initial và `CvDraft`. | Chưa có source tạo CV từ Candidate Profile tự động. |
| Canonical `content_json` / `layout_json` / `style_json` | ✅ | Schema validation, stable section/item ID, A4 layout, style validation; template switch không đổi content. | Chưa có versioned schema migration cho canonical schema v2+ vì hiện mới schema v1. |
| Draft optimistic locking + autosave | ✅ | `CvDraft.lock_version`, `If-Match`, HTTP 409, debounce/retry/restore draft và cảnh báo rời trang trên Builder. | Chưa có collaboration real-time hay merge UI giữa hai tab. |
| Save/publish immutable version | ✅ | Save/publish tạo `CvVersion` bất biến; autosave chỉ cập nhật draft; validation chạy trước save/publish. | Chưa có UI version history đầy đủ hoặc restore một historical version. |
| Builder MVP + advanced layout | ✅ | Form section, add/delete/enable/title, nhiều item, Move Up/Down, drag/drop section/item, cross-region, column resize theo capability, Undo/Redo, theme/font và đổi template giữ content. | Chưa có resize cột nâng cao, custom section editor phong phú hay thao tác accessibility drag/drop hoàn chỉnh ngoài keyboard/move controls. |
| Private owner view | ✅ | `/cvs/{public_id}/view` dùng `CvVersion` published/latest; dùng chung renderer contract và audit access. | Chỉ xem version mặc định, chưa có trang lịch sử version độc lập để preview/restore. |
| Secure shared link | 🟡 | Token ngẫu nhiên, DB chỉ lưu SHA-256 hash, expiry/revoke, invalid/revoked/expired trả 404, audit metadata hash IP/UA. | Chưa có rate limit riêng, `max_views`/`view_count`, hoặc policy rõ cho archived/banned CV ngoài `is_deleted`. |
| Application snapshot + recruiter authorization | ✅ | `submitted_cv_version` PROTECT; apply tạo snapshot trong transaction; recruiter endpoint chỉ trả snapshot theo application/job/company membership và không trả mutable CV. | Cần kiểm thử/đánh giá thêm với các biến thể company membership production phức tạp. |
| PDF export từ immutable version | ✅ | `CvExport` job trạng thái pending/processing/completed/failed, dedupe theo version + render config, worker HTML/CSS A4 bằng WeasyPrint, internal storage key, owner-only controlled download, retry/audit. | Production cần object storage thật, worker queue `cv-export`, Celery Beat và quan sát failure. E2E export chưa chạy được trong môi trường Codex hiện tại. |
| Admin template/CV management | ⬜ | Model và guard/metadata nền tảng đã có; Admin portal chung tồn tại. | Chưa có structured Template CRUD/publish preview, CV metadata list, sensitive-content permission/audit, revoke/retry export dashboard. Đây là gap lớn nhất của Phase 1. |
| Candidate My CV list + apply UI | 🟡 | Candidate V2 list/create API và application snapshot backend có sẵn; catalog/create/builder/view/export UI có sẵn. | Chưa thấy trang “My CV list” hoàn chỉnh hoặc flow chọn CV để apply được hoàn thiện trên frontend mới. |
| Archive/restore/duplicate | 🟡 | Legacy archive/soft-delete service tồn tại. | V2 chưa có archive/restore/duplicate API/UI hoàn chỉnh. |
| Sensitive access audit | 🟡 | Owner view, shared link và export ghi `CvAccessLog`, không ghi raw token/CV JSON. | Recruiter/admin access audit chưa được gắn đầy đủ vào endpoint quản trị vì admin workflow chưa có. |
| Authorization/IDOR tests | ✅ | Có tests owner, recruiter/company member, foreign candidate, shared token expiry/revoke, export/download/retry. | E2E full smoke có test route nhưng lượt mới nhất không chạy được do môi trường không cho bind Vite localhost. |

## Database và migration theo Expand → Backfill → Switch → Contract

| Bước kế hoạch | Trạng thái | Thực tế hiện tại |
| --- | --- | --- |
| Expand | ✅ | Migration additive cho template/canonical CV foundation, application snapshot, shared link/audit và export. Không xóa legacy field. |
| Backfill | ✅ | Migration foundation backfill version/draft từ CV cũ; migration application backfill immutable snapshot. |
| Switch / dual-write | 🟡 | V2 là canonical writer; legacy `cv_data`/`style_config` vẫn dual-write để tương thích API cũ. |
| Contract / cleanup | ⬜ | Chưa có kế hoạch vận hành được thực thi để đo dual-read mismatch, chuyển toàn bộ consumer, remove API/field legacy và cleanup sau thời gian rollback. |
| Inventory/backup trước migration | ⬜ | Không thấy runbook/command backup, dry-run metrics hoặc dashboard rollback trong repository. |

## API V2 đang có

- Template catalog: list/detail/related/category/sample-content public.
- Candidate CV: create/list/detail, draft GET/PUT, template switch, save-version, publish, list/detail immutable version.
- Private/share: owner view, create/list/revoke shared link, public token view.
- Export: create/list job, job detail, retry failed job, controlled download.
- Recruiter: read-only application snapshot qua `application_public_id`, không có endpoint recruiter đọc `CvDraft` hoặc mutable CV.

API legacy vẫn được giữ để chuyển đổi dần; frontend mới đi qua API V2 cho các luồng CV mới.

## Đối chiếu Phase 2 — Builder nâng cao

| Hạng mục | Trạng thái | Ghi chú |
| --- | --- | --- |
| Drag/drop section và giữa region | ✅ | Capability-driven, giữ Move Up/Down. |
| Drag/drop item | ✅ | Áp dụng experience, education, skills, projects, certifications; layout order giữ riêng content. |
| Multi-region + resize cột | ✅ | Tuân theo template capabilities/min-max. |
| Theme/font và preview A4 | ✅ | Renderer contract, A4 page separation/overflow warning, print CSS. |
| Undo/Redo | ✅ | Command history frontend; autosave không ghi history. |
| Đổi template giữ content | ✅ | Chỉ đổi template/layout/style; content giữ nguyên. |
| Version history restore | ⬜ | Có list version để chọn export nhưng chưa có restore historical version thành draft. |
| Import PDF/DOCX pipeline | ⬜ | Có legacy upload file, chưa có import job/parser/canonicalization pipeline. |
| Thumbnail worker | ⬜ | Chưa có worker/generation lifecycle. |
| Performance test CV lớn | ⬜ | Chưa thấy benchmark/load test chuyên biệt. |

## Đối chiếu Phase 3 — AI, matching và scale

Tất cả hạng mục dưới đây **chưa triển khai theo scope kế hoạch**:

- ⬜ `cv_ai_runs`, `cv_ai_suggestions`, `cv_ai_usage`.
- ⬜ Consent enforcement cho AI CV Writer.
- ⬜ JD hash, prompt/model/version/cost audit.
- ⬜ Candidate accept/reject suggestion.
- ⬜ ATS quality check, matching/search projection, pgvector/embedding strategy.
- ⬜ Quota/rate limit AI, cost/safety monitoring.

Đây là đúng với phạm vi đã chốt trong các lượt triển khai gần đây: chưa phát triển AI, import pipeline hoặc thumbnail worker.

## Kiểm thử và môi trường đã xác minh

- Backend full suite: **140 tests pass**.
- CV V2 targeted suite: **20 tests pass**.
- Migration check: pass, không có model change chưa có migration.
- Frontend: lint, architecture check, coverage (**116 tests pass**) và production build đều pass.
- E2E smoke: chưa xác minh lại ở lượt PDF export cuối vì môi trường Codex chặn bind Vite tại `127.0.0.1:5173`; không phải assertion failure của ứng dụng.
- `backend/venv` đã được đồng bộ requirements; WeasyPrint A4 smoke render thành công sau khi cài runtime Pango/GDK-PixBuf/libffi trên máy local.

## Ưu tiên khuyến nghị trước khi tuyên bố hoàn tất Phase 1

1. Xây Admin CV/template workflow: metadata list, publish template version, quyền xem PII riêng, audit, revoke shared link và retry export.
2. Hoàn thiện shared-link policy: rate limit, max views/view count atomic, archive/banned policy và monitoring abuse.
3. Hoàn thiện migration cutover: inventory/backup runbook, dual-read metrics, rollout/rollback, deprecate rồi contract legacy API/columns.
4. Hoàn thiện candidate workflow: My CV list, archive/restore/duplicate V2 và chọn CV trong apply UI.
5. Chạy lại E2E smoke trên môi trường cho phép Vite bind local; thêm browser E2E download PDF completed artifact.
6. Cấu hình production cho `cv-export`: object storage private, signed/controlled download policy, Celery worker/Beat, alert cho failed/pending quá lâu và retention cleanup artifact.

## File bằng chứng chính

- `backend/apps/cvs/models.py`, `services/versions.py`, `services/lifecycle.py`, `services/sharing.py`, `services/exports.py`, `tasks.py`.
- `backend/apps/cv_templates/models.py`, `renderers.py`, `section_registry.py`, `api_v2_views.py`.
- `backend/apps/applications/services/applications.py`, `selectors/applications.py`, `api_v2_views.py`.
- `frontend/src/features/edit-cv-draft/`, `features/view-cv-version/`, `features/export-cv-pdf/`, `entities/cv/`.
- `backend/apps/cvs/tests_v2.py`, `backend/apps/applications/tests_v2.py`, `frontend/tests/e2e/smoke/`.
