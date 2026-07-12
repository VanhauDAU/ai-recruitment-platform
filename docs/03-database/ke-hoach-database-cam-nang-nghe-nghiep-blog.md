# Kế hoạch thiết kế database — Cẩm nang nghề nghiệp (Blog)

**Trạng thái:** Kế hoạch — chưa triển khai
**Phạm vi:** Bài viết blog tại `/blog`, danh mục bài viết, thẻ (tag), khối "Tài liệu hỗ trợ tìm việc", banner sidebar, phân quyền quản trị nội dung
**Nguồn đối chiếu:** Tài liệu "Mô tả cẩm nang nghề nghiệp - BLOG" ngày 12/07/2026, tham chiếu giao diện TopCV (`/nhan-vien-sales-la-gi`)

## 1. Mục tiêu thiết kế

1. Trang danh sách `/blog` hiển thị bài viết theo danh mục (thanh danh mục nằm ngang), mỗi card có ảnh thumb, tiêu đề, ngày đăng, tên danh mục.
2. Trang chi tiết có URL slug đẹp kiểu TopCV, breadcrumb `Trang chủ > Cẩm nang nghề nghiệp > <Danh mục> > <Bài viết>`, nội dung rich-text (ảnh, in đậm, liệt kê, bảng, button có URL), mục lục, thẻ, khối "Đọc thêm" và job list liên quan.
3. Cột phải cấu hình được qua admin: "Tài liệu hỗ trợ tìm việc" (danh sách bài viết ghim), banner quảng cáo có 2 nút CTA — không hard-code ở frontend.
4. Admin/nhân viên quản trị bài viết và danh mục với quyền khác nhau (biên tập viên soạn, quản lý duyệt & xuất bản).
5. Tái dùng tối đa hạ tầng sẵn có: `sitecontent.Banner`, `JobCategory`, quy ước `public_id`, slug, storage key cho ảnh, seed command.
6. Không tạo bảng cho những thứ suy ra được từ dữ liệu khác (mục lục, breadcrumb, nút chia sẻ).

## 2. Ánh xạ yêu cầu → dữ liệu

| Yêu cầu trong tài liệu | Nguồn dữ liệu | Ghi chú |
|---|---|---|
| Danh mục bài viết (6 danh mục ban đầu) | Bảng mới `blog_postcategory` | Seed 6 danh mục; thanh ngang lấy từ API danh mục |
| Card bài viết: ảnh thumb, tiêu đề, ngày, tên danh mục | `blog_post` (FK category) | `thumbnail_url` lưu storage key theo quy ước media hiện có |
| URL chi tiết kiểu `nhan-vien-sales-la-gi` | `blog_post.slug` unique | Xem mục 5 về chiến lược URL |
| Breadcrumb | Suy từ `post.category` | Không cần bảng |
| Mục lục (TOC, bấm di chuyển, thu gọn) | Sinh từ heading trong `content` ở frontend | Không lưu DB |
| Nội dung: ảnh, đậm, liệt kê, button, bảng | `blog_post.content` (HTML rich-text) | Ảnh trong bài upload qua endpoint riêng (mục 4.2) |
| ">> Đọc thêm: ..." link bài khác | Link chèn trong nội dung bằng editor | Không cần bảng quan hệ riêng ở giai đoạn này |
| Job list "Danh sách việc làm Nhân viên kinh doanh" + nút xem tất cả | `blog_post.related_job_category` FK → `jobs.JobCategory` | Frontend gọi API jobs theo category; null = ẩn khối |
| Thẻ (vd: kinh doanh) | Bảng mới `blog_tag` + M2M `blog_post_tags` | |
| Thẻ tìm việc ngay (input + dropdown tỉnh/thành) | Tái dùng API jobs + `locations` sẵn có | Không cần bảng |
| Tài liệu hỗ trợ tìm việc (cấu hình được) | Bảng mới `blog_pinnedpost` | Xem mục 4.4 — đây là cách chuẩn được đề xuất |
| Banner quảng cáo (2 nút: Tạo CV + Tìm việc ngay) | Mở rộng `sitecontent.Banner`: thêm placement `blog_sidebar` + cặp CTA phụ | Xem mục 4.5 |
| Nhân viên có quyền khác nhau quản lý bài viết | Django Groups + Permissions, `author`/`status` trên bài viết | Xem mục 6 |

## 3. App Django mới: `apps/blog`

Tạo app riêng `backend/apps/blog` (không nhét vào `sitecontent`) vì blog có vòng đời nội dung, phân quyền và API riêng; `sitecontent` giữ vai trò cấu hình giao diện chung. Cấu trúc theo chuẩn dự án: `models.py`, `admin.py`, `selectors/`, `serializers.py`, `views.py`, `urls.py`, `management/commands/seed_blog.py`.

## 4. Thiết kế bảng chi tiết

### 4.1. `blog_postcategory` — Danh mục bài viết

| Trường | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | BigAutoField | PK | |
| `name` | CharField(150) | NOT NULL | Vd: "Kiến thức chuyên ngành" |
| `slug` | SlugField(160) | UNIQUE, auto từ `name` | Dùng cho URL `/blog/danh-muc/<slug>` và SEO |
| `description` | CharField(300) | blank | Mô tả ngắn, dùng cho meta description trang danh mục |
| `order` | PositiveSmallIntegerField | default 0 | Thứ tự trên thanh danh mục ngang |
| `is_active` | BooleanField | default True | Tắt danh mục mà không xóa bài |
| `seo_title` | CharField(200) | blank | Ghi đè title tag nếu cần |
| `created_at` | DateTimeField | auto_now_add | |

- `Meta.ordering = ['order', 'name']`.
- **Không dùng parent tự tham chiếu**: breadcrumb trong tài liệu chỉ có 1 cấp danh mục (`Trang chủ > Cẩm nang > Danh mục > Bài viết`), và TopCV cũng vận hành taxonomy blog phẳng. Thêm cây danh mục là YAGNI; nếu sau này cần thì thêm cột `parent` bằng 1 migration không phá vỡ gì.
- **Không FK sang `JobCategory`**: "Kiến thức chuyên ngành" ở blog trùng tên với `CategoryType.DOMAIN` của jobs nhưng là 2 taxonomy khác mục đích (biên tập nội dung ≠ phân loại tin tuyển dụng). Liên kết job chỉ nằm ở từng bài viết (mục 4.2).

### 4.2. `blog_post` — Bài viết

| Trường | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | BigAutoField | PK | |
| `public_id` | CharField(50) | UNIQUE, prefix `ps` | `generate_public_id('ps')`, dùng cho admin API |
| `title` | CharField(255) | NOT NULL | |
| `slug` | SlugField(255) | UNIQUE | Auto từ `title`, **cho phép admin sửa tay** để tối ưu SEO (vd `nhan-vien-sales-la-gi`); xem mục 5 |
| `category` | FK → `blog_postcategory` | PROTECT, NOT NULL | PROTECT để không xóa danh mục còn bài |
| `author` | FK → `users` | SET_NULL, null | Nhân viên soạn bài; giữ bài khi xóa tài khoản |
| `summary` | CharField(500) | blank | Sapo/mô tả ngắn: card danh sách + meta description |
| `thumbnail_url` | TextField | blank | **Storage key** theo quy ước media của dự án, API resolve thành URL public |
| `content` | TextField | NOT NULL | HTML từ rich-text editor (ảnh, bảng, button, heading để sinh TOC) |
| `related_job_category` | FK → `jobs.JobCategory` | SET_NULL, null, blank | Nguồn cho khối "Danh sách việc làm ..." trong bài; null = không hiển thị khối |
| `status` | CharField(20) | choices, default `draft` | `draft` / `pending` / `published` / `archived` |
| `published_at` | DateTimeField | null, blank | Set lần đầu khi chuyển `published`; là "ngày đăng" hiển thị (thứ, ngày, giờ) |
| `view_count` | PositiveIntegerField | default 0 | Tăng qua service (F-expression), có debounce cache như jobs |
| `seo_title` | CharField(200) | blank | Ghi đè title tag |
| `seo_description` | CharField(300) | blank | Ghi đè meta description (mặc định dùng `summary`) |
| `created_at` | DateTimeField | auto_now_add | |
| `updated_at` | DateTimeField | auto_now | Hiển thị "Cập nhật lần cuối" nếu cần |

Vòng đời `status`:

```
draft ──(biên tập viên gửi duyệt)──> pending ──(quản lý duyệt)──> published ──> archived
  ▲                                     │                             │
  └────────(trả về sửa)─────────────────┘        (gỡ bài, giữ dữ liệu)┘
```

- **Không soft-delete bằng cột `deleted`**: `archived` đã phủ nhu cầu "gỡ bài nhưng giữ nội dung"; xóa hẳn chỉ làm trong Django admin.
- **Mục lục không lưu DB**: sinh từ thẻ `h2`/`h3` trong `content` ở frontend (thư viện hoặc parse đơn giản), luôn khớp nội dung, không lo lệch dữ liệu.
- **Ảnh trong nội dung bài**: thêm endpoint upload riêng cho editor (`POST /api/admin/blog/uploads`), trả URL public và chèn thẳng vào HTML. Khác với `thumbnail_url` (storage key, resolve lúc trả API), ảnh nội dung nằm trong HTML nên lưu URL cuối cùng — đổi CDN sau này xử lý bằng rewrite khi render, chấp nhận trade-off này để không phải parse HTML mỗi request.

Index & constraint:

```python
indexes = [
    models.Index(fields=['status', '-published_at']),            # trang danh sách
    models.Index(fields=['category', 'status', '-published_at']),# lọc theo danh mục
]
constraints = [
    models.CheckConstraint(
        check=models.Q(status__in=['draft', 'pending', 'published', 'archived']),
        name='chk_blog_post_status',
    ),
    # Bài đã published bắt buộc có published_at
    models.CheckConstraint(
        check=~models.Q(status='published') | models.Q(published_at__isnull=False),
        name='chk_blog_post_published_at',
    ),
]
```

### 4.3. `blog_tag` + M2M `blog_post_tags` — Thẻ

| Trường | Kiểu | Ràng buộc |
|---|---|---|
| `id` | BigAutoField | PK |
| `name` | CharField(100) | NOT NULL |
| `slug` | SlugField(120) | UNIQUE, auto từ `name` |

- Trên `Post`: `tags = models.ManyToManyField(Tag, related_name='posts', blank=True)` — Django tự tạo bảng trung gian `blog_post_tags` với UNIQUE(post, tag), không cần model through vì không có thuộc tính phụ.
- Tag có `slug` để làm trang lọc `/blog/tag/<slug>` sau này.

### 4.4. `blog_pinnedpost` — Bài viết ghim theo vị trí (khối "Tài liệu hỗ trợ tìm việc")

Đây là câu trả lời cho câu hỏi trong tài liệu mô tả ("mục này có cấu hình thì phải để hiển thị hay là dùng cách nào... cho cách làm chuẩn nhất"). Ba phương án đã cân nhắc:

| Phương án | Đánh giá |
|---|---|
| Hard-code danh sách link ở frontend | Loại — vi phạm nguyên tắc admin cấu hình được của dự án |
| Tái dùng `sitecontent.LinkGroup/LinkItem` (thêm placement mới) | Không chọn — `LinkItem` lưu label + url nhập tay, khi đổi tiêu đề/slug bài viết thì link mòn (stale); LinkGroup sinh ra cho footer, trộn thêm ngữ cảnh blog làm mờ trách nhiệm |
| **Bảng ghim trỏ FK trực tiếp vào bài viết** | **Chọn** — label/url luôn khớp bài viết thật, bài gỡ xuống thì tự ẩn, admin chỉ chọn bài + kéo thứ tự |

| Trường | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | BigAutoField | PK | |
| `placement` | CharField(30) | choices, default `support_docs` | `support_docs` = "Tài liệu hỗ trợ tìm việc" (sidebar chi tiết bài viết). TextChoices để sau này thêm vị trí ghim khác (vd: bài nổi bật trang chủ blog) |
| `post` | FK → `blog_post` | CASCADE | Bài được ghim |
| `order` | PositiveSmallIntegerField | default 0 | |
| `is_active` | BooleanField | default True | |

- `UniqueConstraint(fields=['placement', 'post'], name='uq_blog_pinned_placement_post')` — một bài không ghim 2 lần cùng chỗ.
- Selector chỉ trả bài có `status='published'`; bài bị gỡ tự biến mất khỏi sidebar.
- Tiêu đề khối ("Tài liệu hỗ trợ tìm việc") đưa vào `SiteSetting` key `blog_support_docs_title` (group mới `BLOG = 'blog'`) để admin đổi chữ không cần deploy.

### 4.5. Mở rộng `sitecontent.Banner` — Banner sidebar bài viết

Banner cột phải có **2 nút** (Tạo CV + Tìm việc ngay) trong khi `Banner` hiện chỉ có 1 cặp `cta_label/cta_url`. Mở rộng thay vì tạo bảng mới:

1. Thêm placement: `BLOG_SIDEBAR = 'blog_sidebar', 'Banner sidebar bài viết cẩm nang'`.
2. Thêm 2 cột optional: `cta_secondary_label = CharField(100, blank=True)`, `cta_secondary_url = CharField(300, blank=True)` — các banner cũ không bị ảnh hưởng, banner nào cần 2 nút thì điền thêm.

Migration nằm trong app `sitecontent`, độc lập với app `blog`.

### 4.6. Những thứ cố tình KHÔNG có bảng

| Hạng mục trong mô tả | Lý do không cần DB |
|---|---|
| Breadcrumb | Suy từ category của bài |
| Mục lục | Sinh từ heading trong `content` |
| Sticky share (copy link, FB, in, Twitter) | Thuần frontend |
| Thẻ tìm việc ngay (input + dropdown tỉnh) | Dùng API jobs + `locations` sẵn có |
| Danh sách việc làm trong bài | Query API jobs theo `related_job_category` |
| "Đọc thêm" giữa bài | Link chèn bằng editor trong `content` |

## 5. Chiến lược URL & slug

- TopCV dùng slug ở root domain (`topcv.vn/nhan-vien-sales-la-gi`). **Khuyến nghị dùng `/blog/<slug>`** thay vì root: tránh đụng độ với mọi route hiện tại và tương lai của SPA (`/jobs`, `/companies`, ...), router không cần catch-all rủi ro, sitemap/analytics tách bạch. SEO khác biệt giữa 2 kiểu là không đáng kể so với chi phí rủi ro route.
- Cấu trúc route candidate:
  - `/blog` — trang danh sách (tất cả + thanh danh mục ngang)
  - `/blog/danh-muc/<category_slug>` — lọc theo danh mục
  - `/blog/<slug>` — chi tiết bài viết
- `slug` bài viết: auto-slugify từ `title` khi tạo, **không gắn đuôi public_id** (khác với Job) vì URL blog cần sạch cho SEO; UNIQUE ở DB, nếu trùng thì admin sửa tay (validate ở serializer báo lỗi rõ). Đã published thì hạn chế đổi slug (admin cảnh báo) vì đổi là gãy link đã index.

## 6. Phân quyền quản trị nội dung

Không thêm bảng role riêng — dùng đúng hệ Django Groups + Permissions sẵn có (nhất quán với nhóm setting `admin_roles` hiện tại):

| Nhóm (Group) | Quyền | Phạm vi |
|---|---|---|
| **Biên tập viên** (`blog_editor`) | `add_post`, `change_post`, `view_post` | Chỉ tạo/sửa bài của mình khi `status` ∈ {draft, pending}; gửi duyệt (draft → pending). Chặn tự publish ở admin/API bằng logic, không cần bảng |
| **Quản lý nội dung** (`blog_manager`) | Toàn bộ quyền trên `Post`, `PostCategory`, `Tag`, `PinnedPost` | Duyệt & xuất bản (pending → published), trả bài, gỡ bài, quản lý danh mục/thẻ/ghim |

- `Post.author` tự gán = user tạo bài; queryset trong admin của biên tập viên lọc `author=request.user`.
- Ai được publish quyết định bằng permission tùy chỉnh `can_publish_post` (khai báo trong `Meta.permissions` của `Post`) — chuẩn Django, hiển thị được trong trang gán quyền.
- User giữ nguyên `role='admin'` để vào được trang quản trị; Groups quyết định làm được gì bên trong.

## 7. Sơ đồ quan hệ

```
users ──< blog_post >── blog_postcategory
              │  \
              │   \──> jobs_jobcategory (related_job_category, null)
              │
              ├──< blog_post_tags >── blog_tag
              │
              └──< blog_pinnedpost (placement, order)

sitecontent_banner (placement='blog_sidebar', + cta_secondary_*)
sitecontent_sitesetting (group='blog': blog_support_docs_title, ...)
```

## 8. Seed dữ liệu (`seed_blog`)

Management command idempotent theo mẫu `seed_sitecontent`/`seed_job_categories`:

1. **6 danh mục**: Định hướng nghề nghiệp, Bí kíp tìm việc, Chế độ lương thưởng, Kiến thức chuyên ngành, Hành trang nghề nghiệp, Thị trường và xu hướng tuyển dụng (order 1→6).
2. **SiteSetting group `blog`**: `blog_support_docs_title` (mặc định "Tài liệu hỗ trợ tìm việc"), `blog_page_title`, `blog_meta_description`.
3. **2 Groups** `blog_editor`, `blog_manager` với permission tương ứng.
4. (Tùy chọn dev) vài bài viết mẫu + ghim mẫu cho khối tài liệu hỗ trợ.

## 9. Thứ tự triển khai

| Bước | Nội dung | Migration |
|---|---|---|
| 1 | Tạo app `blog`: `PostCategory`, `Post`, `Tag`, `PinnedPost` + constraint/index | `blog.0001` |
| 2 | Mở rộng `Banner` (placement `blog_sidebar`, `cta_secondary_*`) | `sitecontent.000X` |
| 3 | Django admin: PostAdmin (rich-text editor, preview, lọc theo status/category, queryset theo author), inline ghim; permission `can_publish_post` | — |
| 4 | `seed_blog` (danh mục, setting, groups) | — |
| 5 | Public API read-only: list bài (filter category/tag, phân trang), chi tiết theo slug, danh sách danh mục, pinned posts, tăng view | — |
| 6 | Endpoint upload ảnh nội dung cho editor (staff-only) | — |
| 7 | Frontend `/blog`, `/blog/danh-muc/<slug>`, `/blog/<slug>` theo layout đã mô tả | — |

Bước 1–2 độc lập, không đụng dữ liệu hiện có nên không cần backfill. API public cache được theo mẫu request-cache đã có ở frontend (catalog/site-metadata).
