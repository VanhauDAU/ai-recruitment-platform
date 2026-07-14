# Kế hoạch phát triển & kiến trúc Database Production cho CV Builder

**Dự án:** `VanhauDAU/ai-recruitment-platform`  
**Stack hiện tại:** ReactJS, Django REST Framework, PostgreSQL  
**Vai trò phân tích:** Senior Solutions Architect & Technical Product Manager (HRTech)  
**Phạm vi:** Candidate CV Builder, kho template công khai, private CV view, Admin quản trị, Recruiter xem CV qua hồ sơ ứng tuyển, PDF export và nền tảng cho AI CV Writer.

---

## 0. Executive Summary — Quyết định kiến trúc cần chốt

### 0.1. Kết luận chính

1. **Không xây lại từ đầu.** Repository hiện đã có:
   - `accounts.User`;
   - `candidates.CandidateProfile`;
   - `employers.Company`;
   - `jobs.Job`, `jobs.JobCategory`;
   - `applications.Application`;
   - `cv_templates.CvTemplate`;
   - `cvs.UserCv`, `cvs.CvSkill`.

2. Schema CV hiện tại là nền móng tốt nhưng **chưa đủ production**:
   - `CvTemplate.category` đang là chuỗi tự do;
   - layout/style template chưa có version bất biến;
   - `UserCv.status` đang trộn trạng thái vòng đời với trạng thái xử lý file/AI;
   - chưa có version/snapshot CV;
   - chưa có shared-link bảo mật;
   - `Application` chỉ trỏ trực tiếp vào CV đang sửa;
   - chưa có audit log truy cập dữ liệu nhạy cảm;
   - chưa có cấu trúc AI run/suggestion có thể kiểm toán.

3. Chọn mô hình **Hybrid**:
   - Relational cho ownership, authorization, lifecycle, template taxonomy, version, application, sharing, export, audit và AI jobs.
   - PostgreSQL `JSONB` cho `content_json`, `layout_json`, `style_json`.
   - Giữ các projection quan trọng để query/search như `cv_skills`, `raw_text`, `normalized_text`, hoặc bảng search document.

4. Chọn mô hình **Immutable Versioning**:
   - `user_cvs` là aggregate/root và metadata hiện hành.
   - `cv_versions` là các bản lưu bất biến.
   - `applications.submitted_cv_version_id` trỏ tới version tại thời điểm ứng tuyển.
   - Ứng viên sửa CV sau đó không làm thay đổi hồ sơ nhà tuyển dụng đã nhận.

5. Template cũng cần version:
   - `cv_templates` giữ identity, slug, trạng thái kinh doanh.
   - `cv_template_versions` giữ layout/style/capability/schema ở từng phiên bản.
   - CV đã tạo với template version cũ vẫn render ổn khi Admin cập nhật template.

6. URL private không được dùng ID tuần tự. Shared URL sử dụng token ngẫu nhiên mạnh; database chỉ lưu `token_hash`, không lưu token thô.

### 0.2. Kiến trúc mục tiêu

```text
Candidate
   │
   ├── user_cvs                         Metadata CV
   │      ├── cv_drafts                 Autosave tạm thời
   │      ├── cv_versions               Bản lưu bất biến
   │      ├── cv_exports                PDF đã render
   │      ├── cv_shared_links           Link chia sẻ có hạn
   │      └── cv_ai_runs                Lịch sử AI gợi ý
   │
   └── applications
          └── submitted_cv_version_id   Snapshot bất biến khi ứng tuyển

cv_templates
   ├── cv_template_versions             Layout/style versioned
   ├── cv_template_localizations        Tên/mô tả theo ngôn ngữ
   ├── cv_template_category_links       ATS, Simple, Professional...
   ├── cv_template_assets               Thumbnail/background/font metadata
   └── cv_template_sections             Cấu hình section theo version
```

---

# 1. Phân tích thực trạng: Existing vs New

## 1.1. Những bảng/model hiện đã có trong repository

### 1.1.1. `accounts.User`

Hiện có các vai trò:

- `candidate`;
- `employer`;
- `admin`.

Các field liên quan trực tiếp tới CV Builder:

- `public_id`;
- `email`;
- `full_name`;
- `phone`;
- `avatar_url`;
- `role`;
- `status`;
- `email_verified`;
- `is_deleted`.

**Cách liên kết CV Builder**

- Một Candidate có nhiều `user_cvs`.
- `email_verified` phải được kiểm tra tại backend trước khi tạo/publish/share CV.
- Employer không được truy cập CV bằng endpoint Candidate.
- Admin dùng endpoint riêng có audit log, không dùng chung endpoint Candidate.

### 1.1.2. `candidates.CandidateProfile`

Hiện chứa dữ liệu hồ sơ và nhu cầu việc làm:

- địa chỉ;
- vị trí hiện tại/mong muốn;
- năm kinh nghiệm;
- học vấn;
- portfolio/GitHub/LinkedIn;
- headline;
- bio;
- career objective;
- consent AI và visibility.

**Cách liên kết CV Builder**

- Chỉ dùng làm **nguồn khởi tạo** hoặc gợi ý điền CV.
- Không đồng bộ hai chiều tự động sau mỗi lần sửa.
- Khi tạo CV, backend có thể copy dữ liệu profile sang `content_json`.
- CV là tài liệu độc lập; Candidate Profile là hồ sơ nền tảng.
- Consent AI phải được kiểm tra trước khi đưa dữ liệu CV vào AI recommendation/writer.

### 1.1.3. `jobs.JobCategory`, `jobs.Job`

Các thành phần có thể tái sử dụng:

- `JobCategory` có taxonomy nghề nghiệp;
- `Job.description`, `requirements`, `benefits`;
- `position_level`, `experience_years`, `education_level`;
- `posted_by`, `company`.

**Cách liên kết CV Builder**

- Dùng `JobCategory` làm nguồn cho “vị trí ứng tuyển” và nội dung mẫu.
- AI CV Writer nhận `job_id`, snapshot JD và hash JD.
- Không nên tạo thêm một bảng `job_positions` trùng dữ liệu nếu `JobCategory` đã đáp ứng.
- Có thể thêm alias/taxonomy map nếu cần phân biệt “ngành nghề” và “chức danh CV”.

### 1.1.4. `employers.Company`

Job thuộc công ty; một recruiter đăng job thông qua `posted_by`.

**Điểm cần kiểm tra/mở rộng**

Để nhiều HR trong cùng công ty cùng xem application, cần một quan hệ membership rõ ràng, ví dụ:

```text
company_members
- company_id
- user_id
- role: owner/admin/recruiter/viewer
- status
```

Nếu repository đã có module tương đương ở nhánh khác thì tái sử dụng; nếu chưa có, đây là dependency quan trọng cho Recruiter Authorization.

### 1.1.5. `applications.Application`

Hiện có:

- `candidate`;
- `job`;
- `cv`;
- trạng thái xử lý tuyển dụng;
- note và timestamp.

**Rủi ro hiện tại**

`Application.cv` trỏ thẳng tới `UserCv`. Nếu ứng viên chỉnh sửa `UserCv.cv_data`, recruiter có thể nhìn thấy nội dung mới thay vì nội dung tại thời điểm nộp.

**Thay đổi bắt buộc**

Thêm:

```text
submitted_cv_version_id
submitted_cv_title
submitted_cv_source
submitted_at
```

`submitted_cv_version_id` phải trỏ tới `cv_versions` bất biến và `ON DELETE RESTRICT/PROTECT`.

### 1.1.6. `cv_templates.CvTemplate`

Hiện có:

- `public_id`;
- `name`, `slug`;
- `category` dạng chuỗi;
- `layout_config`, `style_config` JSON;
- thumbnail/preview;
- premium/status/sort/usage_count.

**Điểm tốt**

- Đã tách template khỏi dữ liệu người dùng.
- Đã có slug/public ID.
- Đã dùng JSON cho cấu hình layout/style.

**Điểm chưa đủ**

- `category` là text tự do, khó filter và dễ sai chính tả.
- Chưa hỗ trợ nhiều category/tag.
- Chưa có localization.
- Chưa có template version.
- Chưa có section registry/capability.
- `usage_count` cập nhật trực tiếp dễ race condition.
- Layout thay đổi có thể làm CV cũ render khác hoặc lỗi.

### 1.1.7. `cvs.UserCv`

Hiện có:

- owner `user`;
- `template`;
- `cv_type`, `source`;
- `cv_data`, `style_config`;
- uploaded file/PDF/thumbnail;
- raw/normalized text;
- current version dạng số;
- status;
- default/archive metadata.

**Điểm tốt**

- Hỗ trợ Builder và Uploaded CV.
- Có `JSONField`.
- Có public ID và soft delete.
- Có `CvSkill` để query kỹ năng.

**Điểm cần sửa**

- Thiếu `layout_json` riêng.
- Thiếu `language`.
- Thiếu `lifecycle_status`.
- `status` đang trộn `draft/uploaded/processing/analyzed/failed`.
- `current_version` không có bảng version tương ứng.
- Chưa có optimistic locking.
- Chưa có publish/archive timestamp.
- Chưa có visibility policy.
- Chưa có draft/autosave riêng.
- Chưa có link chia sẻ, access grant, access log.
- Chưa có immutable version cho application.

---

## 1.2. Bảng bắt buộc phải bổ sung

### Nhóm A — Template Catalog

| Bảng | Bắt buộc | Mục đích |
|---|---:|---|
| `cv_categories` | Có | Phân loại `style`, `feature`, `position`, `audience` |
| `cv_template_category_links` | Có | Một template có nhiều tag/category |
| `cv_template_localizations` | Có nếu đa ngôn ngữ | Tên, mô tả, SEO metadata theo ngôn ngữ |
| `cv_template_versions` | Có | Version bất biến của layout/style/schema |
| `cv_template_assets` | Nên có | Thumbnail, preview, background, icon, font metadata |
| `cv_section_definitions` | Có | Registry section: experience, education, skill... |
| `cv_template_sections` | Có | Cấu hình section theo template version |
| `cv_sample_contents` | Có | Nội dung mẫu theo ngôn ngữ/vị trí/cấp độ |

### Nhóm B — Candidate CV Lifecycle

| Bảng | Bắt buộc | Mục đích |
|---|---:|---|
| `user_cvs` | Đã có, cần mở rộng | Aggregate/root của CV |
| `cv_versions` | Có | Bản lưu/publish/snapshot bất biến |
| `cv_drafts` | Có | Autosave mutable, một draft hiện hành/CV |
| `cv_exports` | Nên có | Theo dõi PDF export, trạng thái, file, hash |
| `cv_shared_links` | Có | Link chia sẻ có expiry/revoke |
| `cv_access_logs` | Nên có | Audit owner/recruiter/admin/shared-link access |
| `cv_search_documents` | Nên có ở scale | Text/projection để search, AI, matching |

### Nhóm C — Application & Recruiter Access

| Bảng/field | Bắt buộc | Mục đích |
|---|---:|---|
| `applications.submitted_cv_version_id` | Có | Khóa phiên bản CV tại thời điểm apply |
| `company_members` | Có nếu chưa có | Xác định recruiter thuộc company nào |
| `cv_access_grants` | Tùy chọn | Quyền xem ngoài application hoặc chia sẻ trực tiếp |

### Nhóm D — AI & Governance

| Bảng | Giai đoạn | Mục đích |
|---|---:|---|
| `cv_ai_runs` | Phase 2/3 | Lưu model, prompt version, JD hash, trạng thái |
| `cv_ai_suggestions` | Phase 2/3 | Suggestion theo field/section, accept/reject |
| `cv_ai_usage` | Phase 3 | Quota, token/cost, billing/abuse control |
| `cv_change_events` | Phase 3 | Audit lịch sử thay đổi nếu cần compliance |

---

# 2. Quyết định lưu trữ: Relational hay JSON?

## 2.1. Không nên hoàn toàn Relational

Ví dụ tách:

- `cv_experiences`;
- `cv_educations`;
- `cv_projects`;
- `cv_certificates`;
- `cv_skills`;
- `cv_custom_sections`;
- `cv_section_blocks`;
- `cv_rich_text_fragments`.

Cách này ban đầu nhìn “chuẩn hóa” nhưng gây:

- quá nhiều join khi render;
- khó kéo thả section;
- khó hỗ trợ custom section;
- khó đổi cấu trúc item theo từng template;
- API payload bị phân mảnh;
- save nhiều table trong một lần autosave;
- migration liên tục khi UI thêm field mới;
- undo/redo và versioning phức tạp.

## 2.2. Không nên hoàn toàn JSON

Chỉ có một bảng chứa toàn bộ dữ liệu cũng gây:

- khó quản lý ownership và quyền;
- khó query danh sách CV;
- khó lọc status/language/template;
- khó audit version;
- khó revoke shared link;
- khó liên kết application;
- khó theo dõi AI/export;
- JSON quá lớn nếu nhét cả file/render history.

## 2.3. Phương án chốt: Hybrid

### Relational

Lưu các dữ liệu cần:

- FK;
- uniqueness;
- transaction;
- lifecycle;
- authorization;
- filter/sort;
- audit;
- analytics;
- trạng thái xử lý;
- liên kết business domain.

### JSONB

Lưu các dữ liệu có cấu trúc linh hoạt:

- `content_json`;
- `layout_json`;
- `style_json`;
- template render schema;
- section config;
- capability flags;
- AI input/output có giới hạn.

### Projection/search

Các field cần query thường xuyên được chiết xuất:

- `cv_skills`;
- `normalized_text`;
- `headline`;
- `latest_position`;
- `total_experience_months`;
- `education_level`;
- language/locale;
- search vector.

## 2.4. Canonical `content_json`

Không lưu theo template. Mọi template dùng chung contract dữ liệu.

```json
{
  "schema_version": 1,
  "locale": "vi-VN",
  "personal_info": {
    "full_name": "Nguyễn Văn A",
    "headline": "Front-end Developer",
    "email": "candidate@example.com",
    "phone": "0900000000",
    "address": "Đà Nẵng",
    "avatar_asset_id": null,
    "links": [
      {"type": "linkedin", "url": "https://linkedin.com/in/example"},
      {"type": "github", "url": "https://github.com/example"}
    ]
  },
  "sections": [
    {
      "instance_id": "sec_exp_01",
      "section_key": "experience",
      "title": "Kinh nghiệm làm việc",
      "enabled": true,
      "items": [
        {
          "item_id": "exp_01",
          "company": "ABC Tech",
          "position": "Front-end Developer",
          "start_date": "2025-01",
          "end_date": null,
          "is_current": true,
          "description": {
            "format": "rich_text_v1",
            "content": [
              {"type": "bullet", "text": "Phát triển giao diện React."}
            ]
          }
        }
      ]
    },
    {
      "instance_id": "sec_skill_01",
      "section_key": "skills",
      "title": "Kỹ năng",
      "enabled": true,
      "items": [
        {"item_id": "skill_01", "name": "React", "level": "advanced"}
      ]
    }
  ],
  "custom_fields": {}
}
```

### Quy tắc bắt buộc

- Mỗi section instance có `instance_id` ổn định.
- Mỗi item có `item_id` ổn định.
- Không dùng array index làm ID khi drag/drop.
- Rich text dùng schema an toàn; không lưu HTML tùy ý từ client.
- Nội dung không chứa CSS, component name hoặc logic render.
- Template không chứa PII của user.
- Mọi JSON có `schema_version`.
- Backend validate JSON bằng JSON Schema/Pydantic/DRF validator trước khi lưu.

## 2.5. `layout_json`

```json
{
  "schema_version": 1,
  "page": {"size": "A4", "margin_mm": 12},
  "regions": [
    {
      "id": "main",
      "width_percent": 68,
      "section_instance_ids": ["sec_exp_01", "sec_project_01"]
    },
    {
      "id": "sidebar",
      "width_percent": 32,
      "section_instance_ids": ["sec_skill_01", "sec_education_01"]
    }
  ]
}
```

## 2.6. `style_json`

```json
{
  "schema_version": 1,
  "theme_color": "#00A66A",
  "font_family": "Roboto",
  "font_scale": 1.0,
  "line_height": 1.4,
  "background_asset_id": null,
  "section_overrides": {}
}
```

---

# 3. Phased Roadmap

## Phase 1 — Core MVP, bảo mật và quản trị được

### Mục tiêu

Cho phép ứng viên:

1. xem kho template;
2. xem chi tiết template;
3. tạo CV từ form/nội dung mẫu/tạo trắng;
4. sửa nội dung cơ bản;
5. lưu CV;
6. publish;
7. xem private;
8. xuất PDF;
9. dùng CV để ứng tuyển;
10. quản lý danh sách CV.

Cho phép Admin:

1. quản lý template;
2. quản lý category/tag;
3. bật/tắt template;
4. xem danh sách CV metadata;
5. khóa/ẩn CV vi phạm;
6. kiểm tra export/error;
7. audit truy cập admin.

Cho phép Recruiter:

1. chỉ xem snapshot CV của application thuộc job/công ty có quyền;
2. không xem CV private khác;
3. không thấy bản ứng viên sửa sau thời điểm apply.

### Database trong Phase 1

Bắt buộc triển khai:

- `cv_categories`;
- `cv_template_category_links`;
- `cv_template_versions`;
- `cv_template_localizations`;
- `cv_section_definitions`;
- `cv_template_sections`;
- `cv_sample_contents`;
- mở rộng `user_cvs`;
- `cv_versions`;
- `cv_drafts`;
- `cv_shared_links`;
- `cv_exports`;
- `cv_access_logs`;
- `applications.submitted_cv_version_id`.

### Backend Epic

#### Epic 1 — Template Catalog

- Public list API.
- Filter language/category.
- Detail by slug.
- Related templates.
- Chỉ trả version active/published.
- ETag/cache-control cho metadata public.

#### Epic 2 — Create CV

- Check authenticated.
- Check candidate role.
- Check active user.
- Check email verified.
- Check template version is published.
- Tạo `user_cvs`.
- Tạo version 1 hoặc draft ban đầu.
- Trả `public_id`.

#### Epic 3 — CV Editor API

- Read owner CV.
- Update draft với optimistic locking.
- Save draft thành immutable version.
- Publish version.
- Archive/restore.
- Duplicate CV.

#### Epic 4 — Private View & Share

- Owner view bằng auth.
- Shared token view có expiry/revoke.
- Không lộ sequential ID.
- Rate limit shared links.
- Log access.

#### Epic 5 — PDF Export

- Tạo export job.
- Worker render HTML/CSS.
- Lưu object storage key.
- Không lưu binary PDF trong PostgreSQL.
- Export gắn với `cv_version_id`.
- Không render từ mutable draft.

#### Epic 6 — Application Snapshot

Trong transaction:

1. lock CV;
2. validate candidate ownership;
3. tạo immutable `cv_version` loại `application_snapshot`;
4. tạo/update application;
5. gán `submitted_cv_version_id`;
6. commit.

#### Epic 7 — Admin

- Template CRUD qua structured form.
- Không cho Admin paste React/JavaScript.
- Preview trước khi publish template version.
- CV list chỉ hiển thị metadata mặc định.
- Xem nội dung CV phải có permission riêng và audit.

### Frontend MVP

- Template list.
- Template detail.
- Create-source modal.
- Builder form/inline editing cơ bản.
- Autosave.
- Save/publish.
- Preview.
- My CV list.
- Private view.
- Export PDF.
- Apply with selected CV.

### Tiêu chí hoàn thành Phase 1

- Không có API nào lấy CV theo ID mà thiếu owner/recruiter permission.
- CV đã apply không đổi khi CV gốc bị chỉnh sửa.
- Link bị revoke trả 404/410.
- Template version mới không phá CV cũ.
- Autosave không ghi đè phiên bản mới hơn.
- PDF luôn render từ version bất biến.
- Có test authorization và IDOR.
- Có test transaction apply + snapshot.

---

## Phase 2 — Builder nâng cao

### Mục tiêu

- Drag & Drop section.
- Move giữa region/column.
- Resize cột.
- Đổi template vẫn giữ content.
- Đổi font/color/spacing real-time.
- Undo/Redo.
- Custom section.
- Restore draft.
- Version history.
- Import PDF/DOCX có pipeline.
- Thumbnail generation.

### Database dùng lại từ Phase 1

Không cần sửa schema lõi nếu Phase 1 làm đúng:

- `content_json` giữ content;
- `layout_json` giữ thứ tự/vùng;
- `style_json` giữ font/màu;
- `cv_versions` giữ history;
- `cv_template_versions` giữ render contract.

### Bổ sung có thể cần

- `cv_assets` cho avatar/hình nền do user upload.
- `cv_import_jobs`.
- `cv_change_events` nếu cần detailed history.
- `cv_collaboration_sessions` chỉ khi có real-time collaboration.

### Technical Notes

- Undo/Redo chủ yếu ở frontend state; không tạo DB version cho từng thao tác.
- Autosave debounce 2–5 giây.
- Mỗi draft có `lock_version`; update dùng compare-and-swap.
- Chỉ tạo immutable version khi user Save/Publish/Apply/Export.
- Drag/drop chỉ sửa `layout_json`.
- Đổi template không sửa `content_json`.

---

## Phase 3 — AI CV Writer, matching và scale

### Mục tiêu

- AI gợi ý theo Job Description.
- Rewrite bullet.
- Suggest missing skills.
- ATS quality check.
- Candidate chấp nhận/từ chối từng suggestion.
- Theo dõi prompt/model/version/cost.
- Re-index CV cho matching.
- Quota/rate limit.

### Database bổ sung

- `cv_ai_runs`;
- `cv_ai_suggestions`;
- `cv_ai_usage`;
- `cv_search_documents`;
- có thể dùng `pgvector` cho embeddings nhưng không phải MVP.

### Nguyên tắc AI

- Không cho AI ghi trực tiếp vào CV.
- AI trả suggestion; Candidate phải accept.
- Lưu `job_id`, `job_description_hash`, `model_name`, `prompt_version`.
- Không gửi dữ liệu khi Candidate chưa consent.
- Redact hoặc tối thiểu hóa PII nếu use-case không cần.
- Không dùng output AI làm ground truth.
- Log lỗi nhưng không log toàn bộ PII vào application log.

---

# 4. Schema Database Production — PostgreSQL

## 4.1. Quy ước

- Dùng `BIGINT GENERATED BY DEFAULT AS IDENTITY` cho PK nội bộ.
- Dùng `public_id VARCHAR(...)` cho URL/API.
- Dùng UTC `TIMESTAMPTZ`.
- Dùng `JSONB`.
- Dùng object storage key, không lưu file binary trong DB.
- Dùng soft delete cho CV; không soft delete version snapshot.
- Dùng `CHECK` thay vì PostgreSQL enum nếu muốn Django migration linh hoạt.
- Tất cả bảng có index theo query thực tế, không index mọi cột JSON.

## 4.2. SQL mẫu

> SQL hoàn chỉnh được xuất kèm trong file `cv_builder_schema_postgresql.sql`.

### `cv_categories`

```sql
CREATE TABLE cv_categories (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    public_id VARCHAR(50) NOT NULL UNIQUE,
    category_type VARCHAR(30) NOT NULL,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(140) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_cv_categories_type
        CHECK (category_type IN ('style', 'feature', 'position', 'audience')),
    CONSTRAINT uq_cv_categories_type_slug UNIQUE (category_type, slug)
);
```

### `cv_templates`

Nên migration từ model hiện tại, giữ identity và business metadata:

```sql
ALTER TABLE cv_templates
    ADD COLUMN lifecycle_status VARCHAR(20) NOT NULL DEFAULT 'draft',
    ADD COLUMN current_published_version_id BIGINT NULL,
    ADD COLUMN archived_at TIMESTAMPTZ NULL;

ALTER TABLE cv_templates
    ADD CONSTRAINT chk_cv_templates_lifecycle
    CHECK (lifecycle_status IN ('draft', 'published', 'archived'));
```

### `cv_template_versions`

```sql
CREATE TABLE cv_template_versions (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    template_id BIGINT NOT NULL REFERENCES cv_templates(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    version_status VARCHAR(20) NOT NULL DEFAULT 'draft',
    renderer_key VARCHAR(100) NOT NULL,
    renderer_version VARCHAR(50) NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    layout_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    style_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    default_layout_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    default_style_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
    content_contract JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ NULL,
    retired_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cv_template_version UNIQUE (template_id, version_number),
    CONSTRAINT chk_cv_template_version_status
        CHECK (version_status IN ('draft', 'published', 'retired')),
    CONSTRAINT chk_cv_template_version_number CHECK (version_number > 0)
);
```

**Lý do có `renderer_key`**

Database không lưu React component. Backend/frontend map:

```text
renderer_key = "classic_two_column_v1"
```

sang component đã được code review và deploy. Admin chỉ cấu hình dữ liệu an toàn.

### `cv_template_localizations`

```sql
CREATE TABLE cv_template_localizations (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    template_id BIGINT NOT NULL REFERENCES cv_templates(id) ON DELETE CASCADE,
    locale VARCHAR(16) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    seo_title VARCHAR(255) NOT NULL DEFAULT '',
    seo_description TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_cv_template_locale UNIQUE (template_id, locale)
);
```

### `cv_template_category_links`

```sql
CREATE TABLE cv_template_category_links (
    template_id BIGINT NOT NULL REFERENCES cv_templates(id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL REFERENCES cv_categories(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (template_id, category_id)
);
```

### `cv_section_definitions`

```sql
CREATE TABLE cv_section_definitions (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    section_key VARCHAR(80) NOT NULL UNIQUE,
    display_name VARCHAR(120) NOT NULL,
    data_schema JSONB NOT NULL,
    allow_multiple BOOLEAN NOT NULL DEFAULT FALSE,
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    schema_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `cv_template_sections`

```sql
CREATE TABLE cv_template_sections (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    template_version_id BIGINT NOT NULL
        REFERENCES cv_template_versions(id) ON DELETE CASCADE,
    section_definition_id BIGINT NOT NULL
        REFERENCES cv_section_definitions(id) ON DELETE RESTRICT,
    region_key VARCHAR(80) NOT NULL,
    default_order INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    is_default_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_draggable BOOLEAN NOT NULL DEFAULT TRUE,
    use_theme_color BOOLEAN NOT NULL DEFAULT TRUE,
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT uq_template_version_section
        UNIQUE (template_version_id, section_definition_id, region_key)
);
```

### `cv_sample_contents`

```sql
CREATE TABLE cv_sample_contents (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    job_category_id BIGINT NULL REFERENCES job_categories(id) ON DELETE SET NULL,
    locale VARCHAR(16) NOT NULL,
    experience_level VARCHAR(30) NOT NULL DEFAULT 'unspecified',
    title VARCHAR(255) NOT NULL,
    content_json JSONB NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_by_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_cv_sample_status CHECK (status IN ('draft', 'published', 'archived'))
);
```

### Mở rộng `user_cvs`

Mô hình logical đề xuất:

```sql
ALTER TABLE user_cvs
    ADD COLUMN language VARCHAR(16) NOT NULL DEFAULT 'vi-VN',
    ADD COLUMN lifecycle_status VARCHAR(20) NOT NULL DEFAULT 'draft',
    ADD COLUMN processing_status VARCHAR(20) NOT NULL DEFAULT 'idle',
    ADD COLUMN visibility VARCHAR(30) NOT NULL DEFAULT 'private',
    ADD COLUMN current_template_version_id BIGINT NULL,
    ADD COLUMN latest_version_id BIGINT NULL,
    ADD COLUMN published_version_id BIGINT NULL,
    ADD COLUMN lock_version INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN published_at TIMESTAMPTZ NULL,
    ADD COLUMN archived_at TIMESTAMPTZ NULL;

ALTER TABLE user_cvs
    ADD CONSTRAINT chk_user_cvs_lifecycle
    CHECK (lifecycle_status IN ('draft', 'published', 'archived')),
    ADD CONSTRAINT chk_user_cvs_processing
    CHECK (processing_status IN ('idle', 'queued', 'processing', 'analyzed', 'failed')),
    ADD CONSTRAINT chk_user_cvs_visibility
    CHECK (visibility IN ('private', 'application_only', 'shared_link'));
```

**Không nên dùng `published` đồng nghĩa với public.** Published chỉ có nghĩa là bản ổn định; visibility mặc định vẫn private.

### `cv_versions`

```sql
CREATE TABLE cv_versions (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    public_id VARCHAR(50) NOT NULL UNIQUE,
    cv_id BIGINT NOT NULL REFERENCES user_cvs(id) ON DELETE RESTRICT,
    version_number INTEGER NOT NULL,
    version_kind VARCHAR(30) NOT NULL DEFAULT 'manual_save',
    template_version_id BIGINT NULL
        REFERENCES cv_template_versions(id) ON DELETE RESTRICT,
    parent_version_id BIGINT NULL
        REFERENCES cv_versions(id) ON DELETE SET NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    content_json JSONB NOT NULL,
    layout_json JSONB NOT NULL,
    style_json JSONB NOT NULL,
    plain_text TEXT NOT NULL DEFAULT '',
    content_hash CHAR(64) NOT NULL,
    created_by_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cv_version_number UNIQUE (cv_id, version_number),
    CONSTRAINT chk_cv_version_number CHECK (version_number > 0),
    CONSTRAINT chk_cv_version_kind CHECK (
        version_kind IN (
            'initial',
            'manual_save',
            'published',
            'application_snapshot',
            'export_snapshot',
            'imported'
        )
    )
);
```

**Bất biến**

- Không expose UPDATE/DELETE API.
- Có thể chặn UPDATE/DELETE bằng DB trigger cho production.
- Mọi thay đổi tạo row version mới.

### `cv_drafts`

```sql
CREATE TABLE cv_drafts (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    cv_id BIGINT NOT NULL UNIQUE REFERENCES user_cvs(id) ON DELETE CASCADE,
    base_version_id BIGINT NULL REFERENCES cv_versions(id) ON DELETE SET NULL,
    content_json JSONB NOT NULL,
    layout_json JSONB NOT NULL,
    style_json JSONB NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    lock_version INTEGER NOT NULL DEFAULT 0,
    client_session_id VARCHAR(100) NOT NULL DEFAULT '',
    updated_by_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Update draft:

```sql
UPDATE cv_drafts
SET content_json = :content,
    layout_json = :layout,
    style_json = :style,
    lock_version = lock_version + 1,
    updated_at = NOW()
WHERE cv_id = :cv_id
  AND lock_version = :expected_lock_version;
```

Nếu affected row = 0, trả `409 Conflict`.

### `cv_shared_links`

```sql
CREATE TABLE cv_shared_links (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    public_id VARCHAR(50) NOT NULL UNIQUE,
    cv_id BIGINT NOT NULL REFERENCES user_cvs(id) ON DELETE CASCADE,
    cv_version_id BIGINT NOT NULL REFERENCES cv_versions(id) ON DELETE RESTRICT,
    token_hash CHAR(64) NOT NULL UNIQUE,
    permission_scope VARCHAR(30) NOT NULL DEFAULT 'view',
    expires_at TIMESTAMPTZ NULL,
    revoked_at TIMESTAMPTZ NULL,
    max_views INTEGER NULL,
    view_count INTEGER NOT NULL DEFAULT 0,
    allow_download BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ NULL,
    CONSTRAINT chk_cv_share_scope
        CHECK (permission_scope IN ('view', 'view_download')),
    CONSTRAINT chk_cv_share_max_views
        CHECK (max_views IS NULL OR max_views > 0)
);
```

Token flow:

1. Server tạo 32 random bytes.
2. URL chứa Base64URL token.
3. Database chỉ lưu SHA-256 hash.
4. Request hash token rồi query.
5. Check revoked/expired/max views.
6. Log access.
7. Không trả raw token lần thứ hai.

### `cv_exports`

```sql
CREATE TABLE cv_exports (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    public_id VARCHAR(50) NOT NULL UNIQUE,
    cv_id BIGINT NOT NULL REFERENCES user_cvs(id) ON DELETE RESTRICT,
    cv_version_id BIGINT NOT NULL REFERENCES cv_versions(id) ON DELETE RESTRICT,
    export_format VARCHAR(20) NOT NULL DEFAULT 'pdf',
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    storage_key TEXT NOT NULL DEFAULT '',
    file_size_bytes BIGINT NULL,
    checksum_sha256 CHAR(64) NOT NULL DEFAULT '',
    error_code VARCHAR(100) NOT NULL DEFAULT '',
    error_message TEXT NOT NULL DEFAULT '',
    requested_by_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    expires_at TIMESTAMPTZ NULL,
    CONSTRAINT chk_cv_export_format CHECK (export_format IN ('pdf')),
    CONSTRAINT chk_cv_export_status
        CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'expired'))
);
```

### `cv_access_logs`

```sql
CREATE TABLE cv_access_logs (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    cv_id BIGINT NOT NULL REFERENCES user_cvs(id) ON DELETE RESTRICT,
    cv_version_id BIGINT NULL REFERENCES cv_versions(id) ON DELETE RESTRICT,
    actor_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    actor_type VARCHAR(30) NOT NULL,
    access_channel VARCHAR(30) NOT NULL,
    application_id BIGINT NULL REFERENCES applications(id) ON DELETE SET NULL,
    shared_link_id BIGINT NULL REFERENCES cv_shared_links(id) ON DELETE SET NULL,
    ip_hash CHAR(64) NOT NULL DEFAULT '',
    user_agent_hash CHAR(64) NOT NULL DEFAULT '',
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_cv_access_actor
        CHECK (actor_type IN ('owner', 'recruiter', 'admin', 'anonymous')),
    CONSTRAINT chk_cv_access_channel
        CHECK (access_channel IN ('owner_view', 'application', 'admin', 'shared_link', 'export'))
);
```

### `cv_ai_runs`

```sql
CREATE TABLE cv_ai_runs (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    public_id VARCHAR(50) NOT NULL UNIQUE,
    cv_id BIGINT NOT NULL REFERENCES user_cvs(id) ON DELETE CASCADE,
    base_version_id BIGINT NULL REFERENCES cv_versions(id) ON DELETE SET NULL,
    job_id BIGINT NULL REFERENCES jobs(id) ON DELETE SET NULL,
    job_description_hash CHAR(64) NOT NULL DEFAULT '',
    run_type VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    provider VARCHAR(50) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    prompt_version VARCHAR(50) NOT NULL,
    input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_code VARCHAR(100) NOT NULL DEFAULT '',
    token_input INTEGER NULL,
    token_output INTEGER NULL,
    created_by_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL,
    CONSTRAINT chk_cv_ai_status
        CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled'))
);
```

### Application snapshot

```sql
ALTER TABLE applications
    ADD COLUMN submitted_cv_version_id BIGINT NULL
        REFERENCES cv_versions(id) ON DELETE RESTRICT,
    ADD COLUMN submitted_cv_title VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN submitted_cv_source VARCHAR(30) NOT NULL DEFAULT 'builder';
```

Sau backfill:

```sql
ALTER TABLE applications
    ALTER COLUMN submitted_cv_version_id SET NOT NULL;
```

## 4.3. Index đề xuất

```sql
CREATE INDEX idx_cv_templates_status_sort
    ON cv_templates (lifecycle_status, sort_order, id);

CREATE INDEX idx_cv_template_categories_category
    ON cv_template_category_links (category_id, template_id);

CREATE INDEX idx_cv_template_versions_published
    ON cv_template_versions (template_id, version_status, version_number DESC);

CREATE INDEX idx_user_cvs_owner_lifecycle_updated
    ON user_cvs (user_id, lifecycle_status, updated_at DESC)
    WHERE is_deleted = FALSE;

CREATE UNIQUE INDEX uq_user_cvs_default_per_owner
    ON user_cvs (user_id)
    WHERE is_default = TRUE AND is_deleted = FALSE;

CREATE INDEX idx_cv_versions_cv_created
    ON cv_versions (cv_id, version_number DESC);

CREATE INDEX idx_cv_versions_content_hash
    ON cv_versions (content_hash);

CREATE INDEX idx_cv_shared_links_active_expiry
    ON cv_shared_links (expires_at)
    WHERE revoked_at IS NULL;

CREATE INDEX idx_cv_exports_status_queued
    ON cv_exports (status, queued_at)
    WHERE status IN ('queued', 'processing');

CREATE INDEX idx_cv_access_logs_cv_time
    ON cv_access_logs (cv_id, accessed_at DESC);

CREATE INDEX idx_cv_access_logs_actor_time
    ON cv_access_logs (actor_user_id, accessed_at DESC);

CREATE INDEX idx_applications_submitted_cv_version
    ON applications (submitted_cv_version_id);
```

### JSONB index

Không tạo GIN index cho mọi JSON ngay từ đầu. Chỉ tạo khi có query thực tế.

Ví dụ nếu cần query section key:

```sql
CREATE INDEX idx_cv_versions_content_gin
    ON cv_versions USING GIN (content_json jsonb_path_ops);
```

Tuy nhiên search/matching quy mô lớn nên dùng projection/search document thay vì query sâu JSON cho mọi request.

---

# 5. Authorization & Data Privacy

## 5.1. Nguyên tắc

Quyền không chỉ dựa trên “URL khó đoán”. Mỗi request phải kiểm tra:

1. Authentication;
2. role;
3. ownership hoặc business relationship;
4. lifecycle;
5. version;
6. token validity;
7. audit.

## 5.2. Candidate

Candidate được phép:

- list CV của chính mình;
- read/update/archive CV của chính mình;
- read version của CV chính mình;
- create/revoke link của CV chính mình;
- export version của CV chính mình.

Query bắt buộc:

```python
UserCv.objects.filter(
    public_id=cv_public_id,
    user=request.user,
    is_deleted=False,
)
```

Không query object trước rồi mới kiểm tra owner ở code rời rạc.

## 5.3. Recruiter

Recruiter chỉ được xem khi:

- application tồn tại;
- application thuộc job;
- recruiter là `posted_by`, hoặc là active member của `job.company`;
- application trỏ tới `submitted_cv_version_id`;
- version đó đúng với application;
- không truy cập draft/latest version của Candidate.

Pseudo-query:

```sql
SELECT cvv.*
FROM applications a
JOIN jobs j ON j.id = a.job_id
JOIN cv_versions cvv ON cvv.id = a.submitted_cv_version_id
LEFT JOIN company_members cm
  ON cm.company_id = j.company_id
 AND cm.user_id = :request_user_id
 AND cm.status = 'active'
WHERE a.public_id = :application_public_id
  AND (
      j.posted_by_id = :request_user_id
      OR cm.id IS NOT NULL
  );
```

Recruiter endpoint nên dùng `application_public_id`, không dùng `cv_public_id`.

## 5.4. Admin

- Admin list metadata.
- Nội dung CV/PII cần permission riêng: `cv.view_sensitive_content`.
- Mọi lần xem nội dung phải ghi `cv_access_logs`.
- Giao diện list nên mask email/phone.
- Không cho staff database tùy ý đọc production nếu không cần.

## 5.5. Shared link

Allowed khi:

```text
hash(token) tồn tại
AND revoked_at IS NULL
AND (expires_at IS NULL OR expires_at > now)
AND (max_views IS NULL OR view_count < max_views)
AND CV không bị archived/deleted/banned
```

Nên dùng transaction hoặc atomic update khi tăng view count.

## 5.6. PostgreSQL Row-Level Security — Defense in Depth

Django vẫn kiểm tra permission ở service/API. RLS là lớp bổ sung.

Ví dụ owner policy:

```sql
ALTER TABLE user_cvs ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_cvs_owner_policy
ON user_cvs
USING (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::BIGINT
);
```

Mỗi transaction:

```sql
SET LOCAL app.current_user_id = '123';
```

**Lưu ý**

- RLS với connection pool phải dùng `SET LOCAL` trong transaction.
- Admin/worker cần database role riêng.
- Chỉ triển khai RLS khi team có test integration đầy đủ; không thay thế permission DRF.

## 5.7. Bảo vệ PII

- File CV để private bucket.
- Download qua signed URL ngắn hạn.
- Không trả storage key nội bộ trực tiếp.
- Encrypt at rest ở storage/database.
- TLS in transit.
- Không log `content_json`.
- Hash IP/user-agent trong audit nếu không cần raw value.
- Retention policy cho CV đã xóa và shared links.
- Xóa logic trước, purge vật lý theo scheduled job.
- AI phải tuân theo Candidate consent.

---

# 6. Quản lý trạng thái CV

## 6.1. Tách hai state machine

### Lifecycle

```text
draft -> published -> archived
  ^          |
  └----------┘  tạo version mới rồi publish lại
```

- `draft`: CV đang xây dựng.
- `published`: có một stable version để apply/export/share.
- `archived`: ẩn khỏi sử dụng mới nhưng application snapshot cũ vẫn tồn tại.

### Processing

```text
idle -> queued -> processing -> analyzed
                         └----> failed
```

Dùng cho:

- import file;
- parsing;
- AI analysis;
- thumbnail;
- PDF.

Không dùng processing status thay cho lifecycle.

## 6.2. Published không có nghĩa là public

CV chứa PII. Mặc định:

```text
lifecycle_status = published
visibility = private
```

User chỉ chia sẻ qua application hoặc shared link.

## 6.3. Delete

- Candidate “xóa” => soft delete `user_cvs`.
- Shared links bị revoke.
- Draft bị xóa.
- Application snapshots không xóa.
- Versions đang được application/export/audit tham chiếu phải giữ.
- Purge vật lý theo retention/compliance policy.

---

# 7. Snapshot hay Reference khi ứng tuyển?

## 7.1. Chỉ lưu reference tới mutable `user_cvs` — Không chấp nhận

### Ưu điểm

- ít dữ liệu;
- code đơn giản.

### Nhược điểm

- ứng viên sửa làm thay đổi hồ sơ đã nộp;
- recruiter không có bằng chứng lịch sử;
- khó audit/tranh chấp;
- PDF và UI có thể khác;
- template update có thể phá render;
- không phù hợp hệ thống tuyển dụng production.

## 7.2. Copy toàn bộ JSON trực tiếp vào `applications`

### Ưu điểm

- application tự chứa snapshot;
- đọc đơn giản.

### Nhược điểm

- bảng application phình lớn;
- duplicated schema;
- khó reuse renderer/export;
- không có version lineage;
- uploaded file snapshot khó quản lý;
- mỗi module có một kiểu snapshot khác nhau.

## 7.3. Phương án chốt: Reference tới immutable `cv_versions`

Đây là **snapshot về nghiệp vụ** nhưng triển khai bằng reference tới row bất biến.

### Flow

```text
UserCv (mutable aggregate)
   │
   ├── Draft đang sửa
   │
   └── Create immutable CvVersion
                 │
                 └── Application.submitted_cv_version_id
```

### Ưu điểm

- application không đổi;
- không duplicate JSON vào bảng application;
- renderer dùng chung;
- export dùng chung;
- audit rõ;
- hỗ trợ version history;
- có thể hash/deduplicate;
- không bị ảnh hưởng bởi draft mới.

### Quy tắc

- `cv_versions` không update/delete.
- `Application` dùng `ON DELETE RESTRICT`.
- Snapshot lưu `template_version_id`.
- Nếu uploaded CV, snapshot phải giữ file storage key/hash riêng.
- Khi re-apply theo rule hiện tại, tạo snapshot mới và cập nhật application theo nghiệp vụ đã chốt.

---

# 8. Admin & Recruiter Management

## 8.1. Admin Template Management

### Chức năng

- Create template identity.
- Create draft template version.
- Gán category/tag.
- Gán language metadata.
- Cấu hình section/region.
- Cấu hình colors/fonts/background/capabilities.
- Preview test data.
- Validate JSON schema.
- Publish version.
- Retire version.
- Không sửa version đã published.

### Quy tắc publish

- slug không trùng;
- có ít nhất một locale;
- có renderer key hợp lệ;
- layout/style pass schema;
- section bắt buộc tồn tại;
- có thumbnail;
- PDF smoke test pass;
- không chứa JavaScript/HTML nguy hiểm.

## 8.2. Admin CV Management

Danh sách nên trả:

- CV public ID;
- owner public ID;
- owner masked email;
- title;
- type/source;
- lifecycle;
- processing;
- language;
- template;
- version count;
- application count;
- shared link count;
- created/updated/published;
- last export/error.

Không trả `content_json` ở list.

### Hành động

- view metadata;
- view sensitive content với permission;
- archive/restore;
- revoke links;
- retry export/import;
- xem audit;
- không chỉnh sửa nội dung thay Candidate trừ use-case support có audit.

## 8.3. Recruiter

Recruiter không có “quản lý CV toàn hệ thống”.

Recruiter chỉ có:

- danh sách applications của job/company có quyền;
- view submitted snapshot;
- download snapshot nếu policy cho phép;
- add note/status;
- audit download/view.

Recruiter không được:

- xem latest draft;
- xem CV khác của Candidate;
- dùng shared internal ID để enumerate;
- đổi/sửa CV;
- tiếp tục xem qua application nếu quyền company bị thu hồi, tùy policy bảo mật.

---

# 9. Migration từ schema hiện tại

## Step 1 — Inventory & backup

- Chốt migration window.
- Backup PostgreSQL.
- Lấy count:
  - templates;
  - builder CV;
  - uploaded CV;
  - applications;
  - orphan FK;
  - invalid JSON.
- Thêm feature flag `CV_BUILDER_V2`.

## Step 2 — Additive migration

Tạo bảng mới trước, chưa xóa field cũ:

- categories;
- template versions;
- section definitions;
- versions;
- drafts;
- shared links;
- exports;
- access logs.

Thêm nullable field mới vào `user_cvs` và `applications`.

## Step 3 — Backfill template

Với mỗi `CvTemplate` hiện tại:

1. Tạo `cv_template_versions(version_number=1)`.
2. Copy:
   - `layout_config` -> `default_layout_json`;
   - `style_config` -> `default_style_json`.
3. `renderer_key` map theo template.
4. Convert `category` string thành category relation.
5. Set current published version.

## Step 4 — Backfill User CV

Với mỗi builder CV:

1. Validate `cv_data`.
2. Convert sang canonical content schema.
3. Tạo `cv_versions(version_number=1)`.
4. Copy `style_config`.
5. Generate default layout.
6. Set `latest_version_id`.
7. Nếu CV usable, set `published_version_id` theo policy.
8. Giữ field cũ trong thời gian dual-read.

Với uploaded CV:

- Tạo imported version;
- giữ storage key;
- tạo plain text nếu đã parse.

## Step 5 — Backfill application snapshot

Với mỗi application:

1. Tạo `application_snapshot` từ CV hiện tại.
2. Gán `submitted_cv_version_id`.
3. Lưu title/source.
4. Kiểm tra 100% application có snapshot.

**Giới hạn:** Snapshot backfill không thể tái tạo chính xác nội dung lịch sử trước migration nếu CV đã bị sửa. Cần ghi rõ đây là “best available snapshot at migration time”.

## Step 6 — Dual write

Trong một release:

- write field mới;
- có thể giữ field cũ để rollback;
- compare output renderer;
- log mismatch.

## Step 7 — Cutover

- API V2 đọc `cv_versions`;
- application đọc submitted snapshot;
- PDF đọc version;
- shared view đọc version;
- khóa write field legacy.

## Step 8 — Cleanup

Sau thời gian ổn định:

- bỏ `CvTemplate.category`;
- bỏ hoặc deprecate `CvTemplate.layout_config/style_config`;
- bỏ `UserCv.cv_data/style_config` nếu đã chuyển hoàn toàn;
- đổi tên status cũ;
- thêm NOT NULL/constraints;
- xóa code dual-read.

---

# 10. API đề xuất

## Public Template

```text
GET /api/v1/cv-templates
GET /api/v1/cv-templates/{slug}
GET /api/v1/cv-templates/{slug}/related
GET /api/v1/cv-categories
GET /api/v1/cv-sample-contents
```

Filter:

```text
?locale=vi-VN&category=professional&sort=popular
```

## Candidate CV

```text
GET    /api/v1/cvs
POST   /api/v1/cvs
GET    /api/v1/cvs/{public_id}
PATCH  /api/v1/cvs/{public_id}/metadata
POST   /api/v1/cvs/{public_id}/archive
POST   /api/v1/cvs/{public_id}/restore
POST   /api/v1/cvs/{public_id}/duplicate
```

## Draft

```text
GET    /api/v1/cvs/{public_id}/draft
PUT    /api/v1/cvs/{public_id}/draft
DELETE /api/v1/cvs/{public_id}/draft
POST   /api/v1/cvs/{public_id}/save-version
POST   /api/v1/cvs/{public_id}/publish
```

`PUT draft` yêu cầu:

```http
If-Match: "lock-version-12"
```

Conflict trả:

```http
409 Conflict
```

## Versions

```text
GET /api/v1/cvs/{public_id}/versions
GET /api/v1/cvs/{public_id}/versions/{version_public_id}
POST /api/v1/cvs/{public_id}/versions/{version_public_id}/restore-as-draft
```

## Share

```text
POST   /api/v1/cvs/{public_id}/shared-links
GET    /api/v1/cvs/{public_id}/shared-links
DELETE /api/v1/cvs/{public_id}/shared-links/{link_public_id}

GET /cv/share/{raw_token}
```

## Export

```text
POST /api/v1/cvs/{public_id}/exports
GET  /api/v1/cv-exports/{export_public_id}
```

## Application

```text
POST /api/v1/jobs/{job_public_id}/applications
GET  /api/v1/recruiter/applications/{application_public_id}/cv
```

Candidate apply request:

```json
{
  "cv_public_id": "cv_xxx",
  "cover_letter": "..."
}
```

Backend tự tạo snapshot; client không gửi `cv_version_id` tùy ý.

## Admin

```text
GET    /api/v1/admin/cv-templates
POST   /api/v1/admin/cv-templates
POST   /api/v1/admin/cv-templates/{id}/versions
POST   /api/v1/admin/cv-template-versions/{id}/publish

GET    /api/v1/admin/cvs
GET    /api/v1/admin/cvs/{id}/metadata
GET    /api/v1/admin/cvs/{id}/sensitive-content
POST   /api/v1/admin/cvs/{id}/archive
POST   /api/v1/admin/cvs/{id}/revoke-links
GET    /api/v1/admin/cvs/{id}/access-logs
```

---

# 11. Transaction boundaries

## 11.1. Save Version

Trong một transaction:

1. lock `user_cvs`;
2. đọc draft;
3. validate schema;
4. calculate content hash;
5. increment version number;
6. insert `cv_versions`;
7. update `latest_version_id`;
8. optional update `published_version_id`;
9. update lifecycle/timestamp;
10. commit.

## 11.2. Apply

Trong một transaction:

1. check job active/deadline;
2. check Candidate;
3. lock selected CV;
4. check CV ownership;
5. save immutable snapshot;
6. create/update application;
7. set snapshot FK;
8. increment application count bằng `F()`/atomic SQL;
9. audit;
10. commit.

## 11.3. Create Shared Link

1. check owner;
2. require stable version;
3. generate random token;
4. insert token hash;
5. return raw token một lần;
6. commit.

---

# 12. Concurrency & Performance

## 12.1. Autosave

- debounce 2–5 giây;
- payload có `lock_version`;
- 409 nếu stale;
- client merge hoặc hỏi reload;
- không tạo immutable version mỗi autosave.

## 12.2. Usage count

Không dùng:

```python
template.usage_count += 1
template.save()
```

Dùng:

```python
CvTemplate.objects.filter(pk=id).update(
    usage_count=F('usage_count') + 1
)
```

Hoặc analytics event rồi aggregate async.

## 12.3. Cache

Có thể cache:

- public template list;
- template detail;
- category list;
- published template version.

Không cache chung:

- private CV;
- recruiter application snapshot;
- shared link response chưa phân biệt token.

## 12.4. Pagination

Admin/Candidate list dùng cursor hoặc stable ordering:

```text
updated_at DESC, id DESC
```

## 12.5. Storage

- PostgreSQL: metadata/JSON/text.
- Object storage: PDF, DOCX, image, thumbnail.
- CDN chỉ dùng public template asset.
- Candidate CV assets private, signed URL.

---

# 13. Testing Strategy

## 13.1. Authorization tests bắt buộc

- Candidate A không xem/sửa CV Candidate B.
- Employer không gọi Candidate CV endpoint.
- Recruiter không xem application job của company khác.
- Recruiter chỉ nhận submitted version.
- Admin thiếu sensitive permission không xem content.
- Revoked/expired token bị chặn.
- Token enumeration không khả thi.
- Archived/deleted CV không tạo link mới.

## 13.2. Snapshot tests

- Apply bằng version N.
- Sửa CV thành N+1.
- Recruiter vẫn thấy N.
- Xóa/archived CV gốc.
- Recruiter vẫn thấy snapshot N.
- Template publish version mới.
- Snapshot cũ vẫn render với template version cũ.

## 13.3. Concurrency tests

- Hai tab autosave cùng lúc.
- Stale lock version trả 409.
- Hai request set default CV.
- Hai apply request.
- Hai worker export cùng job.
- shared link max views atomic.

## 13.4. Schema validation tests

- invalid section key;
- duplicate section instance ID;
- duplicate item ID;
- unsupported renderer;
- invalid hex color;
- invalid font;
- oversized JSON;
- unsafe rich text payload.

## 13.5. PDF tests

- A4 page break;
- Unicode Vietnamese;
- font loaded;
- no external untrusted resource;
- deterministic output;
- header/footer/watermark;
- file private;
- export from immutable version.

---

# 14. Monitoring & Audit

Metrics:

- CV created/published/exported/applied;
- autosave success/conflict;
- PDF queue latency/failure;
- template render error;
- shared link access/revoke;
- unauthorized/404 access attempts;
- AI run latency/error/cost;
- average JSON size;
- versions per CV;
- orphaned storage assets.

Structured logs không chứa:

- full CV JSON;
- email/phone raw;
- shared raw token;
- signed URL;
- AI prompt chứa PII.

Alert:

- export failure rate;
- permission denial spike;
- invalid token spike;
- DB JSON size growth;
- queue backlog;
- AI cost anomaly.

---

# 15. Những thay đổi đề xuất trực tiếp cho repository

## 15.1. `backend/apps/cv_templates`

Tách:

```text
models/
  template.py
  category.py
  version.py
  section.py
  sample_content.py

selectors/
services/
validators/
schemas/
```

Không bắt buộc tách ngay nếu dự án còn nhỏ, nhưng boundary nên rõ.

## 15.2. `backend/apps/cvs`

Bổ sung:

```text
models/
  cv.py
  version.py
  draft.py
  share.py
  export.py
  access_log.py
  ai.py

services/
  create_cv.py
  save_version.py
  publish_cv.py
  apply_snapshot.py
  sharing.py
  export_pdf.py

selectors/
  candidate_cvs.py
  recruiter_application_cv.py
  admin_cvs.py

permissions/
schemas/
tasks/
```

## 15.3. `backend/apps/applications`

- Application service chịu trách nhiệm tạo snapshot.
- Không cho serializer nhận trực tiếp candidate/cv version từ client mà không validate.
- Recruiter selector join qua job/company membership.
- Không serialize `UserCv` latest state.

## 15.4. Frontend

Nên có canonical store:

```text
features/cv-builder/
  api/
  components/
  editor/
  renderer/
  schemas/
  stores/
  templates/
  types/
  utils/
```

Renderer nhận đúng ba input:

```text
content
layout
style
```

Không để template component gọi API hoặc chứa business authorization.

---

# 16. Definition of Done theo giai đoạn

## Phase 1

- [ ] Template taxonomy normalized.
- [ ] Template version immutable.
- [ ] Canonical CV JSON validated.
- [ ] Draft optimistic locking.
- [ ] Save/publish version.
- [ ] Private owner view.
- [ ] Secure shared link.
- [ ] PDF from immutable version.
- [ ] Application snapshot.
- [ ] Recruiter authorization by job/company.
- [ ] Admin metadata list.
- [ ] Sensitive access audit.
- [ ] IDOR/security tests.
- [ ] Migration/backfill complete.

## Phase 2

- [ ] Drag/drop section.
- [ ] Multi-region layout.
- [ ] Theme/font/spacing.
- [ ] Change template without content loss.
- [ ] Version history restore.
- [ ] Import pipeline.
- [ ] Thumbnail worker.
- [ ] Performance test on large CV.

## Phase 3

- [ ] AI consent check.
- [ ] AI run/suggestion audit.
- [ ] Candidate accept/reject.
- [ ] JD hash and prompt version.
- [ ] AI quota/rate limit.
- [ ] Search projection/vector strategy.
- [ ] Cost and safety monitoring.

---

# 17. Những việc không nên làm

- Không lưu toàn bộ CV trong bảng `users`.
- Không tạo table riêng cho từng template.
- Không lưu HTML/React component tùy ý từ Admin.
- Không dùng array index làm section ID.
- Không lưu raw share token.
- Không render recruiter view từ latest `UserCv`.
- Không sửa published template version.
- Không dùng `status` duy nhất cho cả lifecycle và processing.
- Không lưu PDF binary vào PostgreSQL.
- Không cho AI tự ghi thẳng vào CV.
- Không log full CV JSON.
- Không dựa vào public ID khó đoán thay cho authorization.
- Không xóa application snapshot khi Candidate xóa CV.

---

# 18. Ưu tiên triển khai đề xuất

## Sprint/Work Package 1 — Schema Hardening

1. Template categories/version.
2. CV versions/drafts.
3. Split statuses.
4. Application snapshot field.
5. Migration/backfill script.
6. Authorization tests.

## Sprint/Work Package 2 — MVP APIs

1. Catalog/detail.
2. Create CV.
3. Draft/save/publish.
4. Candidate CV list.
5. Owner private view.
6. Apply snapshot.
7. Recruiter application view.

## Sprint/Work Package 3 — Export/Share/Admin

1. PDF queue/worker.
2. Secure shared link.
3. Audit log.
4. Admin template workflow.
5. Admin CV metadata.
6. Operational dashboards.

## Sprint/Work Package 4 — Advanced Builder

1. Drag/drop.
2. Font/color/layout.
3. Undo/Redo.
4. Version restore.
5. Import CV.

## Sprint/Work Package 5 — AI

1. Consent.
2. AI run tracking.
3. JD-aware suggestions.
4. Accept/reject workflow.
5. ATS/matching projection.

---

# 19. Kết luận

Schema hiện tại có quyết định đúng ban đầu là tách `CvTemplate` và `UserCv`, dùng JSON cho dữ liệu linh hoạt và có public ID. Tuy nhiên, để triển khai CV Builder giống luồng sản phẩm HRTech lớn mà không tạo tech debt, ba thay đổi phải được thực hiện trước khi mở rộng UI:

1. **Template Versioning** — template đã publish là bất biến.
2. **CV Versioning + Draft** — autosave mutable, save/publish là immutable.
3. **Application Snapshot** — recruiter luôn xem đúng phiên bản tại thời điểm ứng tuyển.

Sau khi ba nền móng này tồn tại, các tính năng drag/drop, đổi template, PDF, share link và AI có thể được thêm dần mà không phải thiết kế lại schema lõi.

---

# 20. Nguồn đã đối chiếu

## Repository

- `backend/apps/accounts/models.py`
- `backend/apps/candidates/models.py`
- `backend/apps/employers/models/company.py`
- `backend/apps/jobs/models/core.py`
- `backend/apps/applications/models.py`
- `backend/apps/cv_templates/models.py`
- `backend/apps/cv_templates/serializers.py`
- `backend/apps/cv_templates/views.py`
- `backend/apps/cvs/models.py`
- `backend/apps/cvs/serializers.py`
- `backend/apps/cvs/views.py`
- `backend/apps/cvs/services/cvs.py`

## Tài liệu đầu vào

- `ke-hoach-trien-khai-cv-builder(1).md`

## User flow tham khảo

- Kho template TopCV.
- Chi tiết template.
- CV Builder workspace.
- Private/authenticated CV view.

Phân tích học theo user flow và bài toán nghiệp vụ, không sao chép implementation nội bộ của TopCV.
