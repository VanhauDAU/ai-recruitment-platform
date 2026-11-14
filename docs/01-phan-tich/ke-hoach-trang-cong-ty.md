# Kế hoạch: Trang chi tiết công ty `/cong-ty/:slug` và không gian tuỳ biến cho nhà tuyển dụng

> **Trạng thái:** chủ dự án duyệt ngày 14/11/2026. Quyết định kiến trúc ghi tại
> [ADR-0017](../02-tong-quan/adr-0017-company-page.md); quyết định sản phẩm ghi
> tại ER-D58 đến ER-D64 trong
> [decision log](../02-tong-quan/employer-remediation-decision-log.md). Tiến độ
> từng giai đoạn nằm ở [TIEN-DO-DU-AN.md](../TIEN-DO-DU-AN.md).

## 1. Bối cảnh

Danh bạ công ty (`/cong-ty`, `/cong-ty/tim-kiem`) đã có, nhưng mọi thẻ công ty chỉ dẫn về `/viec-lam?search=<tên>&search_by=company` (khớp tên dạng văn bản). Chưa có trang chi tiết, chưa có endpoint chi tiết công khai, và danh sách việc làm chưa lọc được theo mã công ty. Nhà tuyển dụng (NTD) cũng chưa có nơi nào để trình bày thương hiệu ngoài form hồ sơ pháp lý.

Mục tiêu: một trang công ty công khai hiện đại, đồng bộ với trang chi tiết tin, hữu ích cho ứng viên (tìm hiểu, lọc tin, theo dõi, báo cáo) và cho NTD (tuỳ biến có kiểm soát, có phân quyền).

**Logic danh bạ hiện tại** (giữ nguyên, chỉ bổ sung loại công ty bị tạm ẩn):

- Không từ khoá: top 18 công ty có người đại diện đã xác thực + logo + ảnh bìa + ngành + ít nhất một tin công khai; xếp theo số tin rồi xáo ngẫu nhiên.
- Có từ khoá: mọi công ty khớp tên/tên thương mại (không dấu), phân trang cursor theo `slug`, không qua điều kiện nào.

## 2. Quyết định đã chốt với chủ dự án

| # | Chủ đề | Quyết định |
|---|---|---|
| 1 | Ai được tuỳ biến | Owner có hồ sơ xác thực NTD đã duyệt cho đúng công ty, cộng member đã xác thực được owner uỷ quyền "Biên tập trang công ty" |
| 2 | Phạm vi quyền | Chỉ áp cho phần mới (bố cục + nội dung mới). Luật cũ giữ nguyên (ER-D05: mọi member gửi được yêu cầu sửa mô tả/phúc lợi; owner tải ảnh). Người được uỷ quyền được tải ảnh thêm |
| 3 | Kiểm duyệt | Lai: nội dung (chữ, ảnh, video, liên kết, văn phòng) qua `CompanyUpdateRequest` chờ admin duyệt; bố cục (bật/tắt, thứ tự khối, màu nhấn, tin ghim) áp dụng ngay |
| 4 | Mức tuỳ biến | Bộ khối định sẵn; bật/tắt, sắp xếp, chọn màu nhấn từ bảng màu có sẵn, có xem trước. Không dựng trang kéo-thả tự do |
| 5 | Tính năng ứng viên | Theo dõi công ty, báo cáo thông tin sai, email việc mới từ công ty đang theo dõi. Không làm đánh giá công ty |
| 6 | Kênh thông báo | Email gộp qua hạ tầng digest đã có, bật sẵn khi theo dõi; tắt được theo từng công ty và tắt chung |
| 7 | Công ty nào có trang | Mọi công ty không bị tạm ẩn đều có trang. Chỉ index + vào sitemap khi: có người đại diện đã xác thực, có ngành, và có mô tả hoặc tin đang tuyển |

Không hiển thị huy hiệu xác thực cấp công ty (ER-D52). Không có gói trả phí (ADR-0015).

## 3. Trải nghiệm

### 3.1. Trang công khai `/cong-ty/:slug`

Dùng lại ngôn ngữ thiết kế của trang chi tiết tin: nền `bg-[#f5f7f8]`, khung `max-w-6xl`, lưới `lg:grid-cols-[minmax(0,1fr)_320px]`, thẻ `rounded-2xl border bg-white shadow-sm`, tiêu đề khối `border-l-4`, sidebar dính.

```
Trang chủ › Công ty › <Tên>
┌──────────────────────────────────────────────────────────────┐
│ Ảnh bìa (thiếu thì dùng dải màu nhấn)                        │
│ [Logo] Tên hiển thị · tên pháp lý (nếu khác)                 │
│        Khẩu hiệu · ngành · quy mô · N việc làm · N theo dõi  │
│        [Theo dõi] [Chia sẻ] [Website] [⋯ Báo cáo]            │
├──────────────────────────────────────────────────────────────┤
│ Tổng quan | Việc làm (N)                                     │
├───────────────────────────────────┬──────────────────────────┤
│ Giới thiệu                        │ Thông tin chung          │
│ Việc làm đang tuyển (ghim + 5 tin │ Văn phòng                │
│   + ô tìm, lọc tỉnh)              │ Mạng xã hội              │
│ Phúc lợi (thẻ icon)               │ Chia sẻ                  │
│ Văn hoá                           │ Công ty cùng lĩnh vực    │
│ Thư viện ảnh · Video              │                          │
└───────────────────────────────────┴──────────────────────────┘
Di động: một cột, thanh CTA dính đáy (Theo dõi · Xem việc làm)
```

- Khối rỗng tự ẩn, không để tiêu đề trống. Công ty chỉ có tên + ngành vẫn phải trông hoàn chỉnh (hero + việc làm + thông tin chung + chia sẻ + công ty cùng lĩnh vực).
- Tab và bộ lọc là trạng thái URL (`?tab=viec-lam&q=&location=`), một route duy nhất; có bộ lọc thì `noindex`.
- Thẻ tin trong trang công ty bỏ logo và tên công ty (thừa), giữ lưu tin, lương, địa điểm.
- Màu nhấn chỉ áp cho chi tiết trang trí qua biến `--company-accent*`; nút hành động của nền tảng vẫn dùng màu thương hiệu.
- Video chỉ nhận YouTube/Vimeo, hiển thị dạng bấm-mới-tải (`youtube-nocookie`).
- Không bao giờ hiển thị: mã số thuế, email, số điện thoại, địa chỉ hộ kinh doanh, danh tính recruiter, trạng thái kiểm duyệt.
- Có Skeleton, trạng thái lỗi và trang 404 thật.

### 3.2. Không gian NTD "Trang công ty" (`/tuyendung/app/company-page`)

Mục mới trên menu, ba tab điều khiển bên trái và xem trước trực tiếp bên phải (dưới `xl` thì xem trước mở trong drawer, có nút chuyển desktop/di động):

- **Bố cục** (áp dụng ngay): danh sách khối có công tắc và kéo-thả đổi thứ tự (kèm nút lên/xuống cho bàn phím), bảng màu nhấn, chọn tối đa 3 tin ghim.
- **Nội dung** (chờ duyệt): khẩu hiệu, giới thiệu, văn hoá, phúc lợi dạng thẻ, video, mạng xã hội, văn phòng, logo/ảnh bìa/thư viện ảnh. Mỗi khối hiện nhãn trạng thái (Đã công khai / Chờ duyệt / Cần bổ sung). Có thước đo độ hoàn thiện.
- **Người biên tập** (chỉ owner đã xác thực): danh sách member, cấp/thu hồi quyền; member chưa xác thực không cấp được.

Người không đủ quyền vào được ở chế độ chỉ xem, kèm lý do và đường dẫn tới bước xác thực. Trang cài đặt hồ sơ công ty cũ giữ nguyên, thêm liên kết hai chiều.

### 3.3. Ứng viên

- Nút **Theo dõi** (khách bấm thì mời đăng nhập), trang `/tai-khoan/cong-ty-dang-theo-doi`, công tắc "nhận email việc mới" theo từng công ty. NTD chỉ thấy tổng số người theo dõi.
- **Báo cáo thông tin sai**: modal chọn lý do + khối liên quan, theo khuôn mẫu báo cáo tin.
- **Email việc mới**: nguồn thứ ba của digest hiện có; chỉ gồm tin đăng sau thời điểm theo dõi; tôn trọng cài đặt email chung và công tắc toàn site.

### 3.4. Admin

- Tab "Trang công khai" trong chi tiết công ty: xem trước, **tạm ẩn trang** kèm lý do (trang trả 404 thật, bị loại khỏi danh bạ, sitemap, gợi ý).
- Hàng chờ báo cáo công ty (xử lý, đảo quyết định, tuỳ chọn tạm ẩn).
- Màn so sánh yêu cầu cập nhật hiện có hiển thị thêm các trường mới.

## 4. Thiết kế kỹ thuật

### 4.1. Mô hình dữ liệu (chỉ migration cộng thêm, từ `employers/0048`)

| Nội dung | Lưu ở đâu | Lý do |
|---|---|---|
| `headline` (160), `culture` (rich text), `video_url`, `social_links` (JSON khoá cố định) | Cột trên `Company` | Pipeline duyệt áp và so xung đột bằng `setattr/getattr` trên `Company`, không cần máy móc mới |
| Phúc lợi dạng thẻ | Bảng `CompanyBenefit` (FK tới danh mục `jobs.Benefit`, ghi chú ≤160, thứ tự; tối đa 8) | Dùng lại danh mục và icon do admin quản lý |
| Văn phòng | Bảng `CompanyOffice` (nhãn, địa chỉ, tỉnh → `Location`, trụ sở chính, thứ tự; tối đa 10) | Lọc theo tỉnh và JSON-LD. Không backfill từ `Company.address` vì sẽ lộ địa chỉ hộ kinh doanh |
| Bố cục | Bảng `CompanyPageSettings` (O2O; `section_order`, `hidden_sections`, `accent`, `lock_version`) | Không đụng `Company.updated_at` (đang là khoá chống ghi đè của yêu cầu cập nhật) |
| Tin ghim | Bảng `CompanyPinnedJob` (tối đa 3) | Không ghi vào `Job`, giữ ranh giới tenant `posted_by` |
| Uỷ quyền | Bảng `CompanyPageEditorGrant` (cấp bởi, thu hồi bởi, lý do) | Có lịch sử; không thêm cờ vào `RecruiterProfile` |
| Theo dõi | Bảng `CompanyFollow` (`notify_new_jobs`) + `Company.follower_count` cập nhật bằng `F()` | Không `COUNT(*)` thời gian thực |
| Báo cáo | `CompanyReport` + `CompanyReportResolutionEvent` (nhân bản từ `jobs/models/report.py`, thêm `section_key`) | Khuôn mẫu đã có |
| Tạm ẩn | `Company.content_policy_hold`, `page_updated_at` | Đọc rẻ ở mọi nơi; lý do nằm trong nhật ký |
| Nhật ký thay đổi tức thì | Bảng `CompanyPageEvent` chỉ-ghi-thêm | Bố cục không qua admin nên cần dấu vết |

**Registry khối** tại `backend/apps/employers/page_registry.py` (cùng kiểu `cv_templates/section_registry.py`), phục vụ qua API, frontend không giữ bản sao:

- Vùng chính, sắp xếp được: `about`, `jobs`, `benefits`, `culture`, `gallery`, `video`.
- Sidebar, thứ tự cố định: `general_info`, `offices`, `social_links`, `share`, `similar_companies`.
- Luôn bật: `hero`, `jobs`, `general_info`, `share`, `similar_companies`.
- Bảng màu nhấn: `brand` (mặc định) + 7 màu đã kiểm tương phản AA.

### 4.2. Phân quyền

Một module chính sách duy nhất: `backend/apps/employers/models/page_access.py`.

- Chuyển `_eligible_representatives_queryset` từ `selectors/companies.py` xuống `models/representation.py` (import-linter cấm `services` gọi `selectors`; tiền lệ là `models/readiness.py`).
- `resolve_company_page_access(recruiter)` trả `CompanyPageAccess(can_view, can_edit_layout, can_edit_content, can_manage_editors, blockers[])`.
  - `can_manage_editors` = owner và đủ điều kiện đại diện.
  - `can_edit_*` = như trên, hoặc member đủ điều kiện + có grant còn hiệu lực + công ty vẫn có owner đủ điều kiện.
- Tính tại thời điểm request: hồ sơ xác thực hết hiệu lực hoặc tài khoản bị khoá thì mất quyền ngay, không cần job nền. Admin gỡ liên kết thì `confirm_company_unlink` thu hồi grant.
- Áp quyền: trường mới trong `CompanyUpdateRequestSerializer.validate_changes` cần `can_edit_content`; media đổi từ `_require_owner` thành "owner (luật cũ) hoặc người biên tập còn hiệu lực" (chỉ mở rộng, test cũ vẫn đúng).
- Mọi response của workspace kèm `permissions` do server tính; frontend không đọc `company_role`.

### 4.3. API

**Công khai** (`/api/companies/`, mở rộng `urls_public.py`):

- `GET <slug>/`: DTO dạng khối có kiểu từ một builder duy nhất `build_public_company_profile(company, overrides=None)` (`selectors/company_page.py`). Frontend chỉ đọc `sections[].type`, không suy từ tên cột.
- `GET <public_id>/similar/`, `GET <public_id>/job-facets/` (tải lười).
- `GET|PUT|DELETE <public_id>/follow/` (ứng viên, idempotent), `POST <public_id>/reports/`.
- `GET /api/candidate/followed-companies/`.

**Việc làm**: `filter_job_list_queryset` (`jobs/selectors/listing.py`) thêm `?company=<public_id>` (0 query phát sinh, giữ nguyên ngân sách); `JobSerializer` thêm `company_slug`.

**NTD** (`/api/employer/company/page/`):

- `GET ""`: `permissions`, `registry`, `layout`, `published`, `preview` (cùng builder, phủ thay đổi đang chờ), `pending`, `completeness`, `stats`.
- `PATCH layout/`: khoá lạc quan bằng `lock_version` (409 khi cũ), ghi `CompanyPageEvent`.
- `GET pinnable-jobs/`: chỉ siêu dữ liệu công khai qua `Job.publicly_available_queryset()`.
- `POST content/`: tách thân `CompanyUpdateRequestListCreateView.create` thành service `submit_company_update_request(..., merge=True)` để gộp vào yêu cầu đang mở của người gửi (ER-D48: mỗi người một yêu cầu đang mở).
- `GET|POST editors/`, `DELETE editors/<id>/`: phát thông báo cho NTD liên quan.

**Admin**: `public-page/`, `policy-hold/` trên `AdminCompanyViewSet`; `AdminCompanyReportViewSet`. Quyền mới `company_page.moderate`, `company_report.view`, `company_report.resolve` (đăng ký trong `admin_permissions.py`, gán phòng ban, seed bằng `accounts/0032`). Mọi thao tác gọi `record_admin_action`.

Tất cả endpoint mới có throttle riêng và test ngân sách query (phẳng ở N=1 và N=25).

### 4.4. SEO shell

- `backend/apps/employers/urls_seo.py`: `cong-ty/<slug>` và `sitemaps/companies.xml`, include sau `apps.sitecontent.urls_seo`; thêm `tim-kiem` vào tập slug dành riêng.
- View theo mẫu `jobs/api/views/seo.py`, dùng `common/seo.py`: title, description, canonical, robots, OG/Twitter, JSON-LD `Organization` (không mã số thuế, địa chỉ chỉ với doanh nghiệp) + `BreadcrumbList`.
- Slug lạ hoặc bị tạm ẩn: HTTP 404 thật.
- Repo không còn cấu hình nginx, nên yêu cầu "route nginx" được đáp ứng bằng ghi chú trong tài liệu triển khai.

### 4.5. Frontend (FSD)

| Slice | Nội dung |
|---|---|
| `entities/company` (mở rộng) | API chi tiết/tương tự/facets, keys, `companyDetailPath()`, bộ hiển thị dùng chung `CompanyProfileView` + `CompanySectionRenderer` (cho trang công khai, xem trước NTD và xem trước admin; widget không được import chéo nhau) |
| `shared/ui` | `RichContent` (tách từ `entities/job/JobRichContent`, luôn qua `sanitizeHtml`), `ShareButtons` (tách từ `JobShareRail`) |
| `widgets/public-company-profile` (mới) | Trang công khai, tab việc làm, thẻ tin rút gọn, công ty tương tự, CTA di động, skeleton, not-found |
| `features/follow-company`, `report-company`, `review-company-reports` (mới) | Theo dõi (optimistic + rollback), modal báo cáo, hàng chờ admin |
| `features/customize-company-page`, `manage-company-page-editors` (mới) | Danh sách khối (`@dnd-kit` đã cài), bảng màu, tin ghim, form nội dung, trạng thái chờ duyệt, thước hoàn thiện, phân quyền |
| `widgets/employer-company-page` (mới) | Ba tab + xem trước |
| `entities/employer-company-page`, `entities/company-report` (mới) | API workspace và báo cáo |

Trang và route: `pages/main/companies/CompanyDetail.jsx`, `pages/main/account/FollowedCompanies.jsx`, `pages/employer/app/CompanyPage.jsx`; đăng ký qua `app/router/lazy/*.pages.jsx` và `routes/*.routes.jsx`; cập nhật `route-metadata.js`, `document-title.js`, menu NTD, menu tài khoản ứng viên.

Thay mọi liên kết theo tên bằng `companyDetailPath`: `CompanyCard`, `SearchCompanyCard`, `TopEmployersSidebar`, `JobDetailSidebar`, `JobQuickView`, `FeaturedEmployers`, `EmployerLogoBelt`.

Ba file đã chạm trần 300 dòng (`employer-profile.api.js`, `AdminCompanyDetail.jsx`, `CompanyForm.jsx`): mọi phần mới nằm ở file/slice mới.

## 5. Lộ trình (mỗi giai đoạn một PR, đủ CI mới mở PR)

| Giai đoạn | Phạm vi | Phụ thuộc | Cỡ |
|---|---|---|---|
| **CP-0** Nền móng | Chuyển predicate đại diện xuống models; `?company=`; `company_slug`; slug dành riêng; tách `RichContent`/`ShareButtons`/`CompanyLogo`; thống nhất ẩn địa chỉ hộ kinh doanh qua helper `public_headquarters()`; ADR-0017 | — | Nhỏ–vừa |
| **CP-1** Read model + SEO (backend) | Migration tạm ẩn; registry + builder; endpoint chi tiết/tương tự/facets; quyền admin + tạm ẩn; SEO shell + sitemap; danh bạ loại công ty bị ẩn; cập nhật seed | CP-0 | Vừa–lớn |
| **CP-2** Trang công khai (frontend) | Entity UI, widget, route, metadata, thay liên kết, tab admin "Trang công khai" | CP-1 | Lớn |
| **CP-3** Theo dõi | `CompanyFollow`, bộ đếm, endpoint, trang "đang theo dõi" | CP-2 | Vừa |
| **CP-4** Báo cáo | Model, endpoint, quyền, hàng chờ admin, modal | CP-2 | Vừa |
| **CP-5** Phân quyền + bố cục tức thì | Bốn bảng, module chính sách, endpoint layout/tin ghim/người biên tập, mở rộng luật media, workspace (tab Bố cục, Người biên tập, xem trước) | CP-2 | Lớn |
| **CP-6** Nội dung qua kiểm duyệt | Cột/bảng nội dung, mở rộng pipeline + endpoint gộp, màn so sánh admin, form nội dung, trạng thái chờ duyệt, độ hoàn thiện, tải ảnh bìa | CP-5 | Lớn |
| **CP-7** Email người theo dõi | Nguồn digest thứ ba, tuỳ chọn `followed_company_jobs`, công tắc ở frontend | CP-3 | Vừa, rủi ro cao nhất |

CP-3, CP-4, CP-5 độc lập với nhau.

**Triển khai an toàn**: cờ `COMPANY_PAGE_PUBLIC_ENABLED` và `COMPANY_PAGE_INDEX_ENABLED` theo tiền lệ `KNOWLEDGEBASE_PUBLIC_ENABLED`. CP-1 merge với cờ công khai tắt; bật sau CP-2; bật index sau khi kiểm tra dữ liệu seed và nội dung thật.

**Tài liệu cập nhật theo từng PR**: `docs/TIEN-DO-DU-AN.md` (bảng "Trang công ty (CP)"), `frontend/ARCHITECTURE.md` (thay dòng 312–315, thêm ownership map), `docs/01-phan-tich/dac-ta-nha-tuyen-dung.md`, decision log (ER-D58 trở đi), bổ sung ADR-0013, `docs/04-api/tai-lieu-api.md`.

## 6. Ràng buộc đã kiểm chứng trong code

- `Company.updated_at` là khoá chống ghi đè của yêu cầu cập nhật (`api/views/verification.py:449`): bố cục, bộ đếm theo dõi và tạm ẩn phải ghi bằng `.update()`/bảng riêng, không `save()` Company.
- Mỗi người chỉ có một yêu cầu đang mở và `in_review` thì khoá: sửa nội dung theo từng khối phải gộp ở server; khi đang thẩm định hiển thị khoá "Đang thẩm định".
- Owner trong test và seed chưa xác thực: seed cần tạo hồ sơ xác thực đã duyệt để có công ty index được và để thử workspace.
- Job DTO chưa có slug công ty; `tim-kiem` phải là slug dành riêng.
- `jobs/api/serializers/jobs.py:492` trả địa chỉ thô của công ty, kể cả hộ kinh doanh, trong khi danh bạ đã ẩn. CP-0 thống nhất qua một helper; lưu ý việc này đổi hiển thị địa chỉ ở trang chi tiết tin của hộ kinh doanh.
- Ứng viên không có thông báo trong ứng dụng; kênh duy nhất là digest email (`jobs/services/digests.py`).

## 7. Kiểm chứng

**Mỗi giai đoạn, trước khi mở PR:**

- Backend (chạy qua `docker exec`, không chạy `manage.py` trên host): `ruff check . && ruff format --check . && lint-imports && python manage.py makemigrations --check --dry-run && pytest --cov --cov-fail-under=84`.
- Frontend: script ranh giới, `npm run lint`, `npm run check:architecture`, unit test + ratchet độ phủ, `npm run build`, ngân sách bundle, e2e smoke (chạy cục bộ với `PLAYWRIGHT_PORT=5180` + `VITE_API_BASE_URL`).

**Test trọng tâm theo giai đoạn:**

- CP-1: snapshot khoá danh sách trường của DTO công khai (chống rò rỉ); ngân sách query phẳng; tạm ẩn → 404; `test_seo.py` (title, description, canonical, robots, 404, sitemap, `Organization`, `BreadcrumbList`, thoát `</script>`, hộ kinh doanh không có địa chỉ).
- CP-2: e2e ba viewport (vào thẳng URL, đổi tab, lọc, không tràn ngang, 404); kiểm tra trực quan trên trình duyệt xem trước ở desktop/tablet/di động, gồm trạng thái công ty sơ sài.
- CP-3: test đồng thời cho follow (PUT idempotent, `follower_count` khớp `COUNT(*)`), rollback optimistic.
- CP-5: ma trận quyền (owner xác thực/chưa, member có/không grant, xác thực hết hiệu lực, khách) trên mọi endpoint; `lock_version` cũ → 409; bố cục không đổi `Company.updated_at`; picker tin ghim không lộ dữ liệu ứng tuyển.
- CP-6: chặn trường theo quyền; gộp không làm mất khoá khác; XSS (`<script>`, `javascript:`, host video/mạng xã hội ngoài danh sách); test vòng đời yêu cầu cập nhật cũ không đổi.
- CP-7: một tin không bao giờ gửi hai lần; tin đăng trước khi theo dõi bị loại; tắt nhận và công tắc toàn site; công ty bị ẩn bị loại.

**Kiểm chứng đầu-cuối sau CP-6**: NTD đã xác thực sửa bố cục → thấy ngay trên trang công khai; sửa nội dung → hiện "Chờ duyệt", admin duyệt → nội dung lên trang; member chưa được uỷ quyền bị chặn; `curl` URL công ty trả HTML có đủ meta và JSON-LD.

## 8. Mặc định đã chọn (báo lại nếu muốn đổi)

- Owner chưa xác thực thì không ai trong công ty tuỳ biến được, kể cả member đã xác thực; workspace hiện lý do và đường dẫn tới bước xác thực.
- Nội dung trang dùng chung một yêu cầu cập nhật với thay đổi pháp lý của cùng người gửi; chưa tách loại yêu cầu.
- Không backfill văn phòng từ `Company.address`; sidebar dùng giá trị trụ sở đã ẩn hộ kinh doanh.
- Tạm ẩn trang làm công ty biến mất khỏi cả tìm kiếm danh bạ (bổ sung ADR-0013).
