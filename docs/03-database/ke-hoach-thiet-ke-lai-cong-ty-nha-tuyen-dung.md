# Kế hoạch thiết kế lại: Công ty & Nhà tuyển dụng

Nguồn yêu cầu: `document_project_ai/Công ty và nhà tuyển dụng.docx` (tham khảo luồng TopCV).

> **Trạng thái (2026-07-11): đã triển khai xong cả 3 giai đoạn A + B + C** — schema + data migration, jobs chuyển sang company, API `/api/employer/*` + admin duyệt, frontend cổng NTD chuyển sang API mới và bảng `employer_profiles` đã xóa (migration `employers.0008`).

## 1. Vấn đề hiện tại

`employer_profiles` đang gộp **2 khái niệm khác nhau** vào một bảng, 1-1 với `users`:

- **Công ty** (pháp nhân): tên, MST, logo, quy mô, lĩnh vực, trạng thái xác thực.
- **Nhà tuyển dụng** (con người): tài khoản đăng nhập, người đăng tin.

Hệ quả:
- Một công ty có nhiều HR ⇒ mỗi HR tạo một `employer_profile` riêng ⇒ trùng lặp N bản ghi cho cùng một công ty, mỗi bản phải xác thực lại từ đầu, dữ liệu công ty (logo, mô tả) lệch nhau giữa các HR.
- Không có chỗ lưu: loại hình (doanh nghiệp / hộ kinh doanh), tên thương mại, lĩnh vực chính, thị trường, khách hàng mục tiêu, phúc lợi, ảnh công ty, giấy tờ xác thực, yêu cầu cập nhật chờ duyệt.
- Không có luồng onboarding từng bước (xác thực SĐT → thông tin công ty → giấy ĐKDN → thỏa thuận DLCN → đăng tin đầu tiên).

## 2. Thiết kế mục tiêu

Tách thành 2 trục thực thể + các bảng vệ tinh:

```
users 1─1 recruiter_profiles N─1 companies 1─N jobs
                │                    │
                │                    ├── company_industries (M2M + is_primary)
                │                    ├── company_images
                │                    ├── company_documents
                │                    └── company_update_requests
                └── phone_otps
```

### 2.1 `companies` — pháp nhân, xác thực một lần dùng chung

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `public_id` | char, unique | prefix `co` (kế thừa từ employer_profiles) |
| `slug` | slug, unique | từ `company_name` |
| `business_type` | choices | `enterprise` (Doanh nghiệp) / `household` (Hộ kinh doanh) |
| `tax_code` | char, **unique** | MST; với hộ kinh doanh là MST người đại diện. Unique là chốt chặn chống trùng công ty |
| `company_name` | char | Tên đăng ký kinh doanh (khớp Cục Thuế) |
| `trade_name` | char, blank | Tên thương mại; `trade_name_same_as_registered` bool |
| `logo_url` | text, blank | storage key; `has_no_logo` bool (checkbox "Tôi không có logo") |
| `cover_image_url` | text, blank | giữ từ employer_profiles |
| `website_url` | text, blank | `has_no_website` bool |
| `email` / `phone` / `address` | | liên hệ công khai của công ty |
| `company_size` | **choices** | bucket: `1-9`, `10-24`, `25-99`, `100-499`, `500-1000`, `1000+`, `3000+`, `5000+`, `10000+` (hiện là text tự do → chuẩn hóa) |
| `description` | text | rich text (hiển thị với ứng viên trên tin) |
| `employee_benefits` | text, blank | rich text, không bắt buộc |
| `markets` | JSONField list | enum: `domestic/asia/europe/africa/america/australia`; validate bằng validator. Nâng thành bảng riêng nếu sau này cần filter |
| `target_customers` | JSONField list | enum: `b2b/b2c/b2g` |
| `founded_year` | int, null | giữ |
| `has_brand_page` | bool | giữ (trang thương hiệu) |
| `verification_status` | choices | `unverified` → `pending` → `verified` / `rejected` |
| `verified_at`, `rejected_reason` | | giữ |
| `created_by` | FK users, PROTECT | người tạo hồ sơ công ty đầu tiên |
| `created_at`, `updated_at` | | |

> Nguyên tắc TopCV áp dụng: **tạo công ty mới thì có hiệu lực ngay** (`unverified`, được hiển thị kèm nhãn chưa xác thực), nhưng **cập nhật sau đó phải qua duyệt** (mục 2.6).

### 2.2 `company_industries` — through table thay cho M2M trần

| Trường | Ghi chú |
|---|---|
| `company` FK, `industry` FK | UNIQUE(company, industry) |
| `is_primary` bool | **Lĩnh vực chính**: partial unique `UNIQUE(company) WHERE is_primary` ⇒ đúng 1 lĩnh vực chính, và tự đảm bảo nó nằm trong các lĩnh vực đã chọn (cùng một hàng) |

Bảng `industries` giữ nguyên.

### 2.3 `company_images` — ảnh giới thiệu công ty

`company` FK · `image_url` (storage key) · `caption` blank · `sort_order` · `created_at`. Khuyến nghị tỉ lệ 3:2 (1200×800) validate ở API/frontend, không ràng buộc DB.

### 2.4 `company_documents` — giấy tờ xác thực

| Trường | Ghi chú |
|---|---|
| `company` FK, `uploaded_by` FK users | |
| `doc_type` choices | `business_registration` (giấy ĐKDN/tương đương) / `trade_name_proof` (chứng minh tên thương mại) / `authorization_letter` (giấy ủy quyền) / `identity_document` (CCCD/hộ chiếu) / `data_processing_agreement` (thỏa thuận xử lý DLCN) |
| `file_url`, `file_name` | validate mime: jpeg/jpg/png/pdf |
| `update_request` | FK `company_update_requests`, null | giấy tờ đính kèm yêu cầu cập nhật (nếu có) |
| `status` | `pending/approved/rejected`, `reviewed_by` FK users, `reviewed_at`, `review_note` |

### 2.5 `recruiter_profiles` — thay thế `employer_profiles`, 1-1 với user

| Trường | Ghi chú |
|---|---|
| `public_id` | prefix mới `rec` |
| `user` | OneToOne |
| `company` | FK companies, **null**, on_delete=PROTECT — null khi mới đăng ký, gán trong onboarding. **Đã gán thì không đổi được** (enforce ở service: chỉ cho set khi đang null; đổi công ty = liên hệ vận hành) |
| `company_role` | choices `owner` / `member` — người tạo công ty là owner (được gửi yêu cầu cập nhật công ty); HR join sau là member |
| `membership_status` | choices `pending/approved/rejected` — owner tạo công ty mới: `approved` ngay; member join công ty có sẵn: `pending` chờ admin duyệt |
| `membership_proof_type` | choices, null: `business_registration` / `authorization_and_id` — loại giấy tờ khi join công ty có sẵn |
| `membership_reviewed_by` / `membership_reviewed_at` / `membership_review_note` | admin duyệt membership |
| `position_title` | chức danh (HR Manager…), blank |
| `verified_phone` | char, blank, **unique khi có giá trị** (partial unique) — "SĐT đã có NTD khác xác thực" chính là vi phạm ràng buộc này |
| `phone_verified_at` | null |
| `dpa_accepted_at` | null — chấp nhận thỏa thuận xử lý DLCN |
| `onboarding_completed_at` | null — cache mốc hoàn thành |
| `created_at`, `updated_at` | không có `status` riêng — trạng thái tài khoản đã có ở `users.status` |

**Các bước onboarding suy ra từ dữ liệu, không cần bảng riêng:**
1. Xác thực SĐT → `phone_verified_at`
2. Cập nhật thông tin công ty → `company_id IS NOT NULL`
3. Giấy ĐKDN → tồn tại `company_documents(doc_type=business_registration, status != rejected)`
4. Thỏa thuận DLCN → `dpa_accepted_at`
5. Đăng tin đầu tiên → tồn tại `jobs(posted_by=user)`

Điều kiện **được đăng tin công khai**: bước 1–4 xong và `companies.verification_status = verified` (tùy chính sách có thể nới: cho đăng ở trạng thái pending, admin duyệt tin).

### 2.6 `company_update_requests` — cập nhật phải chờ duyệt

| Trường | Ghi chú |
|---|---|
| `public_id`, `company` FK, `requested_by` FK users | "Ngày yêu cầu gần nhất" = `MAX(created_at)` theo company |
| `changes` | JSONB — snapshot các trường đề xuất `{field: new_value}` |
| `is_sensitive` | bool — `True` khi đổi `tax_code` hoặc `company_name` |
| `reason` | text — bắt buộc khi `is_sensitive` |
| `proof_type` | choices, null: `business_registration` / `authorization_and_id` (giấy ủy quyền + giấy tờ định danh) — bắt buộc khi `is_sensitive`; file đính kèm nằm ở `company_documents.update_request` |
| `status` | `pending/approved/rejected` + `reviewed_by`, `reviewed_at`, `review_note` |

Khi admin approve: service apply `changes` vào `companies` trong 1 transaction, ghi `reviewed_*`. Mỗi company chỉ có tối đa 1 request `pending` (partial unique).

### 2.7 `phone_otps` — xác thực SĐT qua OTP

`user` FK · `phone` · `code_hash` (không lưu plain) · `expires_at` · `attempts` · `verified_at` · `created_at`. Index (user, created_at) để throttle. Luồng đặc thù đăng nhập Google: user chưa có mật khẩu (`has_usable_password()` = False) → bắt tạo mật khẩu trước khi gửi OTP — không cần thêm cột, dùng `users.password` sẵn có.

### 2.8 Sửa `jobs`

- `employer_profile` FK → **`company`** FK (tin thuộc công ty).
- `employer` FK users → đổi tên ngữ nghĩa thành **`posted_by`** (người đăng cụ thể) — giữ cột, rename ở model.
- Index `(company, status, -created_at)` thay cho index theo employer_profile.
- Nhãn "Tin xác thực" suy từ `company.verification_status`.

## 3. Kế hoạch migration (3 giai đoạn, không downtime)

### Giai đoạn A — Dựng schema mới + đổ dữ liệu
1. Tạo app `companies` (hoặc mở rộng app `employers`): models `Company`, `CompanyIndustry`, `CompanyImage`, `CompanyDocument`, `CompanyUpdateRequest`, `PhoneOtp`, `RecruiterProfile`.
2. Data migration: mỗi `employer_profiles` → 1 `companies` (copy toàn bộ field trùng, giữ `public_id`/`slug`, map `status` → `verification_status`, `company_size` text → bucket gần nhất, fallback giữ raw) + 1 `recruiter_profiles` (`company_role=owner`, `company` trỏ về company vừa tạo). Copy M2M industries → `company_industries` (industry đầu tiên tạm làm `is_primary`).
3. `tax_code` trùng giữa các profile cũ: gộp về 1 company (bản ghi verified/mới nhất thắng), các recruiter còn lại thành `member` của company đó — đây chính là bước dọn "nhiều công ty rác" hiện tại. Tax_code rỗng thì mỗi profile vẫn ra 1 company riêng (unique cho phép nhiều NULL).

### Giai đoạn B — Chuyển jobs & API
4. Thêm `jobs.company` (null tạm), data migration map từ `employer_profile.company`, rồi siết NOT NULL + index mới, xóa FK cũ.
5. API: giữ `/employer/profile/` trả dữ liệu ghép (company + recruiter) để frontend cũ không vỡ; thêm mới `/employer/company/`, `/employer/company/search/?q=` (tìm theo tên, tên thương mại, MST — trả tên, MST, địa chỉ, quy mô, lĩnh vực), `/employer/company/update-requests/`, `/employer/onboarding/` (trạng thái 5 bước), `/employer/phone/send-otp|verify/`.
6. Admin: duyệt company, duyệt update request (diff `changes` với giá trị hiện tại), duyệt documents.

### Giai đoạn C — Dọn dẹp
7. **Đã hoàn tất:** Frontend chuyển sang API mới; `employer_profiles` và endpoint tương thích đã được gỡ.
8. **Đã hoàn tất:** Cập nhật `docs/03-database/thiet-ke-database.md` và `docs/TIEN-DO-DU-AN.md`.

## 4. Thứ tự triển khai đề xuất theo tính năng

1. **P1**: Company/RecruiterProfile + migration dữ liệu + API tương thích (nền móng, chưa đổi UX).
2. **P2**: Onboarding 5 bước — OTP SĐT, form tạo công ty mới (đủ trường mục 2.1), tìm & chọn công ty có sẵn.
3. **P3**: Upload giấy tờ + admin duyệt xác thực công ty.
4. **P4**: Yêu cầu cập nhật thông tin công ty + luồng duyệt (kèm reason/giấy tờ khi đổi MST/tên).
5. **P5**: Ảnh công ty, thị trường/khách hàng mục tiêu/phúc lợi trên trang công ty public.

## 5. Các quyết định đã chốt (2026-07-11)

- **HR thứ 2 join công ty có sẵn: phải chờ admin duyệt.** Khi chọn công ty, recruiter phải upload giấy tờ chứng minh — chọn 1 trong 2: (a) giấy đăng ký doanh nghiệp hoặc giấy tờ tương đương, hoặc (b) giấy ủy quyền + giấy tờ định danh. Upload xong membership ở trạng thái `pending` cho đến khi admin duyệt. Thể hiện trong schema: `recruiter_profiles.membership_status` (`approved` khi tự tạo công ty mới với vai trò owner; `pending` khi join công ty có sẵn) + `membership_proof_type` + `membership_reviewed_by/at`; giấy tờ lưu ở `company_documents` với `uploaded_by` = người join.
- **Đăng tin: công ty nào cũng được đăng, nhưng từng tin phải chờ duyệt.** Job tạo ra ở `status=pending`, admin duyệt → `active`. Không chặn theo `verification_status` của công ty; nhãn "Tin xác thực" vẫn suy từ công ty đã verified.
- **OTP: dùng email trước** (chưa có SMS gateway trong môi trường thesis), schema `phone_otps` giữ nguyên để chuyển sang SMS sau mà không đổi DB.

## 6. Kế hoạch tái cấu trúc mã nguồn `backend/apps`

> **Trạng thái triển khai (2026-07-11): Đã hoàn tất R0–R3.** `employers` và `jobs` đã được tách thành package model/API/service/selector/test; helper search và email transport đã chuyển về `common`; truy vấn link động và site setting đã có public selector trong `sitecontent`. R4 áp dụng theo nhu cầu khi các app nhỏ phát triển, không tạo package rỗng trước.

### 6.1. Đánh giá cấu trúc hiện tại

`backend/apps` hiện có 13 Django app đặt phẳng. Cách đặt app phẳng là phù hợp với Django và cần giữ lại, nhưng phần bên trong app đang phát triển theo kiểu “mỗi loại một file” (`models.py`, `serializers.py`, `views.py`, `tests.py`). Khi nghiệp vụ lớn dần, một thay đổi nhỏ phải đi qua nhiều file lớn và khó xác định ranh giới tính năng.

Các điểm nóng hiện tại:

| App/file | Hiện trạng | Hướng xử lý |
|---|---|---|
| `jobs/serializers.py` | Hơn 500 dòng, trộn public API, employer API và danh mục | Tách serializer theo use case |
| `jobs/models.py` | Hơn 450 dòng, gồm tin, taxonomy, thông tin phụ và saved job | Chuyển `models.py` thành package theo nhóm model |
| `employers/views.py` | Trộn recruiter, onboarding, company, upload và update request | Tách endpoint theo feature |
| `employers/models.py` | Trộn company, membership và verification | Tách package model nhưng giữ nguyên app label `employers` |
| `services.py` | Tên quá rộng; trong `jobs` chủ yếu là truy vấn thống kê, trong `employers` vừa OTP vừa duyệt | Tách thành service theo hành động cụ thể |
| `tests.py` | Một file lớn cho toàn app | Tách test theo API/service/model |
| Import chéo | `employers` dùng hàm search của `jobs`; `accounts` đọc `sitecontent`; `sitecontent` model tự query `jobs`/`locations` | Đưa utility dùng chung về `common`, đặt truy vấn phối hợp ở selector/service |
| `ai_core`, `dashboard`, `interviews` | Mới là app khung, chưa có domain hoàn chỉnh | Không mở rộng cấu trúc sớm; hoặc ghi rõ owner/phạm vi, hoặc bỏ khỏi `INSTALLED_APPS` đến khi triển khai |

### 6.2. Quyết định kiến trúc

1. **Giữ các Django app ở cấp phẳng**: `apps.accounts`, `apps.employers`, `apps.jobs`... Không chuyển thành `apps/recruitment/jobs` hoặc `apps/identity/accounts` ở giai đoạn này.
2. **Giữ nguyên `AppConfig.name`, app label, bảng DB và migration history**. Tái cấu trúc source code không được tạo migration schema.
3. **Tổ chức bên trong app theo domain/use case**, không chia tầng quá nhỏ chỉ để có nhiều folder.
4. **App nhỏ tiếp tục dùng file đơn**. Chỉ chuyển thành package khi file có nhiều nhóm nghiệp vụ hoặc khoảng 200–300 dòng trở lên.
5. **Write logic nằm trong service**, read/query logic nằm trong selector; serializer chịu trách nhiệm validate/biểu diễn, view chỉ điều phối HTTP.
6. **Không import view/serializer của app khác**. Quan hệ model dùng string reference khi có thể; giao tiếp chéo app đi qua public service/selector.
7. **`common` chỉ chứa hạ tầng và utility không mang nghiệp vụ**. Không đưa `Company`, `Job`, trạng thái onboarding hoặc policy tuyển dụng vào `common`.

> Không đổi tên app `employers` thành `companies` ngay. App hiện sở hữu cả `Company` và `RecruiterProfile`; đổi Python package/app label lúc này ảnh hưởng migration, content type, permission và import trên toàn hệ thống. Có thể đổi `verbose_name` để UI rõ nghĩa; chỉ rename app trong một dự án migration riêng nếu sau này thật sự cần.

### 6.3. Cấu trúc đích

```text
backend/
├── apps/
│   ├── accounts/                 # identity, authentication, authorization
│   ├── candidates/               # hồ sơ ứng viên
│   ├── employers/                # company + recruiter membership/onboarding
│   ├── jobs/                     # job catalog + job posting
│   ├── applications/             # quy trình ứng tuyển
│   ├── interviews/               # phỏng vấn (khi triển khai)
│   ├── cvs/                      # CV của ứng viên
│   ├── cv_templates/             # mẫu CV
│   ├── skills/                   # danh mục kỹ năng
│   ├── locations/                # danh mục địa giới
│   ├── sitecontent/              # CMS/cấu hình nội dung site
│   ├── dashboard/                # read model/reporting, không sở hữu domain model
│   └── ai_core/                  # adapter/use case AI, không chứa model nghiệp vụ trùng app khác
├── common/                       # hạ tầng dùng chung, không chứa business rule
│   ├── db/
│   │   └── search.py             # unaccent/fold/search expression dùng chung
│   ├── email/
│   │   └── backend.py            # transport/render email tổng quát
│   ├── media_storage.py
│   ├── pagination.py
│   ├── public_id.py
│   └── security.py
└── config/                       # settings, root URL, ASGI/WSGI, Celery bootstrap
```

Đây là **nhóm logic**, không phải yêu cầu tạo thêm folder trung gian bên dưới `apps`. Việc giữ package app phẳng giúp các import hiện có, migration dependency và lệnh Django tiếp tục ổn định.

### 6.4. Mẫu cấu trúc chuẩn cho app lớn

`employers` là app nên chuyển đầu tiên vì vừa hoàn thành thay đổi schema và đang có ranh giới nghiệp vụ rõ:

```text
apps/employers/
├── migrations/                   # tuyệt đối không di chuyển/viết lại migration cũ
├── models/
│   ├── __init__.py               # export public model API
│   ├── company.py                # Industry, Company, CompanyIndustry, CompanyImage
│   ├── membership.py             # RecruiterProfile
│   └── verification.py           # CompanyDocument, CompanyUpdateRequest, PhoneOtp
├── api/
│   ├── serializers/
│   │   ├── company.py
│   │   ├── onboarding.py
│   │   └── verification.py
│   ├── views/
│   │   ├── company.py
│   │   ├── onboarding.py
│   │   └── verification.py
│   └── urls.py
├── selectors/
│   ├── companies.py              # search/list/read query đã tối ưu
│   └── onboarding.py             # tính trạng thái onboarding
├── services/
│   ├── companies.py              # create/join/set industries
│   ├── memberships.py            # review membership
│   ├── onboarding.py             # OTP, accept DPA
│   └── verification.py           # company/document/update-request approval
├── admin/
│   ├── company.py
│   └── verification.py
├── tests/
│   ├── factories.py
│   ├── test_company_api.py
│   ├── test_onboarding_api.py
│   └── test_verification_services.py
├── apps.py
└── urls.py                       # compatibility shim: import urlpatterns từ api.urls
```

Yêu cầu kỹ thuật khi chuyển `models.py` thành `models/`:

- `models/__init__.py` phải import/export toàn bộ model để Django đăng ký model và giữ tương thích với `from apps.employers.models import Company`.
- Không đặt logic chạy query hoặc side effect trong `models/__init__.py`.
- `Meta.db_table`, tên model và app label không đổi.
- Chạy `makemigrations --check --dry-run`; kết quả bắt buộc là **No changes detected**.

`jobs` chuyển sau khi `employers` ổn định:

```text
apps/jobs/
├── models/
│   ├── job.py                    # Job
│   ├── taxonomy.py               # JobCategory, Benefit, Language
│   ├── details.py                # location, schedule, skill, benefit, language, contact
│   └── saved.py                  # SavedJob
├── api/
│   ├── public/                   # list/detail/stats/suggest/saved jobs
│   ├── employer/                 # create/update/manage posting
│   └── catalog/                  # category/benefit/language endpoints
├── selectors/
│   ├── listing.py
│   ├── search.py
│   └── stats.py
├── services/
│   ├── posting.py                # create/update/submit/close job
│   └── saved_jobs.py
└── tests/
```

### 6.5. Ranh giới trách nhiệm

| Thành phần | Được làm | Không được làm |
|---|---|---|
| `models` | Schema, constraint, quan hệ, invariant cục bộ | Gửi email, gọi API, điều phối nhiều aggregate |
| `selectors` | Query chỉ đọc, `select_related/prefetch_related`, filter/search | Ghi DB hoặc phát side effect |
| `services` | Transaction, thay đổi trạng thái, workflow, audit | Trả `Response` hoặc phụ thuộc HTTP request nếu không cần thiết |
| `serializers` | Parse/validate payload và biểu diễn response | Chứa workflow duyệt/join/OTP phức tạp |
| `views` | Permission, throttle, gọi selector/service, map HTTP status | Viết business rule hoặc query dài |
| `tasks` | Thực thi bất đồng bộ, retry/idempotency | Là nơi duy nhất chứa business rule |
| `common` | Storage, security, DB helper, email transport, base utilities | Import model của bất kỳ business app nào |

Quy tắc phụ thuộc đề xuất:

```text
config ──> apps ──> common
              │
accounts <── employers <── jobs <── applications
     │              │          │          │
     └──────────────┴──────────┴──────> (chỉ qua public model/service/selector)

skills, locations ──> được jobs/cvs tham chiếu như catalog
sitecontent ──> không được trở thành dependency ngược của domain model
dashboard ──> chỉ đọc từ selector/public model của các app
ai_core ──> gọi use case của app sở hữu dữ liệu; không sở hữu bản sao dữ liệu
```

Các import cần sửa sớm:

- `employers.views -> jobs.querysets.search_q`: chuyển helper tìm kiếm không dấu sang `common.db.search`; `employers` không phụ thuộc ngược vào `jobs` chỉ để dùng utility.
- `accounts.mailing -> sitecontent.models.SiteSetting`: truyền cấu hình/template vào email service hoặc đặt lớp đọc cấu hình ở hạ tầng; tránh để authentication phụ thuộc CMS.
- `sitecontent.models.LinkGroup.resolve_items -> jobs/locations`: chuyển phần resolve động sang `sitecontent.selectors.links`; model chỉ giữ cấu hình/source.
- `employers.services -> accounts.mailing`: dùng email backend công khai trong `common.email`, còn email xác thực tài khoản vẫn thuộc `accounts`.

### 6.6. Public API nội bộ của mỗi app

Mỗi app chỉ cam kết ổn định tại các điểm sau:

- `apps.<app>.models`: model được export công khai.
- `apps.<app>.services`: command/use case cho app khác gọi.
- `apps.<app>.selectors`: query công khai cho app khác đọc.
- `apps.<app>.urls`: root URL include từ `config.urls`.

Các module `api.views.*`, `api.serializers.*`, helper bắt đầu bằng `_` và implementation bên trong service không được app khác import trực tiếp.

### 6.7. Lộ trình triển khai an toàn

#### Giai đoạn R0 — Chốt baseline và guardrail

**Trạng thái: Hoàn tất.** Baseline có 26 test của `employers` + `jobs`, Django system check sạch và không phát sinh schema migration.

1. Chạy toàn bộ test hiện tại và lưu lại danh sách lỗi baseline.
2. Chạy `python manage.py check` và `python manage.py makemigrations --check --dry-run`.
3. Bổ sung test tối thiểu cho API company/onboarding/job hiện đang chạy trước khi di chuyển file.
4. Không trộn schema migration với source refactor trong cùng commit.

#### Giai đoạn R1 — Refactor `employers` thuần cơ học

**Trạng thái: Hoàn tất.** Models, serializers, views, selectors, services và tests đã có package riêng; root URL và public model/service import được giữ ổn định.

1. Chuyển models thành package, giữ public import cũ.
2. Tách API theo `company`, `onboarding`, `verification`.
3. Tách service và selector; giữ nguyên endpoint, payload, permission và status code.
4. Tách test theo feature.
5. Không đổi tên bảng/model/field, không tạo migration mới.

#### Giai đoạn R2 — Refactor `jobs`

**Trạng thái: Hoàn tất.** Models, serializers và views đã tách theo aggregate/use case; listing/stats nằm trong selectors; tạo tin pending đi qua posting service.

1. Tách model theo aggregate và taxonomy.
2. Tách public API với employer API.
3. Đổi `jobs.services.build_job_stats` thành selector vì đây là read/query use case.
4. Đưa create/update/submit job vào `services/posting.py` và bọc transaction tại service.
5. Giữ nguyên `/api/jobs/*` và serializer response trong giai đoạn này.

#### Giai đoạn R3 — Gỡ dependency sai chiều

**Trạng thái: Hoàn tất.** Search helper nằm ở `common.db.search`, email transport nằm ở `common.email`, dynamic site links và string settings nằm trong `sitecontent.selectors`.

1. Chuyển search helper dùng chung ra `common/db/search.py`.
2. Tách email transport khỏi email nghiệp vụ authentication.
3. Chuyển dynamic link resolution khỏi `sitecontent.models` sang selector.
4. Kiểm tra không còn import vòng bằng test import/Django system check.

#### Giai đoạn R4 — Chuẩn hóa các app còn lại

**Trạng thái: Áp dụng theo nhu cầu.** Các app nhỏ được giữ cấu trúc gọn cho đến khi vượt ngưỡng hoặc có nhiều use case độc lập.

- `accounts`: giữ `views/` hiện có; nhóm `oauth`, `password_reset`, `verification` vào service tương ứng, không gom lại thành một `services.py` lớn.
- `applications`, `cvs`, `sitecontent`: tách khi file vượt ngưỡng hoặc có từ hai use case độc lập trở lên.
- `skills`, `locations`, `cv_templates`: tiếp tục cấu trúc gọn hiện tại; không tạo package rỗng.
- `ai_core`, `dashboard`, `interviews`: xác định rõ phạm vi trước khi thêm code; app chưa dùng không cần models/migrations/tests placeholder.

### 6.8. Checklist hoàn tất cho mỗi giai đoạn

- [ ] `python manage.py check` thành công.
- [ ] `python manage.py makemigrations --check --dry-run` trả về `No changes detected`.
- [ ] Test của app thay đổi và test app phụ thuộc đều thành công.
- [ ] Endpoint, payload, permission và OpenAPI schema không thay đổi ngoài chủ đích.
- [ ] Không có migration mới chỉ vì di chuyển module Python.
- [ ] Không có import từ `api.views`/`api.serializers` của app khác.
- [ ] Query list/detail quan trọng không tăng số lượng truy vấn ngoài chủ đích.
- [ ] Mỗi service thay đổi trạng thái có transaction và test case thất bại/rollback.
- [ ] Không commit `__pycache__`, `*.pyc`, `celerybeat-schedule*` hoặc file runtime khác.

## 7. Thứ tự ưu tiên mới

Sau khi hoàn tất schema Company/Recruiter, thứ tự thực hiện đề xuất là:

1. **Đã xong:** R0 + R1 — khóa hành vi hiện tại và tái cấu trúc `employers`.
2. **Đã xong:** Frontend cổng NTD chuyển sang API company/onboarding mới.
3. **Đã xong:** R2 — tái cấu trúc `jobs`.
4. **Đã xong:** R3 — gỡ dependency sai chiều và chuẩn hóa hạ tầng dùng chung.
5. **Tiếp theo:** P2–P5 còn thiếu ở frontend/product; chuẩn hóa app nhỏ theo R4 khi xuất hiện nhu cầu thực tế.

Mỗi giai đoạn phải là một pull request/commit độc lập. Không thực hiện đồng thời rename app, thay endpoint, đổi schema và di chuyển file vì khi có lỗi sẽ không xác định được nguyên nhân và khó rollback.
