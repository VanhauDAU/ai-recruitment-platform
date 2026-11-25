# Kế hoạch trang Quản lý danh mục (admin)

> Trạng thái: **chờ duyệt (25/11/2026)**. Lộ trình 3 giai đoạn, mỗi giai đoạn một PR vào `dev`.

## Context

Danh mục dùng chung đang không có chỗ để admin quản lý (số liệu lấy từ DB local ngày 25/11):

| Danh mục | Model | Số mục | Ai tạo | Vấn đề |
|---|---|---|---|---|
| Kỹ năng | `skills.Skill` + `SkillGroup` | 348 / 11 nhóm | Seed, nhập JD, **NTD tự thêm** qua `POST /skills/` | 270 kỹ năng chưa có nhóm. Chỉ chặn trùng khi tên viết giống hệt, nên "ReactJS" và "React.js" thành hai kỹ năng. Muốn gộp phải chạy lệnh `apply_skill_merge` với file JSON. |
| Ngành nghề | `jobs.JobCategory` (cây, 3 loại) + `JobCategoryLocalization` | 8 nhóm nghề / 24 kiến thức chuyên ngành / 61 vị trí chuyên môn | Seed | Chỉ sửa được qua Django admin, kể cả tên tiếng Anh và icon. |
| Phúc lợi | `jobs.Benefit` | 23 | Seed | Như trên. |
| Lĩnh vực công ty | `employers.Industry` | 47 | Seed | Như trên, và chưa có `is_active`. |
| Ngôn ngữ | `jobs.Language` | 5 | Seed | Như trên. |

Kỹ năng ảnh hưởng thẳng tới AI. Bộ nhận diện kỹ năng (`matching/services/skills.py`) đọc tên và alias của mọi kỹ năng đang bật. Hai nhóm **"Phẩm chất cá nhân"** và **"Tên vị trí"** được nhận dạng bằng **tên nhóm** để không đếm điểm. Gợi ý việc làm dùng `JobSkill.skill_id`, còn tìm ứng viên lọc theo `skill_id` nằm trong `MatchDocument.profile_json`. Vì vậy danh mục bẩn làm hỏng cả gợi ý lẫn xếp hạng.

**Mục tiêu:** một trang admin gọn để dọn và sửa danh mục, không thêm luồng duyệt và không đổi gì phía NTD.

## Quyết định thiết kế

1. **Một trang, chia tab:** `/admin/app/catalog?tab=skills|categories|benefits|industries|languages`. Tab nằm trên URL để gửi link được. Mục menu tên "Danh mục dữ liệu".
2. **Bảng + ngăn kéo bên phải.** Không có trang chi tiết riêng. Thanh công cụ gồm ô tìm kiếm, chip lọc có đếm số, nút "+ Thêm". Hiện/Ẩn bật tắt ngay trên dòng. Trên điện thoại, ngăn kéo chiếm toàn màn hình và bảng cuộn ngang.
3. **Không xóa hẳn, chỉ Ẩn** (`is_active`/`status`). Tin, CV và hồ sơ đang tham chiếu tới các mục này; `JobCategoryAssignment` và `JobBenefit` là `PROTECT`. Mục bị ẩn không hiện trong ô chọn mới nhưng dữ liệu cũ giữ nguyên.
4. **NTD vẫn thêm kỹ năng như hiện nay.** Admin dọn bằng bộ lọc "Chưa có nhóm" và "NTD thêm".
5. **Mỗi dòng hiện số lượt dùng** (tin, CV, hồ sơ), để biết nên dọn mục nào trước.
6. **Hai nhóm hệ thống bị khóa:** không đổi tên, không ẩn "Phẩm chất cá nhân" và "Tên vị trí", vì code nhận dạng chúng theo tên.
7. **Mọi thao tác ghi đều ghi audit** bằng `record_admin_action` và dùng chung `AdminPortalPermission`. Thao tác gộp chỉ superuser được làm, vì không hoàn tác được.
8. **Giao diện** theo các trang admin hiện có (antd + Tailwind, bản gọn). Khi thiết kế tra `ui-ux-pro-max` (`--domain ux`) về bảng, bộ lọc và thao tác hàng loạt. Khi code dùng `vercel-react-best-practices`. Trước khi bàn giao rà bằng `web-design-guidelines`.

## Thiết kế UI/UX

Hướng chính: **trang phục vụ việc dọn danh mục**, không chỉ để xem. Việc hay làm nhất là gán nhóm và gộp kỹ năng trùng, nên mỗi việc đó phải xong trong 1–2 thao tác. Trang giữ kiểu gọn của admin hiện có: không hero, cảnh báo chỉ một dòng.

### Bố cục (desktop)

```
Danh mục dữ liệu                                             (tiêu đề 1 dòng)
[Kỹ năng 348] [Ngành nghề 93] [Phúc lợi 23] [Lĩnh vực 47] [Ngôn ngữ 5]
⚠ Cần dọn: [270 chưa có nhóm] [8 có thể trùng] [12 NTD thêm 7 ngày]  (dải 1 dòng)
[🔍 Tìm tên, tên gọi khác…  /]  [Nhóm ▾] [Nguồn ▾] [Đang ẩn]         [+ Thêm]
┌─┬────────────────────┬──────────────┬──────────────────┬───────┬─────┐
│☐│ Tên                │ Nhóm         │ Tên gọi khác     │ Dùng  │ Hiện│
│☐│ ReactJS  · NTD     │ [Chọn nhóm ▾]│ React.js +2      │  12   │ ◉   │
└─┴────────────────────┴──────────────┴──────────────────┴───────┴─────┘
```

- **Dải "Cần dọn" thay cho bảng số liệu.** Mỗi chip là một bộ lọc có đếm số; bấm vào là lọc ngay. Hết việc thì dải tự ẩn.
- **Thanh công cụ dính trên đầu bảng.** Phím `/` để nhảy vào ô tìm kiếm. Chip lọc được xuống dòng khi hẹp, không bị cắt.
- **Bảng mật độ vừa:** dòng cao khoảng 44px, tiêu đề cột dính. Màn 1366×768 phải thấy ít nhất 10 dòng mà không cần cuộn.
  - Tên in đậm; nguồn là nhãn nhỏ màu xám ("NTD", "Nhập").
  - Tên gọi khác hiện tối đa 2 tag, phần còn lại gom thành "+n" (bấm để xem hết).
  - Cột lượt dùng căn phải, số dùng `tabular-nums`; mục 0 lượt dùng thì in mờ.
- **Gán nhóm ngay trên dòng.** Ô Nhóm của kỹ năng chưa có nhóm là một `Select` chọn tại chỗ, chọn xong thì lưu luôn, không cần mở ngăn kéo.
- **Thao tác trên dòng:** bấm vào dòng là mở ngăn kéo. Icon Sửa/Gộp hiện khi rê chuột; trên màn cảm ứng thay bằng menu "⋯" luôn hiện.
- **Thanh chọn nhiều thay chỗ thanh công cụ** khi có dòng được chọn ("Đã chọn 12 · Gán nhóm ▾ · Ẩn · Bỏ chọn"), nên bảng không bị xô.

### Ngăn kéo sửa

- Rộng 480px; footer dính chứa "Lưu" và **"Lưu & tiếp"**. "Lưu & tiếp" mở luôn mục kế tiếp trong bộ lọc đang chọn, để dọn hàng loạt không phải đóng mở lại.
- **Phím tắt:** `Ctrl/⌘+S` để lưu, `Esc` để đóng. Đóng khi còn thay đổi chưa lưu thì hỏi lại.
- **Kiểm tra khi rời ô:** ví dụ tên gọi khác bị trùng thì báo ngay "đã thuộc kỹ năng X", kèm link "Gộp vào X".
- **Lỗi từ server:** giữ nguyên dữ liệu đã nhập, chỉ đánh dấu ô bị lỗi. Nút Lưu có trạng thái đang lưu; lưu xong hiện thông báo ngắn.

### Phản hồi và thao tác nguy hiểm

- **Ẩn/Hiện áp dụng ngay, không hỏi lại.** Sau đó hiện thông báo "Đã ẩn ‘X’ · Hoàn tác" trong 15 giây, cùng kiểu hoàn tác của ADR-0028.
- **Gộp là thao tác duy nhất phải xác nhận,** vì không hoàn tác được. Modal chia 2 cột Nguồn → Đích, ghi rõ "12 tin, 30 CV, 4 hồ sơ sẽ chuyển sang React". Nút xác nhận ghi cụ thể "Gộp vào React" (màu cảnh báo); nút còn lại là "Giữ nguyên".
- **Trạng thái tải và rỗng:**
  - Lần tải đầu hiện Skeleton của bảng.
  - Khi đang tìm kiếm thì giữ kết quả cũ (`placeholderData`) để bảng không nháy.
  - Mỗi bộ lọc có thông điệp rỗng riêng, ví dụ "Không còn kỹ năng chưa có nhóm".
  - Lỗi tải hiện kèm nút "Thử lại".

### Tab Ngành nghề

- Bảng cây có đường kẻ thụt lề, nút "Mở hết/Thu hết". Loại là nhãn 3 màu (Nhóm nghề / Kiến thức / Vị trí); dòng nhóm nghề hiện icon 3D.
- Tìm kiếm thì tô sáng chữ khớp và tự mở các nhánh cha.

### Tab Phúc lợi

- Kéo thả thứ tự bằng tay nắm. Có thêm nút ↑↓ để làm được bằng bàn phím.

### Mobile (< 768px)

- Bảng chuyển thành danh sách thẻ. Mỗi thẻ có tên, nhóm, số lượt dùng và công tắc Hiện. Chạm vào thẻ thì mở ngăn kéo toàn màn hình.
- Thanh tab cuộn ngang. Thanh chọn nhiều nằm dính ở đáy màn hình.

### Tiếp cận và chi tiết

- Icon nút đều có `aria-label`; công tắc có nhãn đầy đủ (ví dụ "Hiện kỹ năng ReactJS"). Focus ring nhìn thấy rõ; điều hướng được bằng bàn phím.
- Số hiển thị qua `Intl.NumberFormat('vi-VN')`; chữ viết hoa đầu câu.

### Tiêu chí nghiệm thu UX (kiểm ở mỗi PR)

- Gán nhóm cho một kỹ năng: ≤ 2 thao tác. Gán nhóm cho 20 kỹ năng: dùng chọn nhiều, ≤ 4 thao tác.
- Chọn dòng hay mở ngăn kéo không làm bảng bị xô (không layout shift).
- Rà `web-design-guidelines` không còn lỗi mức High.
- PR kèm ảnh chụp desktop 1366px và mobile 375px.

## GĐ1: Khung trang + tab Kỹ năng (PR 1)

### Backend (`apps/skills`)

- **Migration:** thêm `Skill.source` (`seed` | `import` | `employer` | `admin`, mặc định `seed`).
  - `POST /skills/` của NTD ghi `employer`, bulk import ghi `import`, admin ghi `admin`.
  - Không đoán lại nguồn cho dữ liệu cũ; các mục cũ là `seed`.
- **API admin** `/api/admin/skills/`, gắn vào `config/urls.py`:
  - `GET` có phân trang 50 dòng, lọc `search`, `group`, `ungrouped`, `source`, `is_active`, `possible_duplicates`, sắp xếp `-created_at` hoặc `usage`.
    - `possible_duplicates` gom các kỹ năng có cùng khóa sau khi bỏ dấu câu và khoảng trắng, ví dụ "React.js" và "ReactJS" đều thành `reactjs`. Đây là luật đơn giản, không dùng mô hình.
    - Kèm một endpoint `summary` trả số đếm cho dải "Cần dọn". Số lượt dùng tính bằng subquery `Count` để số query không tăng theo số dòng; thêm test vào `test_query_budget`.
  - `POST`, `PATCH`: sửa tên, alias, nhóm, mô tả, `is_active`. Kiểm tra alias không trùng tên hoặc alias của kỹ năng khác (dùng lại `normalize_skill_name`).
  - `POST bulk-update`: gán nhóm hoặc ẩn/hiện cho nhiều kỹ năng cùng lúc.
  - `GET {id}/merge-preview?into=`: trả về số tin, CV và hồ sơ ứng viên sẽ chuyển sang kỹ năng đích, cùng số dòng bị trùng sẽ gộp.
  - `POST {id}/merge` (chỉ superuser), làm trong một transaction:
    1. Chuyển `JobSkill`, `CvSkill`, `CandidatePreferredSkill` sang kỹ năng đích. Dòng nào đã có kỹ năng đích thì bỏ dòng nguồn. Với `JobSkill`, giữ `importance`/`min_level` cao hơn.
    2. Nối tên và alias của kỹ năng nguồn vào alias của kỹ năng đích, rồi xóa kỹ năng nguồn.
    3. Xóa các `MatchDocument` có `profile_json` chứa id nguồn, rồi xếp task `embed_job`/`embed_cv_version` cho tin đang mở và bản CV mới nhất bị ảnh hưởng. Cần làm vậy vì `content_hash` chỉ băm văn bản, nên tài liệu cũ sẽ không tự dựng lại.
- **API nhóm** `/api/admin/skill-groups/`: danh sách kèm số kỹ năng; thêm, sửa tên, đổi nhóm cha, ẩn. Hai nhóm hệ thống trả lỗi `DomainError` khi bị đổi tên hoặc ẩn.
- **Logic đặt ở services/selectors** (`services/admin_taxonomy.py`, `selectors/admin.py`). Chuỗi lỗi bọc `gettext` rồi cập nhật `i18n_catalog`. Mọi view có `@extend_schema`.

### Frontend

- **Route và menu:** route `catalog` trong `admin-routes.config.js`, loader trong `lazy/admin.pages.jsx`, mục trong `admin-navigation.config.js`.
- **Page** `pages/admin/catalog/Catalog.jsx`: chỉ ghép `Tabs` và đọc `?tab=`. Mỗi tab là một chunk lazy.
- **Feature** `features/admin/catalog/manage-skills/`:
  - Bảng có các cột Tên, Nhóm, Tên gọi khác (tag), Nguồn, Lượt dùng, Hiện.
  - Chip lọc "Chưa có nhóm · N", "NTD thêm · N", "Đang ẩn".
  - Khi đã chọn dòng mới hiện thanh thao tác "Đã chọn N · Gán nhóm · Ẩn".
  - Ngăn kéo sửa kỹ năng: tên, nhóm, alias dạng `Select mode="tags"`, mô tả.
  - Modal gộp: chọn kỹ năng đích bằng ô tìm kiếm, xem số liệu từ `merge-preview`, rồi xác nhận.
  - Nút "Quản lý nhóm" mở modal danh sách nhóm sửa được ngay trên dòng.
- **Dữ liệu:** TanStack Query, tìm kiếm có debounce, cập nhật lạc quan cho công tắc Hiện/Ẩn, sửa xong thì invalidate danh sách.
- **CSS:** không thêm utility Tailwind mới vào CSS khởi tạo, vì đang sát trần 38,5 KiB. Style riêng của trang đặt trong file CSS lazy của feature.

### Kiểm thử

- **Pytest:**
  - Quyền admin, superuser và NTD.
  - Gộp: chuyển dòng, xử lý dòng trùng, alias, xóa và dựng lại `MatchDocument`, audit.
  - Khóa nhóm hệ thống; alias trùng; `source` được ghi khi NTD thêm.
  - Query budget của danh sách.
- **Vitest** cho bảng, bộ lọc và modal gộp; E2E smoke `@responsive` cho route `/admin/app/catalog`.

## GĐ2: Tab Ngành nghề (PR 2)

- **API** `/api/admin/job-categories/`:
  - Trả về cả cây, không phân trang, kèm số tin, CV và nhu cầu tuyển dụng đang dùng.
  - Thêm và sửa: tên, loại, cha, mô tả, icon, trạng thái, tên tiếng Anh (`JobCategoryLocalization`).
  - Chặn đặt cha tạo vòng lặp. Chặn sai cấp loại: `specialization` phải nằm dưới `domain` hoặc `occupation_group` (kiểm tra lại theo dữ liệu seed khi làm).
- **Icon:** dùng lại luồng upload media đang có. Dữ liệu chỉ lưu storage key vào `logo_url`. `seed_job_categories` đã không ghi đè icon admin chọn.
- **UI:**
  - Bảng dạng cây, mở được từng dòng con, có lọc theo loại.
  - Ngăn kéo có hai ô tên Việt và Anh, trường chọn cha dạng `TreeSelect`.
  - Ẩn một nhóm thì hỏi lại, kèm cảnh báo "N mục con vẫn hiện".
- **Kiểm thử:** chặn vòng lặp và sai cấp, localization, query budget; Vitest cho bảng cây; E2E đổi tab.

## GĐ3: Phúc lợi, Lĩnh vực công ty, Ngôn ngữ (PR 3)

- **Migration:** thêm `Industry.is_active` (mặc định `True`). Ô chọn lĩnh vực công ty chỉ hiện mục đang bật.
- **API admin** cho 3 model, cùng một mẫu: danh sách kèm số lượt dùng, thêm, sửa, Hiện/Ẩn.
  - Phúc lợi có thêm nhóm, icon và kéo thả thứ tự (`sort_order`).
  - Ngôn ngữ có thêm mã.
- **Frontend:** một feature `manage-lookups` dùng chung một bảng. Mỗi tab chỉ truyền cấu hình cột và trường của ngăn kéo, không viết ba component riêng.
- **Cập nhật tài liệu:** `docs/TIEN-DO-DU-AN.md`, đặc tả admin, `docs/04-api`.

## Ngoài phạm vi

- Không có hàng chờ duyệt kỹ năng do NTD thêm.
- Không làm danh mục riêng cho từng công ty, lịch sử phiên bản danh mục hay import/export Excel. Lệnh `apply_skill_merge` vẫn giữ cho pipeline ML.
- Không tự dựng lại tài liệu đối sánh khi chỉ sửa alias hoặc nhóm. Thay đổi này chỉ áp cho tài liệu tạo sau. Riêng thao tác gộp có dựng lại, vì nó đổi `skill_id`.
- Địa điểm (`locations`) theo đơn vị hành chính, không đưa vào trang này.

## Kiểm tra mỗi giai đoạn

Chạy cổng backend và frontend theo `AGENTS.md`: ruff, lint-imports, layering, `makemigrations --check`, OpenAPI, `pytest --cov` (cần `--ds=config.settings.test` trong container); `npm run lint`, `check:architecture`, `test:coverage`, `build` (ngân sách CSS/JS), `test:e2e:smoke`.
