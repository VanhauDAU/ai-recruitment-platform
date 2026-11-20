# Tiến độ dự án

File này giữ trạng thái hiện tại và việc còn mở. Chi tiết từng thay đổi nằm ở
[`CHANGELOG.md`](../CHANGELOG.md); lịch sử đầy đủ của file này nằm trong git.

## Tổng quan

| Hạng mục | Trạng thái |
| --- | --- |
| [Chốt luồng FAQ/hướng dẫn và blog: Nháp → Xuất bản (ADR-0024)](#chốt-luồng-nội-dung-nháp--xuất-bản-adr-0024-2026-11-20) | ✅ Gộp vào `dev` (#272) |
| [Tổ chức lại sidebar quản trị](#tổ-chức-lại-sidebar-quản-trị-2026-11-20) | ✅ Gộp vào `dev` (#270); gỡ khối "Hàng chờ quản trị" ở trang Người dùng: PR #271, chờ gộp |
| [Song ngữ vi/en cho 3 cổng (ADR-0023)](#song-ngữ-vien-cho-3-cổng-adr-0023-2026-11-19) | 🟨 GĐ0 (#262), GĐ1 cổng NTD (#267) đã gộp; chặn mất dữ liệu khi đổi ngôn ngữ trên nhánh `fix/language-switch-unsaved-guard`; GĐ2–4 chưa làm |
| [Chuẩn hóa tiêu đề trang 3 cổng](#chuẩn-hóa-tiêu-đề-trang-3-cổng-2026-11-19) | 🟨 PR #261 (nhánh `feat/page-titles`), chờ gộp |
| [Hậu kiểm nội dung trang công ty](#hậu-kiểm-nội-dung-trang-công-ty-2026-11-19) | ✅ Gộp vào `dev` (#260) |
| [Làm lại trang nhà tuyển dụng của admin](#làm-lại-trang-nhà-tuyển-dụng-của-admin-2026-11-19) | ✅ Gộp vào `dev` (#263); làm gọn giao diện chi tiết ở PR #266 (nhánh `feat/admin-recruiter-detail-ui`), chờ gộp |
| [Tối ưu và chuẩn hóa test/CI](#tối-ưu-và-chuẩn-hóa-testci-2026-11-19) | 🟨 PR #256, #257, #258, GĐ4 nhánh `docs/test-standards` — chờ gộp |
| [Tái cấu trúc backend (ADR-0022, GĐ0–GĐ6)](#tái-cấu-trúc-backend-adr-0022-2026-11-19) | ✅ Gộp vào `dev` (#248–#255, 19/11); sau khi pull chạy `scripts/reset_local_db.sh` trước khi start backend |
| [Tổ chức lại cấu trúc thư mục frontend](#tổ-chức-lại-cấu-trúc-thư-mục-frontend-2026-11-19) | ✅ Gộp vào `dev` (#247) |
| [Mô hình hóa yêu cầu cho báo cáo (mục 3.2)](#mô-hình-hóa-yêu-cầu-cho-báo-cáo-mục-32-2026-11-18) | ✅ Nguồn sơ đồ trong `docs/01-phan-tich/mo-hinh-hoa-yeu-cau/` |
| [Nâng cấp chiến dịch tuyển dụng (4 GĐ)](#nâng-cấp-chiến-dịch-tuyển-dụng-2026-11-18) | ✅ Cả 4 GĐ và đợt làm lại giao diện kênh, Fanpage, chi phí, lịch sử hoạt động đã gộp (#235–#237, #239–#242); sơ đồ phân tích nhóm chiến dịch trên nhánh `docs/campaign-diagrams` |
| [Ứng tuyển bằng CV tải lên và form ứng tuyển mới](#ứng-tuyển-bằng-cv-tải-lên-và-form-ứng-tuyển-mới-2026-11-18) | ✅ Gộp vào `dev` (#234) |
| [Bảng điều khiển quản trị](#bảng-điều-khiển-quản-trị-2026-11-16) | 🟨 Xong trên nhánh `feat/admin-dashboard`, chưa mở PR |
| [Ảnh đại diện dùng chung 3 cổng](#ảnh-đại-diện-dùng-chung-3-cổng-2026-11-16) | 🟨 Xong trên nhánh `feat/avatar-editor`, chưa mở PR |
| [Dọn mâu thuẫn còn lại sau thống nhất luồng](#dọn-mâu-thuẫn-còn-lại-sau-thống-nhất-luồng-2026-11-16) | ✅ Cả 3 GĐ đã gộp (#222, #223, #224); dọn phần còn hở trên nhánh `fix/flow-loose-ends` |
| [Thống nhất luồng đăng tin, hiển thị, ứng tuyển, công ty](#thống-nhất-luồng-đăng-tin-hiển-thị-ứng-tuyển-công-ty-2026-11-15) | ✅ Cả 6 giai đoạn đã gộp (#208–#215); hoàn thiện luồng nhắc NTD và lịch sử nộp trên nhánh `feat/application-reminders` |
| [Đối sánh ngữ nghĩa CV–JD chạy local](#đối-sánh-ngữ-nghĩa-cvjd-chạy-local-2026-11-15) | 🟨 Bản demo đã gộp (#207, #230–#233); kế hoạch bản 3 (20/11): GĐ 1 đo lường ở PR #274; GĐ 2 `extract-v3` xong trên nhánh `feat/ai-extract-v3` |
| [CV tải lên: tệp gốc, tiêu chuẩn upload, giới hạn CV, NTD tìm kiếm](#cv-tải-lên-tệp-gốc-tiêu-chuẩn-upload-giới-hạn-cv-ntd-tìm-kiếm-2026-11-15) | ✅ Gộp vào `dev` (#203) |
| [Việc làm tốt nhất xếp theo chất lượng tin](#việc-làm-tốt-nhất-xếp-theo-chất-lượng-tin-2026-11-15) | ✅ Gộp vào `dev` (#204) |
| [Thiết kế lại quản lý tin tuyển dụng của NTD](#thiết-kế-lại-quản-lý-tin-tuyển-dụng-của-ntd-2026-11-15) | ✅ Gộp vào `dev` (nhánh `feat/employer-job-workspace`) |
| [Gỡ widget Trợ lý ProCV ở cổng ứng viên](#gỡ-widget-trợ-lý-procv-ở-cổng-ứng-viên-2026-11-14) | 🟨 Xong trên nhánh `refactor/remove-candidate-assistant`, chờ gộp PR vào `dev` |
| [Gỡ phòng ban, chức danh, nhân viên quản trị (ADR-0018)](#gỡ-phòng-ban-chức-danh-nhân-viên-quản-trị-adr-0018-2026-11-14) | 🟨 Xong trên nhánh `refactor/remove-admin-rbac`, chờ gộp PR vào `dev` |
| [Trang công ty và quyền biên tập (CP)](#trang-công-ty-và-quyền-biên-tập-cp-2026-11-14) | 🟨 CP-0 → CP-7 xong trên nhánh `feat/company-page`, chờ gộp PR |
| [Làm lại Template CV, tạo CV, trích xuất upload (CVT-v3)](#làm-lại-template-cv-cvt-v3-2026-11-13) | 🟨 CVT-0 → CVT-2 đã gộp vào `dev` (PR #176, #178–#182); CVT-3 xong code |
| [Gỡ xác thực hai bước (ADR-0016)](#gỡ-xác-thực-hai-bước-adr-0016-2026-11-13) | 🟨 Xong trên nhánh `refactor/remove-two-factor`, chưa commit/gộp |
| [Epic hậu kiểm tin, gỡ dịch vụ, dọn docs (PM)](#epic-hậu-kiểm-tin-gỡ-dịch-vụ-thương-mại-và-dọn-docs-pm-2026-11-13) | 🟨 PM-0 đến PM-6 xong trên nhánh, chưa gộp; còn PM-5 và một phần PM-7 |
| [Epic tái cấu trúc ProCV (P0–P10)](#epic-tái-cấu-trúc-procv-p0p10-2026-09) | 🟨 P0 Verified, P1–P4 và P8–P9 Implemented |
| [Epic hardening cổng nhà tuyển dụng (ER)](#epic-rà-soát-và-hardening-cổng-nhà-tuyển-dụng-er-2026-08-10) | 🟨 Code xong; chờ kích hoạt ER-3, ER-8 |
| [Các epic đã hoàn tất](#các-epic-đã-hoàn-tất) | ✅ |
| [Lộ trình theo PRD](#lộ-trình-theo-prd) | 🟨 Phần AI lõi (giai đoạn 2–3) còn mở |
| [Việc còn mở](#việc-còn-mở) | |

## Song ngữ vi/en cho 3 cổng (ADR-0023, 2026-11-19)

Lý do: một số NTD là người nước ngoài. Quyết định và lộ trình nằm ở
[ADR-0023](02-tong-quan/adr-0023-i18n-vi-en.md).

| GĐ | Phạm vi | Trạng thái |
|---|---|---|
| 0 | Nền tảng FE (Paraglide; antd/dayjs/Intl theo locale; `Accept-Language`; bộ chọn lưu vào tài khoản; `check:i18n` + ratchet); backend (`LocaleMiddleware`, `preferred_language`, catalog vi bổ sung cho DRF); chuyển 4 trang marketing NTD khỏi i18next | ✅ Gộp vào `dev` (#262) |
| 1 | Cổng NTD: 3.029 khóa FE (công ty, tin, chiến dịch, tài khoản/đăng nhập dùng chung, khung workspace, entities/shared NTD dùng, trang pháp lý); backend 1.511 msgid ở `accounts`/`employers`/`jobs`/`campaigns`/`applications`; email + thông báo theo ngôn ngữ người nhận; prompt AI sinh tin/nội dung chiến dịch theo ngôn ngữ; bộ chọn ngôn ngữ ở workspace, đăng nhập, thiết lập; công cụ catalog Python thuần `common/i18n_catalog.py` | ✅ Gộp vào `dev` (#267) |
| 2 | Danh mục `name_en` (tỉnh/thành, kỹ năng, ngành nghề, phúc lợi); entities và shared | ⬜ |
| 3 | Cổng ứng viên | ⬜ |
| 4 | Cổng quản trị; ratchet về 0 | ⬜ |

Số đo:
- Dòng tiếng Việt viết cứng trong `frontend/src` (`scripts/i18n-baseline.json`):
  8.793 lúc bắt đầu → 5.575 sau GĐ1. `features/employer`, `widgets/employer`,
  `pages/employer` đã về 0.
- Bundle khởi tạo:
  - GĐ0: 322,4 → 326,3 KiB (runtime Paraglide khoảng 1,4 KiB, locale vi_VN của
    antd khoảng 2,2 KiB).
  - GĐ1: 332,2 KiB vì 204 chuỗi của form đăng nhập/phiên/lỗi API nằm sẵn trong
    shell. Trần nâng lên 334 KiB.
- Đổi ngôn ngữ là tải lại trang, nên các trình soạn cấp trang của NTD (tin,
  hồ sơ và nội dung/bố cục trang công ty, thông tin chiến dịch, thông tin tài
  khoản, ghi chú đánh giá hồ sơ) cùng trình soạn CV đăng ký trạng thái "chưa
  lưu". Bộ chọn ngôn ngữ hỏi trước khi bỏ thay đổi; tải lại hoặc đóng tab có
  cảnh báo của trình duyệt.
- Pytest trong container phải chạy với `--ds=config.settings.test`. Thiếu tham
  số này, 38 test lỗi giả vì URL R2 (đã sửa trong `scripts/check_all.sh`).

## Chuẩn hóa tiêu đề trang 3 cổng (2026-11-19)

Rà toàn bộ route của 3 cổng, đối chiếu `<title>` với H1/nhãn menu; quy ước ở
mục "Tiêu đề trang" của `frontend/ARCHITECTURE.md`.

- Thương hiệu theo cổng: `| ProCV`, `| ProCV cho Nhà tuyển dụng` (cả SEO shell
  marketing NTD), `| Quản trị ProCV`; sinh từ `site_name`.
- Sửa route bị gán nhầm "Trang không tồn tại" (và `noindex`): `/tai-cv-len`,
  `/tuyen-dung/:slug`, NTD `/notifications`, `/activities`, `/company-page`,
  link đánh giá hồ sơ.
- Tiêu đề SEO kiểu trang tuyển dụng lớn: tin `Tuyển <vị trí> - <công ty>`,
  danh sách việc làm bỏ nhãn ngày, danh mục mẫu CV khớp H1 có năm, danh mục
  blog/trợ giúp kèm mục cha, chiến dịch `<tên> - <công ty>`; frontend và SEO
  shell backend ra cùng chuỗi.
- Trạng thái lỗi dùng đúng câu đang hiển thị; tiêu đề trang marketing NTD theo
  ngôn ngữ (vi/en); tiêu đề quản trị khớp H1.
- Thanh trên cùng workspace NTD dùng chung resolver với tiêu đề tab (trước đây
  hiện "Không gian nhà tuyển dụng" ở trang đăng/sửa tin).
- Gỡ `/tuyendung/bao-gia` khỏi SEO shell và sitemap (SPA không có trang này).

## Chốt luồng nội dung: Nháp → Xuất bản (ADR-0024, 2026-11-20)

Vấn đề: sau ADR-0018 mọi admin đủ quyền, nên FAQ/hướng dẫn (4 bước gửi duyệt →
duyệt → xuất bản) và blog (gửi duyệt → xuất bản) chỉ còn là tự duyệt bài của
chính mình; trạng thái hiển thị sai sau khi xuất bản và có hai hàng chờ giả.
Quyết định: [ADR-0024](02-tong-quan/adr-0024-content-publish-without-review.md).
Một PR, nhánh `feat/content-publish-flow`.

| Phần | Nội dung |
| --- | --- |
| FAQ/hướng dẫn — backend | Revision chỉ còn `DRAFT`/`PUBLISHED`; publish nhận bản nháp hoặc bản đã xuất bản cũ (rollback); `POST …/revisions/{n}/discard/` hủy nháp; `change_summary` bắt buộc khi xuất bản bản sửa; gỡ `submit/approve/reject`, `review_note`, `submitted_*`, `reviewed_*`. Migration `0003` (chuyển dữ liệu, xóa revision chưa từng công khai không còn dùng) + `0004` (gỡ cột) |
| FAQ/hướng dẫn — giao diện | Bài đang công khai sửa thẳng, lưu lần đầu tạo bản nháp; nút **Xuất bản** lưu trước rồi xuất bản; **Hủy bản nháp**; thẻ **Phiên bản** (so sánh với bản công khai, công khai lại bản cũ); KPI "Có bản nháp" thay "Chờ duyệt" |
| Blog | `draft → published → archived`; xuất bản thẳng từ nháp hoặc bản sửa; gỡ `submit/return`, `submitted_at`, trạng thái working copy, quyền `can_publish_post`. Migration `0003` (pending → draft) + `0004` |
| Hàng chờ | Gỡ `knowledge_reviews`, `blog_reviews` khỏi dashboard, sidebar, chuông; giữ "FAQ quá hạn rà soát" |
| Kèm theo | Nhãn audit khớp mã backend (gồm mã cũ để đọc lịch sử); bỏ lỗi readiness `safety_content_not_reviewed` |

## Tổ chức lại sidebar quản trị (2026-11-20)

Mục tiêu: admin tới hàng chờ trong 1–2 cú bấm thay vì 3, mỗi trang chỉ có một
lối vào trên sidebar. Một PR, nhánh `feat/admin-sidebar-ia`.

| Phần | Nội dung |
| --- | --- |
| Cấu trúc | Tối đa 2 tầng, chia 4 mục Vận hành · Quản lý · Nội dung · Hệ thống. Nhóm "Cần xử lý" (mở sẵn) gom mọi hàng chờ theo đúng thứ tự và đích đến của `QUEUE_CONFIG` (dashboard, chuông); Doanh nghiệp/Tin/Người dùng chỉ còn danh sách; Mẫu CV, Cẩm nang, FAQ, Thông báo là mục thẳng; Hệ thống (superuser) gồm Quản trị viên, Lời mời quản trị, Cấu hình |
| Gỡ trùng | Bỏ 15 lá Cấu hình và 5 lá Mẫu CV (trang đã có tab riêng), "Tài khoản cá nhân" (đã ở chân sidebar và menu avatar), các mục "Sắp ra mắt", "Tin có báo cáo chờ" (bộ lọc trong trang) |
| Tương tác | Mục là liên kết thật (Ctrl/⌘-click mở tab mới); bỏ flyout tầng 3 đè nội dung; mở nhiều nhóm cùng lúc, nhớ nhóm đang mở và trạng thái thu gọn (localStorage); hàng chờ rỗng hiển thị mờ; drawer mobile dùng cùng accordion |
| Tìm nhanh | Ô "Tìm trang…" + phím ⌘K/Ctrl+K: lọc mọi trang theo tên và nhóm, không phân biệt dấu; superuser tìm được cả từng nhóm cấu hình; tải lười khi mở lần đầu |
| Hàng chờ mới | `company_content_changes` (hậu kiểm trang công ty, hạn 48 giờ) vào `GET /api/admin/dashboard/queues/` → badge sidebar, chuông, dashboard |
| Kèm theo | Bộ lọc trạng thái ở danh sách Cẩm nang nằm trên URL (`?status=`) để hàng chờ mở đúng bài chờ duyệt; nhãn sidebar chuyển vào `messages/admin` |
| Dọn sau gộp | Trang Người dùng bỏ khối "Hàng chờ quản trị" (lời mời đang chờ đã có badge trên tab "Lời mời quản trị" và nhóm "Cần xử lý"; ô "Phạm vi số liệu" lặp lại thẻ Tổng tài khoản); gỡ luôn `QueueCard`, prop `pendingInvitations/canInvite/onOpenQueue` và CSS `.account-queue*` |

## Hậu kiểm nội dung trang công ty (2026-11-19)

Quyết định: ER-D65 đến ER-D68, [ADR-0017](02-tong-quan/adr-0017-company-page.md)
quyết định 3 (sửa). Nội dung trang công ty chuyển từ duyệt trước sang đăng ngay
rồi hậu kiểm; duyệt trước chỉ còn cho thay đổi pháp lý, form hồ sơ và công ty bị
quản trị viên bật duyệt trước.

| Hạng mục | Nội dung | Trạng thái |
| --- | --- | --- |
| Backend | `CompanyContentChange` + `Company.content_review_required` (migration `0004`); `POST company/page/content/` đăng ngay, ảnh tải vào `content_change`, bỏ key vừa đăng khỏi yêu cầu đang mở; API admin `company-content-changes/` (danh sách, `mark-reviewed/`, `revert/`) và `companies/{id}/content-review/`; thông báo `company_content_reverted` | ✅ Xong trên nhánh |
| Sửa lỗi kèm | Form hồ sơ không còn xoá nội dung trang đang chờ duyệt trong cùng yêu cầu; hàng đợi "Yêu cầu cập nhật công ty" chỉ đếm yêu cầu chờ quản trị viên | ✅ Xong trên nhánh |
| Frontend NTD | Thẻ nội dung "Lưu" (đăng ngay) hoặc "Gửi duyệt" khi bị bật duyệt trước; chỉ khoá khối còn trong yêu cầu đang thẩm định | ✅ Xong trên nhánh |
| Frontend admin | Tab "Thay đổi nội dung" ở Công ty (đếm chưa xem, so sánh trước/sau, đánh dấu đã xem hàng loạt, hoàn tác kèm lý do), tab cùng tên trong chi tiết công ty, công tắc "Bật/Tắt duyệt trước" ở tab Trang công khai | ✅ Xong trên nhánh |
## Làm lại trang nhà tuyển dụng của admin (2026-11-19)

Mục tiêu: khi số NTD lớn, admin xử lý nhanh và ít bước; giao diện gọn, đồng bộ
dashboard admin; nhật ký hoạt động chia theo nhóm và ngày. Một PR, nhánh
`feat/admin-recruiter-workspace`.

| Phần | Nội dung |
| --- | --- |
| Việc cần làm | Backend tính một `next_action` cho mỗi NTD bằng SQL (quá hạn 72 giờ → chờ duyệt xác thực → cập nhật công ty → bị hạn chế → chờ NTD bổ sung → chưa liên kết công ty → chưa thiết lập → chưa nộp); lọc `next_action`/`admin_queue`, sắp xếp `ordering=next_action`, đếm trong `summary.next_actions` cùng một quy tắc |
| Danh sách | 6 ô phân khúc kiểu dashboard (bấm = lọc, số khớp danh sách); bảng gọn còn NTD · Việc cần làm (có nút đi thẳng) · Xác thực · Công ty · Tài khoản; tìm theo tên công ty (không dấu), MST, SĐT; 20/40/60 dòng/trang; xem nhanh có việc cần làm, tóm tắt, 5 hoạt động gần đây và nút ‹ › chuyển NTD |
| Chi tiết | Hero gọn + dải "Việc cần làm" có CTA; 6 tab (Tổng quan gộp Hồ sơ NTD, Xác thực, Công ty, Tuyển dụng, Bảo mật, Nhật ký); `?tab=profile` cũ chuyển về Tổng quan |
| Nhật ký | `GET /admin/accounts/:id/activity/` gộp đăng nhập, thao tác admin, đổi trạng thái, xác thực, SĐT, liên kết/cập nhật công ty, hoạt động tuyển dụng; phân trang con trỏ; nhóm Bảo mật/Tài khoản/Xác thực/Công ty/Tuyển dụng có số đếm; giao diện chia theo ngày ("Hôm nay", "Hôm qua", thứ + ngày), giờ HH:mm, người thực hiện, chi tiết thu gọn. Thêm index `admin_audit_target_time_idx`, bỏ phép OR trên JSON |
| Popup | Mẫu chung `ActionDialog` + `ReasonField` (lý do mẫu) + `ImpactFacts` + `useImpactConfirmation`: tác động tự tải khi mở, xác nhận một click; backend cho preview lý do trống, confirm vẫn bắt buộc lý do (lý do nằm trong token). Áp dụng cho khóa/cấm/thu hồi phiên, quyết định xác thực, vòng đời xác thực, giấy tờ, cập nhật công ty, gỡ liên kết, domain, đặt lại mật khẩu, đổi email |
| Luồng duyệt | Duyệt giấy tờ đạt = 1 click (không popup); sau quyết định có "Hồ sơ tiếp theo (còn N)" đi thẳng tới ca cũ nhất kế tiếp — từ ~6+3N click và quay lại danh sách còn ~5+N |
| Giao diện chi tiết (20/11) | Hero kèm dải số liệu; tab trên nền trang, nội dung trong panel; Tổng quan hai cột (hồ sơ · tóm tắt + hoạt động); trường hiển thị nhãn trên giá trị theo lưới tự co, chia nhóm; sửa bảng giấy tờ tràn trên mobile. PR #266 |

## Tối ưu và chuẩn hóa test/CI (2026-11-19)

CI mỗi PR mất 12–18 phút và đỏ ở gần một nửa số lần chạy (17/40 run gần nhất của
mỗi workflow). Mục tiêu: wall-clock mỗi PR ≤ 8 phút, mỗi job ≤ 5 phút, CI xanh ổn
định, có chuẩn thời gian và chất lượng test được CI kiểm. Mỗi GĐ một PR về `dev`.

| GĐ | Nội dung | Trạng thái |
| --- | --- | --- |
| GĐ0 | Gỡ chặn: test chậm/flaky (CampaignList, báo cáo công ty), watchdog faulthandler làm sập worker pytest, timeout job backend 50 → 15 phút | 🟨 PR #256 |
| GĐ1 | DB test dựng một lần rồi clone theo worker xdist (`backend/conftest.py`): setup ~90s/worker trên CI → một lần migrate không coverage; cục bộ lần chạy sau setup 29s → 0,4s, full suite ~45s | 🟨 PR #257 |
| GĐ2 | Viết lại migration test | ➖ Bỏ — GĐ6 tái cấu trúc backend đã reset baseline và gỡ test migration lịch sử |
| GĐ3 | Frontend: E2E chạy trong image Playwright theo phiên bản lockfile (bỏ bước cài 16s–7,5 phút); tag `@responsive` cho 71/102 test, tablet/mobile chỉ chạy test có tag (330 → 266 lượt); 105 file test thuần logic chạy môi trường node; sửa các file test chậm nhất (AdminCompanyWorkspace 7,6s → 0,16s, hook onboarding 7,3s → 25ms); unit 4 → 5 shard; script `test:related`, `test:changed` | 🟨 PR #258 |
| GĐ4 | [Tiêu chuẩn kiểm thử](05-huong-dan/tieu-chuan-kiem-thu.md) + `scripts/check_test_budgets.mjs` (JUnit → cảnh báo vượt ngưỡng mềm, fail khi vượt ngưỡng cứng) chạy ở backend-checks, coverage, e2e-smoke-shard. Cổng này bắt được danh sách tin admin chậm do PostgreSQL JIT (348 → 42ms/request) → tắt JIT ở kết nối Django | 🟨 PR #259 |

## Tái cấu trúc backend (ADR-0022, 2026-11-19)

Rà soát toàn bộ `backend/` (18 app, ~140 nghìn dòng): khung ADR-0010 bị lệch,
luật không còn được CI kiểm. Quyết định ở
[ADR-0022](02-tong-quan/adr-0022-backend-structure.md); làm qua 7 giai đoạn, mỗi
GĐ một PR về `dev`. Cả 7 GĐ cùng bản sửa E2E chiến dịch (#250) đã gộp vào `dev` ngày 19/11/2026.

| GĐ | Nội dung | Trạng thái |
| --- | --- | --- |
| 0 | ADR-0022; sửa cổng ranh giới feature frontend sau #247; cổng import chéo app/module gốc (`check_backend_imports.py`, baseline 148 mục); cổng OpenAPI (baseline 70 lỗi / 340 cảnh báo); tách `requirements-dev.txt`, pin `gunicorn`/`redis`; bắt buộc `DJANGO_SETTINGS_MODULE` | ✅ #248 |
| 1 | Bố cục chuẩn: 30 module gốc app về đúng tầng (thêm tầng `domain/`), URL tách theo cổng vào `api/urls/<cổng>.py`, view SEO vào `seo/`, `signals/` + `tasks/` thành package, code trong `__init__` ra module riêng, `common/` chia `api/http/storage/html/pdf/files/db`; baseline import 148 → 33 | ✅ #249 |
| 2 | Model + máy trạng thái + API chiến dịch sang `campaigns` (3 migration chỉ đổi state, ContentType chuyển theo); `cv_templates` thành engine tài liệu CV (schema, composition, in PDF), engine Chromium vào `common/pdf/`; bỏ lazy export của accounts; gỡ route trùng `/api/candidate/cvs/backgrounds/`; import chéo app 33 → 0, gỡ baseline | ✅ #251 |
| 3 | Exception handler chung + `DomainError` (gỡ `_call`, `_run_mutation`…); ORM/transaction/`.delay()` ra khỏi view và `create/update` của serializer ở 4 cụm app; GET không còn tạo hồ sơ NTD; `@extend_schema` cho mọi view, OpenAPI từ 70 lỗi/340 cảnh báo về **0/0** (cổng siết không baseline); `parse_bool`/`parse_int` dùng chung; Browsable API chỉ khi DEBUG | ✅ #252 |
| 4 | API theo cổng `/api/{auth,public,candidate,employer,admin,shared}/` (237 route đổi, bảng [url-map](04-api/url-map-2026-11.md)), bỏ `/api/v2/` và tên `v2` ở module/lớp/route, router `SimpleRouter`, gỡ route SEO legacy `/jobs`; frontend: 51 API client + mock unit/E2E | ✅ #253 |
| 5 | Không còn module production > 500 dòng: settings tách 8 component (giá trị không đổi), `verification`/`digests`/`pipeline`/`ai_generation`/`account_management`/`posting`… thành package; gộp trùng: `common/outbox.py`, `common/errors.py`, một bộ HTML→text, một bảng chữ ký file, chính sách AI một nguồn (`jobs/domain/ai_policy.py`); sửa 2 chỗ lấy IP client giả mạo được (captcha, audit CV); gỡ chuỗi legacy media, 9 lệnh chạy một lần, kênh OTP email cũ, font CV cũ; bật ruff DJ001/007/008/012; thêm test privacy/skills/locations, tách file test > 1000 dòng | ✅ #254 |
| 6 | 274 migration → baseline `0001_initial` (+`0002_initial` khi FK vòng) và `00xx_reference_data` nạp JSON qua `common/db/reference_data.py`; schema mới khớp schema cũ (trừ 4 cột mồ côi của `employers_company` đã dọn và bảng chiến dịch sang `campaigns_*`); gỡ 8 test migration và job CI `backend-migration-tests`; `scripts/reset_local_db.sh` (pg_dump → migrate → seed) | ✅ #255 |

GĐ1 chỉ di chuyển code; bảo đảm không đổi hành vi bằng: ảnh chụp bảng URL
(887 route, 679 đường dẫn mẫu resolve ra cùng view) trước/sau, routing queue
của 50 Celery task và lịch beat giống hệt, schema OpenAPI khớp từng byte, và
toàn bộ test. Tên module/lớp `v2` để GĐ4 đổi cùng URL.

GĐ0 sửa một lỗi cấu hình: `config/__init__.py` nạp `config/celery.py`, file này
đặt mặc định `config.settings.development`, nên gunicorn production thiếu
`DJANGO_SETTINGS_MODULE` sẽ âm thầm chạy settings development. Nay thiếu biến là
dừng ngay; image Docker mặc định production, compose dev khai development.

## Tổ chức lại cấu trúc thư mục frontend (2026-11-19)

Mọi layer của `frontend/src` dùng chung một bộ tên cổng và nghiệp vụ, thay cho
các danh sách phẳng (76 feature, 40 widget, 32 entity, 33 trang admin chung một thư mục).
Quy tắc ở mục "Tổ chức thư mục trong từng layer" của `frontend/ARCHITECTURE.md`.

- `features/<cổng>/<module>/<slice>`: 4 cổng (`main`, `employer`, `admin`,
  `common`), 19 module.
- `widgets/<cổng>/<widget>`: bỏ tiền tố cổng bị lặp trong tên.
- `entities/<domain>/<entity>`: 10 domain.
- `pages/<cổng>/<mục>`: bỏ cấp `app` của admin và NTD; trang admin chia
  thành 10 mục.
- `shared/ui`: gom các cụm `rich-text`, `confirm-action`, `toast`.
- `frontend/MASCOT.md` chuyển sang `docs/08-frontend/mascot.md`.
- Gate kiến trúc mới: `no-cross-portal-slice` (trang/widget không dùng feature
  của cổng khác), các rule chéo slice dùng capture group, kiểm tra cấu trúc thư
  mục nhóm, kèm negative fixture.
- Không đổi URL, API, storage key hay guard.

## Mô hình hóa yêu cầu cho báo cáo (mục 3.2) (2026-11-18)

Bộ sơ đồ và bảng cho mục 3.2 của báo cáo ĐATN, theo khung báo cáo mẫu, ở
`docs/01-phan-tich/mo-hinh-hoa-yeu-cau/` (xem README trong thư mục).

- 16 nhóm chức năng, mỗi nhóm một thư mục: sơ đồ use case, bảng mô tả use case,
  bảng dòng chính, 38 sơ đồ tuần tự và 38 sơ đồ hoạt động cùng tên. Luồng đối
  chiếu với mã nguồn ngày 18/11; ba chức năng AI phía NTD và gợi ý theo ngữ nghĩa
  ghi "dự kiến".
- Ảnh PNG nền trắng nét đen và file Word sinh bằng `cong-cu/build.sh` (bộ vẽ
  Swift tự viết, không cần PlantUML); ảnh và docx không đưa vào git.
- Khi đổi luồng nghiệp vụ, sửa tệp `.seq`/`.act`/`noi_dung.py` của nhóm tương ứng
  rồi chạy lại script.

## Nâng cấp chiến dịch tuyển dụng (2026-11-18)

Chốt với user ngày 18/11: chiến dịch được nâng thành quy trình *lập mục tiêu →
phân phối đa kênh → đo hiệu quả từng kênh → theo dõi sức khỏe → tự kết thúc*.
Kế hoạch 4 giai đoạn, mỗi giai đoạn một PR.

| GĐ | Nội dung | Trạng thái |
| --- | --- | --- |
| 1 | Mục tiêu, vòng đời (`scheduled`), wizard thiết lập, lịch chạy, đóng tin khi kết thúc | ✅ Gộp vào `dev` (#235, làm gọn ở #236, #237) |
| 2 | Kênh thủ công, link theo dõi `/r/<code>`, ghi nhận nguồn ứng tuyển, trang đích `/tuyen-dung/<slug>`, nội dung bài đăng bằng AI | ✅ Gộp vào `dev` (#239) |
| 3 | Đăng Facebook Page của NTD (OAuth, hẹn giờ, gỡ bài khi kết thúc) | ✅ Gộp vào `dev` (#240) |
| 4 | Sức khỏe chiến dịch (dự báo, cảnh báo), email báo cáo tuần, xuất Excel/PDF | ✅ Gộp vào `dev` (#241) |

Quyết định đã chốt:
- Hai trụ cột: phân phối đa kênh có ghi nhận nguồn; mục tiêu và sức khỏe.
- Giữ một chủ sở hữu.
- Chi phí nhập tay theo kênh, không thanh toán trong hệ thống.
- Tạm dừng giữ bài Facebook, hoàn tất/hủy thì gỡ bài và đóng tin.
- Ghi nhận nguồn: có consent Analytics thì nhớ 30 ngày, không có thì chỉ nhớ
  trong phiên.

GĐ1 đã làm:
- **Mục tiêu**: API ghi được vị trí, cấp bậc, chỉ tiêu, ngày bắt đầu/kết thúc
  hoặc tuyển liên tục, ngân sách. Có ràng buộc ngày và ngân sách (serializer +
  CheckConstraint), không rút ngày kết thúc trước hạn nộp của tin đang tuyển.
  Chiến dịch đã kết thúc không sửa được.
- **Vòng đời**:
  - thêm `scheduled`; kích hoạt chỉ qua `launch/`;
  - tạo nhanh ra `draft` (tạo trong form đăng tin vẫn chạy luôn với
    `activate=true`);
  - hoàn tất/hủy đóng mọi tin đang tuyển (`closed` + lịch sử) qua signal
    `campaign_status_changed`;
  - ghi mốc chạy thật (`first_activated_at`, `active_seconds_accumulated`,
    `ended_at`, `ended_by`) để GĐ4 chia theo số ngày chạy thật; API trả
    `active_days`;
  - hằng số `TERMINAL_STATUSES`/`NON_TERMINAL_STATUSES` thay cho các danh sách
    trạng thái viết cứng ở khóa tài khoản, đối soát hold, gỡ thành viên, khôi
    phục công ty;
  - migration `employers.0065` điền sẵn mốc cho chiến dịch cũ.
- **App mới `apps.campaigns`**:
  - `CampaignLaunchPlan`/`CampaignLaunchJob`;
  - `GET/PUT/POST /api/employer/campaigns/<id>/launch/`: checklist, chọn tin
    nháp để đăng / tin đang hiển thị để gắn, kích hoạt tất cả hoặc không gì cả,
    hoặc lên lịch;
  - beat `run_campaign_schedule` (5 phút): tự kích hoạt đúng ngày bằng cam kết
    đã lưu, lỗi thì giữ `scheduled` và báo một lần cho mỗi loại lỗi; tự hoàn
    tất sau `target_date`; báo trước 3 ngày.
- **Frontend**:
  - trang `/tuyendung/app/campaigns/:id/setup?step=goal|jobs|launch`
    (widget `campaign-setup-wizard`, feature `launch-campaign`,
    `CampaignInfoForm`);
  - tạo chiến dịch xong chuyển sang wizard;
  - form đăng tin mở từ wizard (`return=setup`) lưu nháp xong quay lại bước
    chọn tin;
  - workspace: "Sửa mục tiêu", "Tiếp tục thiết lập", Hoàn tất / Hủy / Hủy lịch
    có xác nhận.
- Wizard GĐ1 có ba bước; bước "Kênh & lịch" thêm ở GĐ2.
- Làm lại giao diện wizard (18/11, nhánh `feat/campaign-setup-ui`, sau phản hồi
  của user):
  - thanh lộ trình hiện trạng thái thật từng bước;
  - bước Kích hoạt mở đầu bằng "Còn N việc" kèm nút đi thẳng tới bước cần sửa,
    hai thẻ chọn cách kích hoạt, dòng "Khi kích hoạt sẽ…";
  - bước Tin có khối "Tạo tin mới" (nhắc bấm Lưu nháp), cảnh báo hạn nộp sau
    ngày kết thúc;
  - style để trong CSS lazy.
- Chốt lại mô hình (18/11): chiến dịch là một **đợt tuyển** nhiều tin. Gỡ vị
  trí, cấp bậc, `headcount_target` ở cấp chiến dịch (`employers.0066`). Chỉ
  tiêu = tổng số lượng tuyển của các tin (`headcount`).
- Làm gọn danh sách và trang chi tiết (18/11, nhánh `feat/campaign-list-detail-ui`):
  - danh sách có dải trạng thái kèm số đếm, mặc định sắp theo trạng thái, mỗi
    dòng một nút việc tiếp theo;
  - "Thêm chiến dịch mới" mở thẳng wizard `/campaigns/new` (bỏ modal nhập tên,
    modal đổi tên);
  - trang chi tiết còn một nút chính, "Sửa thông tin" và menu "Thao tác khác";
    dải bốn thông tin; chỉ số Tổng quan gom thành một dải.
- GĐ2 đã làm (nhánh `feat/campaign-distribution`):
  - **Backend**: app `apps.campaigns` thêm `CampaignChannel` (một kênh một link
    `/r/<code>`), `CampaignChannelCost`, `CampaignChannelClickDaily`;
    `Application.campaign_channel` + `acquisition_channel`; `slug`,
    `landing_intro`, `landing_enabled` cho chiến dịch.
  - **Redirect** đếm lượt bấm không cookie, không lưu IP; `ref` có ký hạn 30
    ngày.
  - **Nội dung AI** qua `ai_core`, có mẫu dự phòng, 20 lượt/ngày.
  - **Báo cáo** so sánh kênh và nguồn tự nhiên; API trang tuyển dụng công
    khai + vỏ SEO (404/410/noindex); bộ lọc `?campaign=` cho danh sách tin.
  - **Frontend**: tab "Kênh & nguồn" (bảng so sánh + thẻ kênh: link, QR, soạn
    AI, sửa nội dung, đánh dấu đã đăng, chi phí); bước "Kênh phân phối" trong
    wizard; trang `/tuyen-dung/:slug`; bắt `?ref=` theo consent và gửi khi ứng
    tuyển; nguồn hiện ở hồ sơ trong trang quản lý CV; Vite proxy `/r`.
  - Lệch kế hoạch có chủ ý: một kênh đúng một link (không tách bảng link);
    sinh nội dung AI đồng bộ, dùng `AiInvocation` sẵn có thay cho bảng lần sinh
    riêng; chưa làm sitemap cho trang tuyển dụng.
  - Sửa kèm: test chiến dịch không còn import thẳng class test của app khác
    (pytest đã chạy lặp các class đó).
- GĐ3 đã làm (#240):
  - provider adapter (`FacebookPageProvider` gọi Graph API có
    `appsecret_proof`, `FakePageProvider` cho dev/CI);
  - OAuth với state ký và nonce một lần; Page token mã hóa Fernet bằng khóa
    riêng, production kiểm tra khóa;
  - `SocialAccountConnection`, `ScheduledSocialPost`; beat đăng mỗi phút, đối
    soát mỗi 5 phút và ngay khi chiến dịch đổi trạng thái (tạm dừng thì hoãn,
    mở lại thì đưa về, kết thúc thì gỡ bài); thử lại có kiểm tra bài trùng;
    token hỏng thì kết nối "Hết hạn" và báo NTD;
  - frontend: trang "Kết nối mạng xã hội" trong Cài đặt tài khoản; khối "Đăng
    tự động lên Fanpage" trong thẻ kênh Fanpage;
  - hướng dẫn Meta App ở `docs/06-deployment/social-integrations.md`,
    ADR-0021.
  - Chưa thử với Meta App thật; cần user tạo app ở Development mode.
- GĐ4 đã làm (#241), công thức ở
  [suc-khoe-chien-dich.md](07-algorithms/suc-khoe-chien-dich.md):
  - `campaign_health`: tốc độ CV, thời gian tới lúc xem, % xem trong 48 giờ,
    tồn đọng, phễu, ngân sách và `burn_ratio`; dự báo
    `F = A + Σ open_s·p_s + v7·R·h` (tỷ lệ trúng tuyển làm trơn Bayes) với trạng
    thái đúng tiến độ / có rủi ro / chậm / chưa đủ dữ liệu, kèm tốc độ cần đạt;
  - `CampaignHealthSnapshot` mỗi ngày (beat mỗi giờ); thông báo
    `campaign_health_alert` khi cảnh báo mới mở, nhắc lại tối đa 7 ngày một lần;
  - email báo cáo tuần sáng thứ Hai (`CampaignReportDelivery` chống gửi trùng,
    tắt được trong Cài đặt thông báo); xuất Excel (`openpyxl`) và PDF (Chromium
    sẵn có của xuất CV, template tự chứa);
  - frontend: tab "Sức khỏe" (trạng thái, cảnh báo kèm việc cần làm, chỉ số,
    phễu, ngân sách, biểu đồ dự báo theo ngày, cách tính), nút tải Excel/PDF;
    sửa chữ chỉ tiêu ở danh sách ("N tin tuyển dụng" + "Cần tuyển M người") và
    đầu trang chi tiết.
  - Lệch kế hoạch có chủ ý: ngưỡng là hằng số, chưa thành site setting; PDF xuất
    đồng bộ (20 lần/giờ) thay cho hàng đợi; chưa có huy hiệu sức khỏe ở danh sách.
  - Sau khi gộp: `docker compose build backend worker beat` (thêm `openpyxl`) rồi
    khởi động lại.
- Đợt sau GĐ4 (#242, 19/11; sơ đồ phân tích ở nhánh `docs/campaign-diagrams`):
  - đã tạo Meta App "ProCV Fanpage" (Development mode) và thử kết nối thật;
    bài đầu thất bại với lỗi Graph 1500 vì link `localhost`: provider giờ chỉ
    gửi `link` khi là địa chỉ công khai, còn lại chèn link vào nội dung;
  - API bài đăng trả `error_message` (lỗi diễn đạt kèm cách xử lý);
  - tab Kênh làm lại: danh sách kênh + chi tiết kênh (Nội dung bài có xem trước
    dạng bài mạng xã hội, Đăng Fanpage, Link & QR, Chi phí); ngăn soạn bài
    Fanpage có xem trước, đăng ngay / hẹn giờ (gợi ý khung giờ) / đăng nhiều lần;
    lịch sử bài dạng dòng thời gian; chi phí chuyển từ popup vào mục riêng có
    giải thích, chọn nhanh loại chi và số tiền; hộp Thêm kênh chọn nền tảng bằng
    ô có biểu tượng;
  - tab Lịch sử hoạt động: timeline một dòng (giờ, chấm theo nhóm, dòng phụ),
    lọc bằng dải nút;
  - settings test luôn dùng provider giả, không phụ thuộc `.env` máy dev;
  - sơ đồ mục 3.2 nhóm `09-chien-dich-tuyen-dung` vẽ lại theo luồng mới:
    use case (20, thêm tác nhân Bộ lập lịch, Facebook, Ứng viên), 5 sơ đồ tuần
    tự và 5 sơ đồ hoạt động (thiết lập và kích hoạt, vòng đời, phân phối đa
    kênh, đăng Fanpage, sức khỏe và báo cáo).
- Thêm lại cùng loại kênh (nhánh `fix/campaign-channel-reuse`): hộp Thêm kênh
  gợi ý tên không trùng (kèm tên tin khi link dẫn tới một tin, còn trùng thì
  đánh số), chặn tên trùng ngay trên form — trước đây tên tự điền luôn là tên
  loại kênh nên Fanpage thứ hai (cho tin khác) bị backend từ chối.
- Một kênh đăng nhiều bài, nhiều tin (nhánh `feat/campaign-channel-posts`):
  - kênh chỉ còn là nơi đăng (bỏ "Link dẫn tới" khi thêm kênh); migration
    campaigns 0003 đổi `job` thành `jobs` (M2M), kênh cũ trỏ một tin giữ tin
    đó với link riêng từng tin;
  - bước soạn bài chọn tin trong bài và link dẫn tới trang chiến dịch, từng tin
    (mỗi tin một link `/r/<code>/<mã tin>`) hoặc trang công ty
    (`/r/<code>/cong-ty`); AI và mẫu chèn đủ link từng tin;
  - tab Link & QR liệt kê mọi link của kênh, chọn link để tạo QR;
  - link tin/công ty chỉ mở trang đó khi chiến dịch đang chạy và tin thuộc
    chiến dịch, còn lại về trang tuyển dụng; lượt bấm vẫn tính cho kênh.
- Gộp luồng đăng bài (nhánh `feat/campaign-post-flow`): hai tab "Nội dung bài"
  và "Đăng Fanpage" thành một tab **Bài đăng** theo 3 bước đánh số (Chọn tin và
  link → Soạn nội dung → Đăng bài). Bước 3 đổi theo kênh: Fanpage có nút "Đăng
  lên Fanpage" (mở ngăn chọn trang, ảnh, giờ đăng) và lịch sử bài ngay dưới;
  kênh khác có "Sao chép bài" và ô đánh dấu đã đăng. Tab kênh còn Bài đăng ·
  Link & QR · Chi phí; bỏ mục "Sửa nội dung" trùng ở menu kênh.
- Làm gọn tab Bài đăng (nhánh `feat/campaign-post-composer`): tab chỉ còn một
  dòng hướng dẫn, nút **Soạn bài** và danh sách bài (Fanpage: thẻ bài có nhãn
  trạng thái màu, giờ, ảnh thu nhỏ, tóm tắt 2 dòng; kênh đăng tay: thẻ bài đang
  dùng với Sao chép · Sửa · Đã đăng). Mọi bước soạn dồn vào ngăn **Soạn bài**
  dùng chung cho mọi kênh: chip tin ngắn (tiêu đề dài tự trượt, tắt khi giảm
  chuyển động), ô chọn link dẫn tới, ô nội dung chứa link thật kèm nút **Chèn
  link** (chèn đúng chỗ con trỏ, chưa đặt thì cuối bài) và Soạn bằng AI, xem
  trước; Fanpage thêm trang, ảnh, giờ đăng; kênh khác "Lưu và sao chép". Bỏ hộp
  Sửa tay với chuỗi `{link}`.
- Giải thích chỉ số (nhánh `feat/campaign-metric-help`): `shared/ui/HelpTip`
  (icon ? có tooltip, bấm được bằng bàn phím) ở bảng so sánh nguồn, chi tiết
  kênh, chi phí, tab Sức khỏe, Tổng quan và đầu trang chiến dịch.
- Ảnh trong bài Fanpage (#245): tải tối đa 4 ảnh
  hoặc dùng ảnh bìa/logo công ty; ảnh mã hóa lại, bỏ EXIF; đăng bằng
  `/photos` (chưa công khai) + `/feed` với `attached_media`, chạy được ở máy cục
  bộ vì gửi thẳng tệp. Migration `campaigns.0005` (thêm `images`).
- Còn mở: chưa xem bằng mắt trên trình duyệt (đã có test API và test giao diện);
  `openapi.yaml` được sinh lại nên kéo theo phần lệch tích tụ từ các tính năng
  trước.
- Khung tự đăng nhiều mạng xã hội (ADR-0025, nhánh `feat/social-networks-core`,
  PR1/5). Bốn mạng sẽ thêm, mỗi mạng một PR: Instagram Business, Threads,
  LinkedIn, Zalo OA. PR này chưa thêm mạng nào.
  - Mạng khai báo ở `campaigns/domain/social_networks.py` kèm giới hạn: số ký
    tự, số ảnh, có bắt buộc ảnh không, có gỡ bài được không.
  - Migration campaigns 0004–0006 (thêm cột, chép dữ liệu, đổi cột; tách ba bước
    vì Postgres không ALTER bảng còn trigger chờ): `provider` thành `network` +
    `simulated`, các cột `page_*` thành `account_*`; nhãn trạng thái "Đã gỡ bài"
    và "Cần tự gỡ bài".
  - `CAMPAIGN_SOCIAL_LIVE_NETWORKS` bật thật hay giả lập theo từng mạng; vẫn
    hiểu `CAMPAIGN_SOCIAL_PROVIDER=facebook`.
  - API `/social/<network>/...` cùng `GET /social/networks/`; giữ
    `/social/facebook/callback/` vì đã khai với Meta.
  - Mạng không gỡ được bài thì giữ bài và báo NTD tự gỡ (`delete_unsupported`).
  - Trang Kết nối mạng xã hội thành lưới thẻ, mỗi mạng một thẻ. Ngăn soạn bài
    lấy giới hạn ký tự và số ảnh từ API. `ChannelIcon` chuyển xuống entity
    campaign.
- Instagram doanh nghiệp (nhánh `feat/social-instagram`, PR2/5).
  - Kết nối qua Facebook Login, dùng chung Meta App; chỉ hiện các Fanpage đã
    liên kết Instagram.
  - Đăng bài một ảnh hoặc carousel (tối đa 10 ảnh); ảnh là bắt buộc.
  - Ảnh lệch tỷ lệ được tạo thành JPEG thêm viền trắng, trong khoảng 4:5 đến
    1.91:1; khung xem trước hiện đúng như vậy.
  - Tự gỡ bài khi chiến dịch kết thúc (`instagram_manage_contents`).
  - Lỗi giới hạn số bài trong 24 giờ (mã 9) được thử lại.
  - Thêm kênh `instagram` (migration campaigns 0007) và lớp chung
    `MetaGraphProvider`.
  - Còn mở: chưa thử đăng thật vì cần tài khoản Instagram chuyên nghiệp liên kết
    Fanpage và bật use case Instagram trong Meta App.

## Ứng tuyển bằng CV tải lên và form ứng tuyển mới (2026-11-18)

Đối chiếu quy trình ứng tuyển của TopCV (trang Hỏi đáp + form thực tế) rồi chốt
luồng cho ProCV.

- Lỗi tìm thấy: từ đợt 15/11, ứng tuyển đòi nội dung có cấu trúc nên **mọi CV
  tải lên đều bị chặn** (19/19 CV trong DB local), còn mục "Tải CV từ máy tính"
  trong form chờ một bước phân tích không bao giờ chạy rồi báo lỗi sau 60 giây.
- CV tải lên được nộp bằng **tệp gốc**: `application_readiness_issues(cv, version)`
  chỉ đòi có tệp (tệp đã qua tiêu chuẩn upload). Khi nộp, bản chụp hồ sơ giữ một
  bản sao riêng của tệp (`CvVersion.source_file_key/type`, migration `cvs.0018`,
  có `db_default` vì migration cũ tạo version bằng model lịch sử) nên ứng viên
  xóa CV thì NTD vẫn đọc được; xóa bản chụp thì tệp bị dọn theo.
- Nộp CV tải lên bắt buộc họ tên, email, số điện thoại (điền sẵn từ tài khoản).
- NTD: `GET /api/employer/applications/<id>/cv/file/` trả PDF (DOCX được
  đổi sang PDF), `?download=1` để tải và báo ứng viên như tải bản dựng. Khung
  xem trước hiện đúng tệp đó. Với CV dạng tệp: không tạo bản dựng PDF, không tạo
  link mời người ngoài đánh giá (không ẩn danh được thông tin trong tệp).
- CV online tạo từ mẫu nhưng chưa bấm Lưu lần nào (`has_saved_version=false`)
  không hiện khi chọn CV ứng tuyển / xem độ phù hợp; API nộp hồ sơ và API phân
  tích (`cv_not_saved`) đều từ chối. CV có chỉnh sửa chưa lưu vẫn nộp được bản
  đã lưu gần nhất, kèm nhãn nói rõ.
- CV tải lên không còn nút "Sửa CV"; mở `/cvs/<id>/edit` của CV tải lên sẽ
  chuyển sang trang xem.
- Form ứng tuyển làm lại gọn: nhãn "CV ứng tuyển gần nhất" (đưa lên đầu, chọn
  sẵn), nút "Xem" luôn hiện, CV chưa đủ thông tin bị khóa kèm "Sửa CV", form
  liên hệ mở ngay trong thẻ CV dạng tệp, "Sử dụng thư giới thiệu gần nhất", khối
  lưu ý thu gọn. Style nằm trong `apply-form.css` và `cv-choice.css` (không thêm
  utility vào CSS khởi tạo).
- Màn tải CV thành công: "Xem CV tải lên của tôi" mở trang xem của đúng CV vừa
  tải ở thẻ mới.
- Chủ ý khác TopCV: tệp không đọc được chữ vẫn bị từ chối ngay cả ở bước ứng
  tuyển (AI độ phù hợp cần chữ); chưa có giới hạn 50 lượt/24 giờ và 200 lượt/30
  ngày; vẫn cho rút hồ sơ theo quyết định 16/11.
- Còn mở: chưa kiểm tra bằng mắt phía NTD trên trình duyệt (đã có test API và
  test giao diện); bản chụp CV không bị xóa khi xóa tài khoản ứng viên (hành vi
  có từ trước) nên tệp nộp kèm cũng còn lại.

## Bảng điều khiển quản trị (2026-11-16)

| Hạng mục | Trạng thái |
| --- | --- |
| `GET /api/admin/dashboard/?period=7\|30\|90`: hàng chờ, KPI so kỳ trước, xu hướng, phễu, an toàn, ngành nghề, AI | 🟨 Xong trên nhánh `feat/admin-dashboard` |
| Trang chủ quản trị: khối "Cần xử lý" xếp theo hạn xử lý, KPI, biểu đồ, panel sức khỏe nền tảng | 🟨 Xong trên nhánh `feat/admin-dashboard` |
| Sidebar sáng đồng bộ dashboard: badge mọi hàng chờ (đỏ khi quá hạn), cụm tài khoản + đăng xuất ở đáy, bỏ ô tìm chức năng | 🟨 Xong trên nhánh `feat/admin-dashboard` |
| Header: breadcrumb, nút Tạo mới, chuông hàng chờ, trợ giúp (sắp ra mắt), menu tài khoản | 🟨 Xong trên nhánh `feat/admin-dashboard` |

<details><summary>Ghi chú chi tiết</summary>

- Hàng chờ dùng lại summary của từng miền (xác thực NTD, công ty, tin, FAQ) nên
  khớp số trên badge sidebar. Hạn xử lý: báo cáo và tin nộp lại 48 giờ, còn lại
  72 giờ; quá hạn xếp đầu và tô đỏ.
- Số truy vấn cố định (test khẳng định không tăng theo dữ liệu); kỳ thống kê
  nằm trên URL (`?period=`), tự làm mới mỗi 60 giây.
- Phễu ứng tuyển tính theo giai đoạn đã đến (`viewed_at`, `shortlisted_at`...)
  của hồ sơ nộp trong kỳ; "tin chưa có hồ sơ" dùng `EXISTS` trên hồ sơ hiện hành.
- CSS riêng nằm trong chunk lazy của trang (không tăng CSS khởi tạo).
- Badge sidebar và chuông header đọc chung `GET /api/admin/dashboard/queues/`
  (thay ba request summary riêng của layout); lời mời quản trị vẫn lấy từ
  summary tài khoản vì chỉ superuser thấy.
- Kiểm tra: pytest `apps/dashboard` 10 passed; vitest widget/entity; smoke E2E
  `admin-dashboard.spec.js` pass ở mobile, tablet, desktop.

</details>

## Ảnh đại diện dùng chung 3 cổng (2026-11-16)

| Hạng mục | Trạng thái |
| --- | --- |
| Modal "Chỉnh sửa ảnh đại diện" (cắt vuông, xem trước tròn, đổi/xóa ảnh) ở thẻ chào và trang thông tin cá nhân | 🟨 Xong trên nhánh `feat/avatar-editor` |
| `DELETE /api/auth/avatar/`; upload thu nhỏ ảnh quá 1024 px | 🟨 Xong trên nhánh `feat/avatar-editor` |
| Cổng NTD (Thông tin tài khoản) và quản trị (Tài khoản của tôi → Hồ sơ) dùng chung modal | 🟨 Xong trên nhánh `feat/avatar-editor` |

<details><summary>Ghi chú chi tiết</summary>

- Kiểm tra phía client: JPG/PNG/WebP, tối đa 5 MB, cạnh ngắn tối thiểu 200 px,
  tệp phải đọc được. Backend vẫn kiểm tra chữ ký tệp, dung lượng và decode ảnh.
- Ảnh được cắt trong trình duyệt (canvas) thành JPEG vuông tối đa 400 px; chỉ
  ảnh đã cắt được gửi lên. "Xong" mới tải lên/xóa, "Đóng lại (Không lưu)" bỏ
  mọi thay đổi.
- "Tài khoản đã xác thực" ở cổng ứng viên chỉ dựa vào `email_verified` (xác
  thực email qua link/mã, đăng nhập Google, đặt lại mật khẩu, đổi email).
- Kiểm tra: pytest avatar 5 passed, vitest edit-profile + trang tài khoản 25
  passed, E2E smoke avatar 3 viewport passed, CSS ban đầu 37,9/38,5 KiB.
- Modal nằm ở `features/common/account/edit-profile` (`AvatarEditorModal`), được widget
  `employer-account-settings` và `admin-account-settings` dùng lại; hai widget
  có test mở modal.

</details>

## Dọn mâu thuẫn còn lại sau thống nhất luồng (2026-11-16)

Quyết định nghiệp vụ đã chốt với user ngày 16/11:
- Owner **duyệt tham gia** công ty, admin **xác thực tài khoản** NTD. Đây là hai bước tách rời.
- Công ty không có owner đủ điều kiện thì admin duyệt yêu cầu tham gia.
- Chặn ứng viên áp dụng theo công ty.
- Đồng hồ "chưa phản hồi" tính từ ngày nộp.
- Ứng viên chỉ thấy trạng thái đã công bố.

| GĐ | Nội dung | Trạng thái |
| --- | --- | --- |
| A | Owner đủ điều kiện mới duyệt tham gia, admin duyệt khi không có owner, chuyển quyền/chỉ định owner, chặn ứng viên gắn công ty; màn công ty của owner tách tab "Thông tin công ty" / "Thành viên" | ✅ Gộp vào `dev` (#223) |
| B | Nút của ứng viên theo trạng thái đã công bố, rút được hồ sơ khi tin ngừng tuyển, một đồng hồ phản hồi, dashboard admin đếm mọi lượt nộp | ✅ Gộp vào `dev` (#224) |
| C | Ngày theo giờ VN (email "còn X ngày", tác động thu hồi xác thực, ngày mục tiêu, quota AI); bù thời gian hiển thị khi tin bị ẩn; chặn gửi duyệt lại khi chưa sửa nội dung | ✅ Gộp vào `dev` (#222) |

| Dọn | Bù thời gian cho mọi lần ẩn do nền tảng; một định nghĩa owner đủ điều kiện; cảnh báo nộp hàng loạt theo công ty; người nhận nhắc dự phòng; luật ứng tuyển lấy từ API | 🟨 Xong trên nhánh `fix/flow-loose-ends` |

| Thành viên | Tab Thành viên cho quản lý công ty: thẻ thành viên đầy đủ (xác thực chi tiết, ngày tham gia, người duyệt, hoạt động tuyển dụng), cấp/thu quyền biên tập, chuyển quyền quản lý, gỡ thành viên; đổi chữ "owner" thành "Quản lý công ty" | ✅ Gộp vào `dev` (#226) |

| Tiếp quản | Quản lý công ty giao toàn bộ tin và chiến dịch của một người (đang ở công ty hoặc đã rời) cho thành viên đã xác thực; mục "Người đã rời công ty" | ✅ Gộp vào `dev` (#227) |

| Sửa xác thực sau khi rời công ty | Một định nghĩa "đã xác minh SĐT" (`RecruiterProfile.has_verified_phone`, so số đã chuẩn hóa +84); thu hồi toàn bộ giấy tờ của công ty cũ khi rời; danh sách giấy tờ chỉ theo công ty hiện tại; dọn dữ liệu cũ | 🟨 Xong trên nhánh `fix/phone-verified-single-source` |

<details><summary>Ghi chú sửa xác thực</summary>

- Lỗi "xác minh SĐT thành công nhưng vẫn bị bắt xác minh": cờ `onboarding.phone_verified` lấy từ tiêu chí huy hiệu tin cậy của công ty, nên luôn `False` khi NTD chưa có công ty hoặc vừa bị gỡ. Nay mọi nơi (readiness, checklist, cấp tài khoản, huy hiệu, admin) dùng chung `has_verified_phone`. Migration employers 0063 đồng bộ `contact_phone` và `user.phone` theo số đã xác minh, ở dạng +84.
- Lỗi "rời công ty rồi vào lại vẫn hiện giấy tờ Đã duyệt": trước đây khi rời chỉ thu hồi giấy tờ chưa duyệt. Nay thu hồi mọi giấy tờ của công ty cũ, và danh sách "giấy tờ của tôi" lọc theo công ty hiện tại. Migration 0064 đặt `is_current=False` cho giấy tờ thuộc hồ sơ xác thực đã bị đặt lại hoặc thuộc công ty khác.

</details>

<details><summary>Ghi chú tiếp quản</summary>

- `POST /api/employer/company/handover/` với `{source, target}` là `member_id`. Chiến dịch được chuyển trước, rồi đến tin, vì tin chỉ được nằm trong chiến dịch do chính người đăng sở hữu. Hồ sơ ứng tuyển và lịch sử đi theo tin. Ghi `EmployerCompanyLinkEvent.RESOURCES_HANDED_OVER` và gửi thông báo `jobs_handed_over` (migration employers 0062 chỉ đổi nhãn).
- `GET /api/employer/company/former-members/` liệt kê những người đã rời nhưng vẫn đứng tên tin hoặc chiến dịch tại công ty, kèm số hồ sơ đang chờ.
- Gỡ một thành viên còn tin đang tuyển: giao tin cho người khác trước, sau đó gỡ được.

</details>

<details><summary>Ghi chú tab Thành viên</summary>

- `GET /api/employer/company/members/` chỉ quản lý công ty đủ điều kiện mới gọi được. Dữ liệu lấy bằng số query cố định (`company_members_queryset`). Email và SĐT được che một phần.
- `POST /api/employer/company/members/<member_id>/remove/` yêu cầu nhập lý do. Bị chặn khi thành viên còn tin đang tuyển, còn chiến dịch đang mở, hoặc đang bị giữ để kiểm tra tuân thủ. Không gỡ được quản lý công ty. Khi gỡ, hồ sơ xác thực của thành viên (kể cả đã duyệt) trở về bản nháp, quyền biên tập trang bị thu hồi, ghi `EmployerCompanyLinkEvent.MEMBER_REMOVED` và gửi thông báo cho thành viên.
- Vai trò `owner` giữ nguyên trong dữ liệu. Mọi chữ hiển thị (NTD, admin, thông báo, lỗi) đổi thành "Quản lý công ty" (migration employers 0061 chỉ đổi nhãn).

</details>

<details><summary>Ghi chú phần dọn</summary>

- `give_back_hidden_time` (`apps/jobs/models/visibility.py`) cộng lại thời gian bị ẩn khi gỡ: khóa tài khoản (`policy_held_at`), giữ để kiểm tra tuân thủ (`applied_at`, chỉ khi recruiter không còn lệnh giữ nào khác) và ẩn trang công ty (lần `POLICY_HOLD_APPLIED` gần nhất). Các lần ẩn mà NTD tự khắc phục được (hạn nộp, DPA, hồ sơ chưa đủ) không được bù.
- `eligible_owners_queryset()` = người đại diện đủ điều kiện, có vai trò owner, không bị giữ để kiểm tra tuân thủ. Duyệt tham gia, hàng đợi admin, danh sách thành viên và chỉ định owner đều dùng định nghĩa này.
- Cảnh báo nộp hàng loạt tính theo công ty. Nhắc NTD gửi theo thứ tự: người đăng tin → owner đủ điều kiện → mọi NTD còn hoạt động của công ty.
- `GET /api/public/applications/rules/` trả về: số lần nộp tối đa, thời gian chờ nộp lại, mốc ứng viên được nhắc, các lựa chọn thời hạn tự từ chối, số ngày cảnh báo và số ngày ân hạn email. Frontend không còn chép tay các con số này. Form đăng tin ghi rõ thời hạn "tính từ ngày ứng viên nộp".
- Đã chốt là thiết kế, không sửa: hồ sơ trên tin của đồng nghiệp bị từ chối do chặn ứng viên thì không hoàn tác được; gỡ chặn xong thì ứng viên nộp lại.

</details>

<details><summary>Ghi chú GĐ B</summary>

- `Application.candidate_visible_status()` là trạng thái ứng viên đã được báo (dựa trên `ApplicationStatusHistory.objects.published()`). Mọi luật phía ứng viên đều dùng giá trị này: các nút, ứng tuyển lại, nhắc NTD, rút hồ sơ. Rút hồ sơ khi quyết định chưa công bố thì quyết định đó bị hoàn tác và thông báo bị hủy.
- Được rút hồ sơ khi tin đã ngừng tuyển. Thanh tiến trình dừng ở bước thật, bước kế tiếp hiện "NTD ngừng tuyển".
- Tự từ chối tính từ `applied_at`. Mở CV không làm đồng hồ chạy lại. Nếu NTD hoàn tác về trạng thái chưa phản hồi, `auto_reject_due_floor` đảm bảo còn ít nhất 3 ngày và cảnh báo được gửi lại. Đã bỏ `Application.submitted_at` (migration applications 0021).
- Nhắc NTD sau 3 và 7 ngày chỉ chạy khi tin còn nhận hồ sơ. Nếu ứng viên đã nhắc trong 24 giờ trước đó, hệ thống ghi mốc nhưng không gửi thêm. Người đăng tin đã rời công ty thì nhắc gửi cho owner. Email báo tự từ chối luôn được gửi, kể cả khi NTD đã tắt tính năng sau đó.
- Dashboard admin: biểu đồ và KPI "hồ sơ mới" đếm mọi lượt nộp. Chỉ số tồn đọng đếm cả "Mới" lẫn "Đã xem" quá 7 ngày. Ở mục các lần nộp trước, NTD thấy hồ sơ cũ từng đến vòng nào.

</details>

<details><summary>Ghi chú GĐ A</summary>

- "Duyệt tham gia" do owner làm (`CompanyJoinRequest`). "Xác thực tài khoản" do admin làm (`EmployerVerificationCase`). Owner chỉ được duyệt khi tài khoản đang hoạt động và nằm trong `eligible_representatives_queryset`.
- Công ty không có owner đủ điều kiện thì admin duyệt thay: `/api/admin/company-join-requests/`, hàng đợi `company_join_requests` trên dashboard và sidebar, tab "Yêu cầu tham gia" ở trang Công ty và trang chi tiết công ty. Khi công ty đã có owner đủ điều kiện, admin chỉ xem được.
- Owner chuyển quyền cho thành viên đã xác thực ở tab "Thành viên" (`/api/employer/company/ownership-transfer/`). Admin chỉ định owner (`/api/admin/companies/<id>/assign-owner/`) chỉ khi công ty không có owner đủ điều kiện. Mỗi thay đổi ghi một `EmployerCompanyLinkEvent`.
- `CandidateBlock.company` (migration applications 0020, có backfill) gắn lệnh chặn với công ty, nên chặn có hiệu lực trên mọi tin của công ty. Hồ sơ đang chờ trên tin của đồng nghiệp bị từ chối qua `reject_blocked_application`. Người chặn và owner được gỡ chặn. Lệnh chặn ở lại công ty khi người chặn rời đi.

</details>

<details><summary>Ghi chú GĐ C</summary>

- Mọi chỗ dùng `timezone.localdate()` / `date.today()` ngoài migrations và tests đã chuyển sang `vietnam_today()` / `vietnam_day_start()`. Áp dụng cho cả bucket `AiUsageDaily` và cửa sổ thống kê AI.
- Khi khôi phục tin, `visibility_ends_at` được cộng thêm thời gian từ `moderation_held_at` đến lúc khôi phục; hạn nộp giữ nguyên. Chuyển từ hold này sang hold khác vẫn giữ mốc ẩn ban đầu.
- `Job.moderation_content_digest` (migration jobs 0054) lưu băm `build_job_content_snapshot` lúc admin yêu cầu sửa. Gửi duyệt lại mà băm không đổi thì bị từ chối.

</details>

## Thống nhất luồng đăng tin, hiển thị, ứng tuyển, công ty (2026-11-15)

Rà soát luồng thấy nhiều khái niệm có nhiều nơi tự tính (trạng thái tin tính ở
8 chỗ với 2 múi giờ, quyền đăng tin và quyền nhận hồ sơ mỗi thứ có 2 bộ điều
kiện), dẫn đến luật bị lách và UI hứa tính năng chưa có. Mục tiêu: mỗi khái
niệm chỉ một hàm làm nguồn sự thật. Làm xong đợt này rồi mới tiếp tục AI; mỗi
giai đoạn một PR vào `dev`.

Quyết định đã chốt: tài nguyên vẫn theo từng NTD nhưng chặn ứng viên tính cho
cả công ty và tham gia công ty cần owner duyệt; bắt buộc xác thực + DPA trước
khi đăng tin; mở lại tin áp luật như gia hạn, không tính lượt; mỗi ứng viên chỉ
một hồ sơ hiệu lực trên một tin, có trạng thái "Đã rút"; tin bị ẩn vì lý do sửa
được thì có vòng yêu cầu sửa; công ty bị ẩn, mất DPA hoặc dính compliance hold
thì tin tự ẩn và tự hiện lại khi khắc phục; gỡ cờ `JOB_LIFECYCLE_V2_MODE`; "Đang
tuyển" chỉ đếm tin đang công khai, luôn theo giờ Việt Nam; tìm hồ sơ cho NTD làm
thật trong hạng mục AI.

| GĐ | Hạng mục | Trạng thái |
| --- | --- | --- |
| 1 | Trạng thái hiệu lực của tin + lý do ẩn, giờ VN, bộ lọc công khai khớp quyền xem dữ liệu ứng viên | ✅ Gộp vào `dev` (#209) |
| 2 | Dùng chung điều kiện chặn đăng tin; mở lại tin áp luật gia hạn | ✅ Gộp vào `dev` (#211) |
| 3 | Một hồ sơ hiệu lực trên một tin, rút hồ sơ, tự động từ chối và thống kê chỉ tính hồ sơ hiệu lực | ✅ Gộp vào `dev` (#213) |
| 4 | Vòng yêu cầu sửa tin → NTD sửa → gửi duyệt lại | ✅ Gộp vào `dev` (#214) |
| 5 | Chặn ứng viên theo công ty, owner duyệt yêu cầu tham gia, logic công ty vào service, gỡ liên kết công ty, SMS dev | ✅ Gộp vào `dev` (#215) |
| 6 | Tắt đồng ý tìm hồ sơ thì gỡ mọi CV khỏi tìm kiếm; sửa câu chữ hứa tính năng chưa có | ✅ Gộp vào `dev` (#208) |

<details><summary>Ngừng tuyển và trang "Việc làm đã ứng tuyển" mới (16/11)</summary>

- NTD **ngừng tuyển** (đổi tên từ "Đóng tin"; tin hết hạn nộp/hết thời gian hiển
  thị cũng tính là ngừng tuyển). Tin ngừng tuyển vẫn xem được chi tiết
  (`accepting_applications=false`, `stopped_at`), nút ứng tuyển thay bằng nhãn
  "Hết hạn ứng tuyển" + nút "Xem việc làm liên quan" cuộn xuống cuối trang; tin
  bị ẩn do kiểm duyệt/công ty vẫn trả 404.
- Trang "Việc làm đã ứng tuyển" làm lại theo mẫu TopCV: banner hướng dẫn "Nhắc
  NTD", bộ lọc luôn đủ 8 trạng thái (cuộn hai chiều), dòng trạng thái nổi bật
  ("NTD ngừng tuyển vị trí này (giờ)", "NTD đã xem CV. ProCV đã nhắc NTD…"),
  thanh 5 bước có hiệu ứng trượt/ánh sáng, tiến trình chi tiết thu gọn được.
  Mốc ngừng tuyển thắng nếu đến sau mọi thao tác của ứng viên; hồ sơ đã có kết
  quả giữ kết quả. Tin đã ngừng tuyển thì không còn nút Nhắc NTD/Rút hồ sơ.
- **Bỏ tính năng "Đổi CV"** (API `applications/<id>/cv/`, action `update_cv`):
  muốn nộp CV khác thì rút hồ sơ rồi ứng tuyển lại (tốn 1 lượt).

</details>

<details><summary>Hoàn thiện luồng ứng tuyển: nhắc NTD, lịch sử nộp (16/11)</summary>

- Nhắc NTD (`ApplicationReminder`, thông báo `application_awaiting_reply`):
  hệ thống tự nhắc khi hồ sơ chưa phản hồi 3 ngày và 7 ngày (gom một thông báo
  mỗi tin, task `send_unanswered_application_reminders` chạy mỗi giờ); ứng viên
  có nút "Nhắc NTD" sau 3 ngày kể từ khi nộp, tối đa 2 lần, cách nhau 3 ngày.
  Mỗi lần nhắc là một mốc "ProCV đã nhắc nhà tuyển dụng phản hồi CV của bạn"
  trong lịch sử ứng tuyển của ứng viên; NTD thấy lần nhắc gần nhất trong khung
  xử lý hồ sơ.
- NTD thấy đúng "Lần N" của hồ sơ hiện tại và mục "Các lần nộp trước" (chỉ xem,
  kèm kết quả: đã rút, không phù hợp).

</details>

<details><summary>Ghi chú GĐ5</summary>

- Tham gia công ty có sẵn tạo `CompanyJoinRequest` chờ chủ công ty duyệt (thông
  báo cho owner và người xin); chỉ khi duyệt mới gán `RecruiterProfile.company`
  với vai trò thành viên. Người xin thấy thẻ "Đang chờ duyệt" và hủy được để
  chọn công ty khác; owner duyệt/từ chối ở trang Thông tin công ty. Logic tạo
  và tham gia công ty nằm ở `employers/services/company_membership.py`.
- Chặn ứng viên tính cho cả công ty khi nộp hồ sơ (`is_candidate_blocked_for_job`);
  "từ chối hồ sơ chờ" khi chặn vẫn chỉ trên tin của chính NTD đó.
- Gỡ liên kết công ty (admin) chia 3 nhóm: không chặn (nhu cầu tuyển dụng, lịch
  sử xác thực, tin nháp/đã đóng); tự rút khi gỡ (hồ sơ xác thực chưa duyệt về
  nháp kèm sự kiện `withdrawn_by_unlink`, giấy tờ chưa duyệt, yêu cầu cập nhật
  đang chờ); chặn kèm cách xử lý (đã duyệt xác thực, còn tin đang tuyển, chiến
  dịch chưa kết thúc, compliance hold, chủ công ty còn thành viên khác).
- SMS OTP trên dev: `EMPLOYER_SMS_OTP_ENABLED=True`, `EMPLOYER_SMS_PROVIDER=console`
  (đổi `backend/.env` xong phải `docker compose up -d backend worker`), mã OTP
  hiện trong `docker logs -f ai-recruitment-platform-worker-1`. Production chỉ
  cho phép provider `http` và cần adapter riêng cho nhà cung cấp được chọn.

</details>

<details><summary>Ghi chú GĐ4</summary>

- Quản trị viên có thao tác "Yêu cầu chỉnh sửa", chỉ với lý do sửa được (thiếu
  nội dung, gây hiểu nhầm, trùng lặp, khác); tin chuyển hold
  `changes_requested`, vẫn ẩn, NTD nhận thông báo kèm ghi chú cần sửa.
- NTD sửa được tin, rồi bấm "Gửi duyệt lại"; sau đó khóa tới khi admin khôi phục
  hoặc yêu cầu sửa tiếp. Hàng chờ admin có bộ lọc "Chờ duyệt lại", ô tổng hợp
  đếm số tin chờ.
- Lý do nặng (bị cấm, lừa đảo, báo cáo đã xác nhận) vẫn khóa cứng. Cập nhật
  [ADR-0014](02-tong-quan/adr-0014-job-post-moderation.md).

</details>

<details><summary>Ghi chú GĐ3</summary>

- `Application.is_current` + ràng buộc unique có điều kiện: mỗi ứng viên chỉ một
  hồ sơ hiệu lực trên một tin; bản nộp cũ là lịch sử chỉ đọc. Migration
  `applications.0018` đánh dấu bản mới nhất của mỗi cặp là hiệu lực (sao lưu
  `backups/pre-application-single-active-20261116.dump`).
- Trạng thái mới `withdrawn` ("Đã rút"): ứng viên rút được khi hồ sơ chưa có kết
  quả, NTD nhận thông báo trong chuông, thông báo quyết định đang chờ gửi bị hủy;
  NTD không đổi được trạng thái hồ sơ đã rút.
- Nộp lại chỉ khi hồ sơ hiệu lực đã bị từ chối hoặc đã rút (vẫn giữ trần 3 lần
  và chờ 5 phút).
- Tự động từ chối, nhắc hạn, chặn ứng viên kèm từ chối hồ sơ chờ, dashboard,
  danh sách/xuất CSV của NTD, thống kê chiến dịch và tin chỉ tính hồ sơ hiệu lực;
  `application_count` đếm ứng viên, không đếm lượt nộp.
- Ứng viên: trang "Việc làm đã ứng tuyển" có nút "Rút hồ sơ"; nút ở
  trang tin hiện "Đã ứng tuyển" khi hồ sơ đang được xử lý.

</details>

<details><summary>Sửa migration test đỏ sẵn trên dev</summary>

- `ApplicationSnapshotMigrationTests.test_mismatched_snapshot_is_refused` xóa
  `CvVersion` bằng model runtime khi schema đang ở mốc cũ; Django lan phép xóa
  sang `matching_matchdocument` (app matching mới) chưa tồn tại ở mốc đó, test
  hỏng giữa chừng và kéo theo các test migration khác trong cùng worker. Giờ xóa
  bằng model của trạng thái migration đang áp dụng.

</details>

<details><summary>Ghi chú GĐ2</summary>

- `employer_job_posting_context` tính `job_postable` bằng đúng các điều kiện
  `publish_job` chặn (xác thực đã duyệt, DPA hiện hành, không compliance hold)
  và trả `publish_blockers`; banner hạn mức ở đầu form liệt kê từng điều kiện
  kèm liên kết khắc phục, câu chữ quota lấy số lượt Cấp 3 từ site settings
  (`verified_publish_limit`).
- `_ensure_public_lifetime` dùng chung cho gia hạn và mở lại: trần 90 ngày tính
  từ lần duyệt đầu, hạn nộp không vượt thời gian hiển thị, không quá ngày kết
  thúc chiến dịch. Mở lại vẫn không tính lượt; hết vòng đời thì phải nhân bản.
- Gia hạn kiểm tra lại xác thực, DPA, compliance hold như khi đăng; sửa lỗi
  crash khi tin không có hạn nộp.
- Sửa e2e smoke danh sách tin đỏ sau GĐ1 (mock thiếu `effective_state`).

</details>

<details><summary>Ghi chú GĐ1</summary>

- Nguồn duy nhất ở `apps/jobs/models/querysets.py` (xem
  [ADR-0019](02-tong-quan/adr-0019-job-effective-state.md)): danh sách điều kiện
  công khai có mã, nhãn, hành động khắc phục; `JobState` gồm nháp, đang tuyển,
  bị ẩn, hết hạn, đã đóng. Danh sách tin NTD, chiến dịch, dashboard, admin và
  lý do chặn ở trang kiểm duyệt đều đọc từ đây, luôn theo lịch Việt Nam
  (`common/vietnam_time.py`).
- Bộ lọc công khai bắt buộc xác thực đã duyệt, DPA hiện hành, không compliance
  hold của NTD và trang công ty không bị ẩn, tức khớp `candidate_data_access`.
  `create_application_record` kiểm tra lại dưới khóa, kèm việc chặn ứng viên
  (chuyển từ serializer vào service).
- Gỡ cờ `JOB_LIFECYCLE_V2_MODE`; migration `jobs.0052` điền cửa sổ hiển thị cho
  tin còn thiếu mốc.
- NTD thấy tab "Bị ẩn" và khung lý do kèm liên kết khắc phục ở chi tiết tin;
  dashboard báo số tin đang bị ẩn; admin lọc được tin bị ẩn.
- Nhập tin hàng loạt và `seed_demo_jobs` chỉ đăng dưới NTD đã xác thực, còn DPA.
  Ngày 15/11 đã bổ sung bằng chứng demo (hoàn tất đăng ký, SĐT, giấy tờ, DPA,
  duyệt xác thực) cho 9 NTD demo trên DB dev để 100/100 tin công khai và nhận
  hồ sơ; sao lưu trước khi sửa: `backups/pre-demo-employer-approval-20261115.dump`.

</details>

<details><summary>Ghi chú GĐ6</summary>

- Tắt đồng ý `RECRUITER_VISIBILITY` ở cả hai đường ghi (API
  `recruiter-visibility` và form nhu cầu công việc) đều đặt
  `recruiter_searchable=False` cho mọi CV của ứng viên
  (`withdraw_cvs_from_recruiter_search` trong `apps/cvs/services`).
- Gỡ khối "Đang bật/tắt tìm việc" ở sidebar tài khoản: công tắc chỉ là state cục
  bộ và hứa hồ sơ "hiển thị nổi bật" trong tìm kiếm của NTD. Câu chữ ở sidebar,
  hộp đồng ý và banner "Bật tìm việc cho CV" nói rõ tính năng tìm ứng viên sắp
  ra mắt.
- Khi làm tìm ứng viên trong hạng mục AI: chỉ trả CV có `recruiter_searchable`
  và hồ sơ còn đồng ý; giữ cam kết trong hộp đồng ý là ẩn họ tên, ảnh và thông
  tin liên hệ cho tới khi ứng viên đồng ý kết nối.

</details>

## Đối sánh ngữ nghĩa CV–JD chạy local (2026-11-15)

AI lõi của đồ án cho phía ứng viên: bấm "Xem độ phù hợp" trên một tin để nhận
điểm tổng, điểm theo tiêu chí, kỹ năng khớp/thiếu và gợi ý cải thiện CV. Mô hình
`intfloat/multilingual-e5-base` chạy và fine-tune trên máy local, không gọi API
ngoài. Lộ trình 8 tuần (16/11/2026 → 10/01/2027), mỗi giai đoạn một PR.

Kế hoạch bản 2 (18/11) viết lại theo dữ liệu đã có: tập vàng chấm trên CV
tổng hợp (không có CV thật), thêm tiêu chí Ngoại ngữ vào công thức `hybrid-v1`,
chọn thư viện đọc PDF để sửa lỗi tách dấu, ghép cặp tập vàng ở tuần 2 để người
chấm bắt đầu sớm hơn một tuần.
Bổ sung cùng ngày theo yêu cầu: nâng mục tiêu dữ liệu huấn luyện lên
8.000–12.000 bộ ba (sinh thêm 700–850 CV qua cổng chất lượng, thêm biến thể văn
bản đọc từ PDF), và thêm bộ quy tắc chống bịa dữ liệu, chấm điểm trung thực: mọi
kỹ năng khớp và yêu cầu đạt phải có câu trích nguyên văn từ CV, thiếu dữ liệu thì
loại tiêu chí khỏi điểm, kết quả tất định, có golden test và test nhiễu.

Bản demo (kế hoạch bản 2, đã xong):

| Tuần | Hạng mục | Trạng thái |
| --- | --- | --- |
| 1 | Nền tảng: pgvector, schema `apps/matching`, môi trường `ml/`; 100 JD thật, 100 CV tổng hợp, 51 PDF, rubric | ✅ Gộp vào `dev` (#207, #230) |
| 2 | Trích xuất và chuẩn hóa CV/JD, chọn thư viện PDF, baseline TF-IDF/BM25, ghép cặp tập vàng và phiếu chấm | ✅ Gộp vào `dev` (#231) |
| 3 | Encoder, chấm điểm 6 tiêu chí, giải thích, API, task, `ml-worker`; gán nhãn tập vàng | ✅ Gộp vào `dev` (#232); tập vàng 150 nhãn do Claude gán, người kiểm tra sơ bộ 5 cặp |
| 4 | Giao diện "Xem độ phù hợp", bản demo tối thiểu (M1) | ✅ Gộp vào `dev` (#233) |

Kế hoạch bản 3 (duyệt 19/11, thay các tuần 5–8 của bản 2). Phạm vi mở rộng: mô
hình hai tầng (bi-encoder fine-tune `e5-base-ft-v1` + cross-encoder `req-ce-v1`
phán từng yêu cầu của tin), công thức `hybrid-v2`, trích xuất `extract-v3`, "Việc
làm gợi ý" theo ngữ nghĩa, và nhà tuyển dụng xếp hạng hồ sơ ứng tuyển. Mỗi giai
đoạn một PR.

| GĐ | Hạng mục | Trạng thái |
| --- | --- | --- |
| 1 | Đo lường: lệnh `matching_evaluate` (chấm bằng đúng mã sản phẩm), `ml/scripts/evaluate.py`, bảng số trên validation; mở rộng tập vàng lên 30 tin; tải mô hình và dữ liệu công khai | ✅ Đã gộp `dev` (PR #274) |
| 2 | `extract-v3`: PDF hai cột, chức danh CV tải lên, sửa các luật nhận ngày/bằng cấp/kỹ năng, schema `profile_json` | ✅ Đã gộp `dev` (PR #279) |
| 3 | Dữ liệu huấn luyện, cổng chất lượng, fine-tune bi-encoder và cross-encoder, ablation | 🟨 Đang chạy trên nhánh `feat/ai-training`: sinh dữ liệu (qua đêm), rồi huấn luyện |
| 4 | Việc làm gợi ý theo ngữ nghĩa (pgvector), nhu cầu đã khai lái thứ hạng | ✅ Đã gộp `dev` (PR #279) |
| 5 | `hybrid-v2`, cross-encoder vào `ml-worker`, `result_json` bản 2 (M2) | ⬜ |
| 6 | Nhà tuyển dụng xếp hạng hồ sơ ứng tuyển | ⬜ |
| 7 | Chạy tập test một lần, hiệu năng, nghiệm thu TC-01…30, kappa 30 cặp (M3) | ⬜ |
| 8 | Báo cáo, slide, diễn tập demo | ⬜ |

<details><summary>Ghi chú GĐ 1 (bản 3)</summary>

- Ngày 19/11 DB dev được dựng lại từ baseline migration (đại tu backend GĐ6), nên
  100 tin thật, 100 CV tổng hợp và danh mục kỹ năng mở rộng không còn. Ngày 20/11
  nhập lại từ `ml/data` bằng đúng các script cũ (sao lưu trước:
  `ai_career_coach-before-ai-reimport-20261120-131531.dump`): 100 tin, 100 CV, 15
  bản PDF tải lên, 341 kỹ năng; mã tin mới ở `ml/data/jd/jd_import_map.json`.
- Để nhập lại được: lệnh `apply_skill_merge` (app `skills`) áp bảng gộp kỹ năng
  `ml/labeling/skill_merge.json`, trước đây áp tay một lần; `import_jd.py` tự gọi
  lệnh này khi ghi thật, và tự chia lại tin của công ty demo không còn trong hệ
  thống; lệnh nhập tin khớp tỉnh/thành bất kể tiền tố "Tỉnh"/"Thành phố".
- `matching_evaluate` (chạy trong `ml-worker`) chấm danh sách cặp CV–tin bằng đúng
  bước trích xuất, mã hóa và `score_match` của sản phẩm, không ghi DB, tắt tiêu chí
  địa điểm; nhận `--model-path` để thử mô hình khác và `--rule-baseline` để lấy
  điểm của bộ gợi ý theo luật. `ml/scripts/evaluate.py` tính Spearman, NDCG@5,
  khoảng tin cậy bootstrap theo tin, số tin hơn BM25, kappa của mức hiển thị.
- Tập vàng mở rộng lên 30 tin / 300 cặp (validation 10 tin, test 20 tin): thêm
  JD-05, 07, 08, 10, 16, 18, 27, 30, 39, 40, 56, 62, 69, 71, 73, ghép cặp bằng
  `build_gold_pairs.py --extend`. Mỗi cặp mới do hai lượt Claude độc lập gán theo
  rubric: trùng 142/150, lệch không quá một mức 150/150, kappa bậc hai 0,979; 8 cặp
  lệch được phân xử, các tình huống mới thành quy tắc E1–E5 trong
  `ml/labeling/rubric.md` (`ml/reports/gold_batch2_agreement.md`). Nhãn đợt 2: 0: 48,
  1: 67, 2: 19, 3: 4, 4: 12. Đây vẫn là nhãn do mô hình ngôn ngữ gán; kiểm chứng
  của người (30 cặp chấm mù) chưa làm.
- Bảng số trên validation, 100 cặp / 10 tin (`ml/reports/eval_validation.md`):

  | Phương án | Spearman | NDCG@5 |
  | --- | ---: | ---: |
  | TF-IDF | 0,278 | 0,640 |
  | BM25 | 0,216 | 0,679 |
  | Luật `profile-rule-v2` | 0,628 | 0,874 |
  | Bi-encoder `e5-small` gốc, cosine toàn văn | 0,457 | 0,702 |
  | Bi-encoder `paraphrase-multilingual-MiniLM-L12-v2` gốc, cosine toàn văn | 0,530 | 0,663 |
  | Bi-encoder `e5-base-zs-v1`, cosine toàn văn | 0,550 | 0,758 |
  | `hybrid-v1` | 0,610 | 0,817 |

  Xếp ngẫu nhiên cho NDCG@5 = 0,445. `hybrid-v1`: kappa mức hiển thị 0,525; 33 cặp
  khác ngành có trung vị 28 điểm, cao nhất 58, 5 cặp từ 50 điểm trở lên. Khoảng tin
  cậy của `hybrid-v1`: Spearman 0,42 đến 0,78, NDCG@5 0,65 đến 0,93.
- Điều rút ra: bộ gợi ý theo luật ngang hoặc nhỉnh hơn `hybrid-v1` (khoảng tin cậy
  chồng nhau, chưa kết luận được bên nào hơn). Với các CV này, điểm của luật chỉ
  gồm số kỹ năng trùng theo danh mục (6 điểm mỗi kỹ năng), chức danh CV xuất hiện
  trong tiêu đề tin (24 điểm) và đủ số năm (6 điểm), nên cặp khác ngành gần như 0
  điểm. `hybrid-v1` cũng có tiêu chí kỹ năng, nhưng cộng thêm học vấn, cấp bậc,
  ngoại ngữ, là những điểm được cho bất kể CV có đúng nghề hay không, nên cặp khác
  ngành vẫn lên tới 58 điểm. Đây là bằng chứng cho "trần theo mức liên quan" của
  `hybrid-v2` (GĐ 5). Mọi phương án ngữ nghĩa đều hơn rõ TF-IDF và BM25.
- Hai tin có trường nhập tay lệch với nội dung (JD-69: kinh nghiệm và học vấn;
  JD-62: vị trí chuyên môn), ghi trong rubric, chờ sửa trong `jd_input.xlsx`.
- Đã tải bằng `ml/scripts/fetch_public.py` (nguồn và mã commit ở
  `ml/data/public/SOURCES.md`): VietJobs (48.092 tin, kèm `LICENSE` MIT của kho
  GitHub), resume-job-description-fit, mô hình gốc của cross-encoder
  (`cross-encoder/mmarco-mMiniLMv2-L12-H384-v1`) và hai bi-encoder so sánh.
- Dời sang GĐ 5: cho `calibrate.py` đọc kết quả của `matching_evaluate` thay vì tự
  chép lại luật, làm cùng lúc với lần hiệu chuẩn lại.
- Bỏ ngưỡng "P@3 ≥ 0,70" của bản 2: tập test cũ chỉ có 13 cặp nhãn ≥ 3 nên trần
  lý thuyết là 0,43.

</details>
<details><summary>Ghi chú GĐ 2 (bản 3)</summary>

- Đọc PDF theo vị trí chữ (`apps/cvs/services/pdf_layout.py`): `pypdfium2` trả chữ
  theo thứ tự vẽ trong tệp, nên mẫu CV hai cột để mọi tiêu đề mục sau nội dung của
  chúng. Module dựng lại thứ tự đọc từ tọa độ từng ký tự: gom ký tự thành đoạn, tìm
  khe dọc giữa hai cột, dòng chạy ngang qua khe chia trang thành dải, cột hẹp chỉ
  gồm ngày được ghép vào dòng cùng hàng; xử lý chữ ghép ("ffi") và dấu gạch nối
  cuối dòng. Dùng cho cả bước nhận dạng CV khi tải lên.
- Luật ngày tháng (`facts.py`): dấu nối viết liền (`04/2023-12/2024`), dấu `>>`,
  khoảng in thành hai dòng, "tháng 9 năm 2021", "T9/2021"; khoảng chỉ ghi năm tính
  từ giữa năm này tới giữa năm kia (ít nhất 6 tháng); hai năm đứng cạnh nhau không
  có dấu nối không phải một khoảng.
- Từ khóa bằng cấp, nơi học, ngoại ngữ so theo ranh giới từ ("Scrum Master",
  "samba", "HSKS" không còn bị nhận nhầm); nhận "ĐH".
- CV tải lên có `title` (trước đây rỗng nên phép so chức danh với tin bị bỏ): mẩu
  ngắn có từ chỉ nghề ở đầu trang, rồi chức danh lặp lại ở các việc, rồi chức danh
  của việc gần nhất; không chắc thì để rỗng. Cấp bậc lấy theo việc gần nhất, không
  theo chức danh cao nhất từng giữ.
- Tên kỹ năng có dấu `/` ("CI/CD") không bị tách; dòng liệt kê kỹ năng trong tin
  ("ReactJS, TypeScript, Redux") không bị coi là tiêu đề con; nhận tiếng Việt bằng
  chữ cái riêng của tiếng Việt, ngưỡng 5%.
- Danh mục kỹ năng: công cụ cụ thể không còn là alias của khái niệm chung
  (PyTorch/TensorFlow ≠ Deep Learning, Jenkins/GitHub Actions ≠ CI/CD, Pytest/Jest ≠
  Unit Testing, Express.js ≠ Node.js) ở `seed_skills` và khóa `split` của
  `skill_merge.json`; nhóm "Tên vị trí" (Fullstack, Kế toán, Kế toán tổng hợp, IT
  Support, Tuyển dụng) không được đếm như nhóm "Phẩm chất cá nhân"; lệnh nhập tin có
  `--refresh-skills` để đồng bộ lại kỹ năng của tin đã nhập (2 tin đổi: JD-25, JD-27).
- Chuẩn đầu vào: `services/extraction/profile.schema.json` mô tả `profile_json` của CV
  và tin; test kiểm hồ sơ CV builder, CV tải lên, tin; cả 246 hồ sơ thật trong DB
  dev đều hợp lệ. `EXTRACTOR_VERSION = 'extract-v3'`, đã chạy `matching_backfill`.
- Đo lại (`ml/reports/extraction_check.md`). Bộ kiểm tra được sửa để so công bằng:
  bậc học của PDF so với chữ in ở tên bằng (`ml/labeling/education_key.json`, vì
  trường `degree_level` của CV tổng hợp lệch tên bằng ở 53/100 CV); kỹ năng, ngoại
  ngữ, số tháng chỉ tính mục thật sự in trong tệp (mẫu TopCV bỏ 41 kỹ năng).

  | Nguồn | Kỹ năng | Kinh nghiệm ±3 tháng | Học vấn | Ngoại ngữ | Chức danh |
  | --- | ---: | ---: | ---: | ---: | ---: |
  | CV builder (100) | 100% | 100% | 100% | 100% | 100/100 |
  | PDF hệ thống (15) | 96,2% | 93% | 100% | 100% | 15/15 |
  | PDF TopCV (36) | 98,9% | 100% | 97% | 94% | 29/36 (34 có chức danh) |

  Bản `extract-v2` đo bằng bộ kiểm tra cũ cho PDF TopCV 78,7% / 72% / 36% (kỹ năng /
  kinh nghiệm / học vấn) và không có chức danh. Hai con số kỹ năng và học vấn thấp
  chủ yếu do đáp án cũ (kỹ năng không in trong tệp, `degree_level` lệch tên bằng);
  phần cải thiện thật của bộ trích xuất nằm ở số tháng kinh nghiệm và chức danh.
- Validation gần như không đổi (CV ở đây tạo trên hệ thống): `hybrid-v1` Spearman
  0,603, NDCG@5 0,815, kappa mức hiển thị 0,511.
- Phát hiện cho GĐ 5: khớp kỹ năng ngữ nghĩa của `hybrid-v1` (ngưỡng cosine 0,846
  trên mô hình gốc) cho dương tính giả. Tin kế toán JD-60 với CV phân tích dữ liệu
  CV-004 (nhãn 0) được 65 điểm vì "Phần mềm kế toán" bị coi là khớp với câu "Sử dụng
  công cụ như Python, R để phân tích…" (cosine 0,848), tương tự cho "Phân tích tài
  chính" và "Báo cáo tài chính". Bỏ "Kế toán tổng hợp" khỏi kỹ năng được đếm làm cặp
  này tăng từ 58 lên 65. Cần cross-encoder hoặc bỏ khớp ngữ nghĩa cho kỹ năng.
- Còn sót: PDF hệ thống CV-045 (không có mục kinh nghiệm, bố cục bị coi là đảo nên
  số tháng để trống thay vì 0), vài kỹ năng viết khác danh mục, 2 PDF TopCV không
  nhận được chức danh.

</details>
<details><summary>Ghi chú GĐ 3 (bản 3)</summary>

- Kho CV huấn luyện: `generate_cvs.py --train` sinh 560 CV (8 CV cho mỗi tin trong 70
  tin ngoài tập vàng: 4 khớp mạnh, 2 khớp một phần, 2 vị trí gần; khoảng 30% tiếng
  Anh) vào `ml/data/cv/train/`. Tin vàng không bao giờ làm tin neo. Mô hình phải ghi
  tên bằng đúng bậc học script chọn (đợt sinh đầu không ràng buộc nên 53/100 CV lệch).
  `enrich_cvs.py --train` thêm mục ngoại ngữ.
- `quality_gate.py`: loại CV có chữ ngoài hệ Latin, ô ngắn bị viết thành đoạn, tên
  bằng lệch bậc học, ngày tháng lệch số tháng, phần chữ thiếu quá nửa kỹ năng, CV "vị
  trí gần" chứa quá nửa kỹ năng của tin neo, CV gần trùng; kèm 40 CV ngẫu nhiên ở
  `ml/labeling/train_cv_review.md` để người làm đồ án đọc kiểm.
- `build_train_pairs.py`: bộ ba (tin, dương, âm) từ CV huấn luyện (mọi cặp CV khớp
  mạnh với CV yếu hơn của cùng tin, cặp chức danh), cùng vị trí chuyên môn, VietJobs
  (1.500) và resume–JD fit (1.000). Văn bản đi qua đúng hàm dựng chunk của backend
  (`matching_export_dataset texts`, `job_text_chunks`). Chống rò rỉ: 30 tin vàng và 100
  CV của tập vàng không dùng; tin VietJobs giống một tin vàng bị loại (125 tin ở lần
  chạy thử). 7 tin neo giữ riêng làm dev để chọn checkpoint.
- `build_requirement_pairs.py`: 836 câu yêu cầu loại `skill` (luật
  `facts.requirement_kind`: bậc học, số năm, ngoại ngữ, phẩm chất có tiêu chí riêng
  hoặc không đo được). Mô hình local viết câu CV đáp ứng (hai ngôn ngữ) và câu "liên
  quan, chưa đủ"; câu "chưa đủ" không được có từ phủ định hay mở đầu bằng "Hỗ trợ",
  vì đó là văn phong của máy sinh. Chống học văn phong: ghép chéo (câu đáp ứng của yêu
  cầu này là âm của yêu cầu khác), âm từ CV thật khác nghề, kiểm tra "chỉ nhìn câu CV".
- `train.py` (bi-encoder, `CachedMultipleNegativesRankingLoss` hai chiều,
  `NO_DUPLICATES`, chọn checkpoint theo NDCG@10 của dev) và `train_reranker.py`
  (cross-encoder `mmarco-mMiniLMv2-L12`, `BinaryCrossEntropyLoss`, Sigmoid) đã chạy thử
  trên MPS. `run_training.sh` nối các bước theo thứ tự bộ nhớ.
- Câu yêu cầu của tin ghi số đo cơ thể ("nữ cao từ 158cm") nay cũng bị loại khỏi đối sánh.
- Chưa làm: biến thể văn bản đọc từ PDF cho dữ liệu huấn luyện (K6).

</details>
<details><summary>Ghi chú GĐ 4 (bản 3)</summary>

- Trang "Việc làm phù hợp" làm lại theo mẫu (thẻ tin có "Vì sao phù hợp?", "Ứng tuyển", ẩn,
  lưu). Bật/tắt gợi ý đều qua popup xác nhận. Tắt gợi ý bằng AI vẫn có danh sách không đọc
  CV (theo nhu cầu đã khai, hoặc `latest-v1` tin mới nhất), kèm khung mời bật lại; khối gợi ý
  trang chủ ẩn khi tắt.

- Thanh bên tài khoản ứng viên có công tắc "Gợi ý việc làm" (đồng ý `AI_RECOMMENDATION`,
  endpoint riêng `/api/candidate/ai-recommendation/`, không cần khai nhu cầu) và chú thích
  "?" trỏ tới chính sách dữ liệu AI qua cài đặt `ai_data_policy_url`. Trước đây chỉ có nút
  dẫn sang trang cài đặt, và đồng ý chỉ lưu được qua form nhu cầu (ghi đè toàn bộ).

- Trang "Việc làm phù hợp" và trang lưu CV xếp tin theo chiến lược `semantic-v1`
  (`apps/matching/selectors/recommendations.py`): tìm tin gần vector toàn văn của CV mặc định
  nhất bằng pgvector (tìm chính xác), xếp lại 100 tin gần nhất theo mức liên quan (toàn văn,
  chức danh) và tỷ lệ kỹ năng trùng, bỏ tin dưới 30 điểm. Không cần khai nguyện vọng trước:
  có CV đã lưu là đủ.
- Nhu cầu đã khai lái thứ hạng (`apps/jobs/selectors/recommendation_intent.py`): tin đúng vị
  trí mong muốn luôn được xét, +0,40 và không bị ngưỡng cắt (người đổi nghề); tỉnh +0,05,
  lương +0,03, kinh nghiệm vừa +0,03, mỗi điểm cộng kèm lý do. Mức +0,40 chọn bằng mô phỏng
  đổi nghề trên 100 CV: 34% tin nghề mới trong top 10 (trần 36%), vẫn giữ 23% tin nghề cũ;
  khai đúng nghề cũ thì NDCG@10 cùng vị trí 0,832 → 0,998. Giao diện bỏ lời "dựa trên mong
  muốn", trang chủ hiện gợi ý cả khi chưa khai nhu cầu; API thêm `cv_recommendations_enabled`.
- PR #275 và #278 được gộp vào nhánh trung gian (không vào `dev`); hai commit GĐ 2 và GĐ 4
  được đưa lại vào `dev` cùng phần nhu cầu trên nhánh `feat/ai-recs-preferences`.
- Rơi về luật cũ khi cờ `ai_job_recommendation_semantic_enabled` tắt, ứng viên chưa đồng ý
  nhận gợi ý AI, CV chưa có vector, hoặc không tin nào đủ gần. Email gợi ý và tin chèn trong
  danh sách việc làm vẫn theo luật.
- Kết quả chỉ mang lý do bằng lời; trang lưu CV bỏ các thẻ "+điểm" của luật cũ, hiện lý do.
- `MatchDocument.is_current` (migration `matching.0002`): bản mới nhất của mỗi nguồn với cùng
  phiên bản, để tìm kiếm không ra tin trùng hay nội dung lỗi thời. Hằng số phiên bản và mốc
  hiệu chuẩn chuyển sang `apps/matching/domain/` vì selectors không được import services.
- Ngưỡng 30 điểm đo trên 100 CV tổng hợp: ở 35 điểm khoảng 10% tin neo của CV khớp mạnh bị
  cắt và 5% CV không còn gợi ý nào.
- Đo trên nhãn yếu (`ml/scripts/evaluate_recommendations.py`): `semantic-v1` ngang luật cũ ở
  việc đưa tin gốc của CV lên đầu (MRR 0,780 so với 0,795), hơn ở gợi ý tin cùng vị trí
  (NDCG@10 0,830 so với 0,726; BM25 0,538).
- Kiểm thử TC-18…22 (`apps/matching/tests/test_recommendations.py`), số truy vấn không tăng
  theo số tin; sơ đồ tuần tự và hoạt động "37_goi_y_ngu_nghia" đã cập nhật theo mã.
- Thực nghiệm HNSW (chỉ mục xấp xỉ trên 48 nghìn tin VietJobs) chưa làm; với vài nghìn tin,
  tìm chính xác vẫn đủ nhanh.

</details>

<details><summary>Ghi chú tuần 1</summary>

- Image DB là `pgvector/pgvector:pg16-trixie`, không phải tag `pg16`: volume
  `pgdata` tạo trên Debian trixie (glibc 2.41), còn `pg16` là bookworm (glibc
  2.36) nên sẽ lệch phiên bản collation. Bản sao lưu trước khi đổi:
  `backups/pre-pgvector-20261115.dump`.
- Ngày 15/11 đã xóa toàn bộ 53 tin mẫu cùng hồ sơ ứng tuyển thử trong DB dev
  (sao lưu `backups/pre-job-cleanup-20261115.dump`). Tin thật được điền vào
  `ml/data/jd/jd_input.xlsx` (không commit) rồi nhập bằng
  `ml/scripts/import_jd.py` (chạy thử trước, `--apply --create-skills` để ghi;
  bảng đối chiếu mã tin lưu ở `ml/data/jd/jd_import_map.json`); rubric gán nhãn bản
  nháp ở `ml/labeling/rubric.md`.
- Ngày 15/11 đã nhập 100 tin thật (90 TopCV, 10 ITviec; 78 tin tiếng Việt, 22
  tin tiếng Anh; đủ 8 nhóm ngành) vào các công ty demo. Danh mục kỹ năng tăng
  từ 42 lên 344; bảng gộp cách viết và hai nhóm "Kỹ năng mềm", "Phẩm chất cá
  nhân" ở `ml/labeling/skill_merge.json`. Sao lưu trước khi nhập:
  `backups/pre-jd-import-20261115.dump`.
- Ngày 18/11: chưa xin được CV thật nên dùng CV tổng hợp sinh bằng
  `qwen2.5:7b` chạy local qua Ollama (`ml/scripts/generate_cvs.py`), từ chính
  100 JD đã nhập. Script quyết định vị trí, số tháng kinh nghiệm, bậc học, kỹ
  năng có mặt và mức khớp dự kiến (`strong`/`partial`/`adjacent`, ghi trong
  `ml/data/cv/synthetic/manifest.json`, dùng làm nhãn yếu, không thay điểm
  người chấm); mô hình chỉ viết phần chữ. Mỗi CV vào hệ thống dưới một tài
  khoản ứng viên thử riêng `cv-xxx@synthetic.procv.test` qua lệnh
  `import_cv_documents` (`ml/scripts/import_cvs.py`). Tập vàng vẫn nên có 10–15
  CV thật; nếu không có, báo cáo ghi rõ là giới hạn.
- Kết quả 18/11: 100 CV tổng hợp đã nằm trong hệ thống (68 tiếng Việt, 32 tiếng
  Anh; 40 khớp mạnh, 40 khớp một phần, 20 vị trí gần; 62 CV cho 8 nhóm vị trí
  của tập vàng, 38 CV rải các vị trí khác). Mỗi CV có đủ mục kinh nghiệm, học
  vấn, kỹ năng, dự án, ngoại ngữ (88 CV) và các mục phụ; 508 kỹ năng khớp danh
  mục. Một CV bị mô hình viết lẫn tiếng Trung đã được sinh lại; script giờ tự
  sinh lại khi gặp chữ Trung/Nhật/Hàn. Sao lưu trước khi nhập:
  `backups/pre-synthetic-cvs-20261118.dump`.
- 15 CV (trải đều 8 nhóm vị trí, 8 tiếng Việt và 7 tiếng Anh) có thêm bản PDF
  tải lên: xuất PDF từ CV builder (in kèm email thử của tài khoản, vì CV tải lên
  bắt buộc có email hoặc số điện thoại) rồi tải lên lại cho cùng tài khoản, bằng
  `ml/scripts/import_cvs.py --pdf-twins --apply` (lệnh `create_pdf_twins`). Bản
  PDF lưu ở `ml/data/cv/pdf/system/`. Phát hiện cho tuần 2: `pypdf` tách rời chữ có
  dấu tiếng Việt khi đọc PDF ("Ứ ng viên", "NGH Ề NGHI Ệ P"), khoảng 300–440 chỗ
  mỗi CV tiếng Việt, gần như không có ở CV tiếng Anh; bước trích xuất CV tải lên
  phải xử lý (đổi thư viện đọc PDF hoặc ghép lại ký tự).
- Ngày 18/11: 36 PDF bố cục đa dạng xuất từ TopCV (tài khoản Pro, 36 mẫu khác
  nhau, 1–3 trang, một và hai cột, 26 tiếng Việt và 10 tiếng Anh) ở
  `ml/data/cv/pdf/topcv/`. Nội dung điền từ `ml/data/cv/synthetic/CV-xxx.json`
  cùng mã, nên dùng chung nhãn với bản JSON; không có ảnh và thông tin liên hệ
  thật (đã quét cả 51 PDF). Các CV tạm trên TopCV đã xóa sau khi tải. Những PDF
  này cũng bị `pypdf` tách dấu, xác nhận lỗi nằm ở thư viện đọc chứ không ở bộ
  xuất PDF của hệ thống; một số tệp TopCV có dòng trống trước `%PDF` (pypdf vẫn
  đọc được, chỉ cảnh báo).
- Ngày 18/11: sắp lại `ml/` cho giai đoạn sau. Dữ liệu chia `data/jd/` và
  `data/cv/` (`synthetic/`, `pdf/system/`, `pdf/topcv/`); mọi đường dẫn khai báo
  một chỗ ở `ml/scripts/paths.py`; cấu trúc và thứ tự chạy ở `ml/README.md`.
- `apps/matching` mới có ba bảng (`MatchDocument`, `MatchChunk`,
  `MatchAnalysis`) và test ràng buộc; chưa có service, API hay task.
- Đo trên MacBook Pro M5, 16 GB (torch 2.15.0, sentence-transformers 6.3.0):
  mã hóa 371 câu ngắn/giây trên MPS; fine-tune 5,6 giây/bước ở batch 32, ước
  45–90 phút cho 5.000 bộ ba × 3 epoch.
- Fine-tune trên MPS với cấu hình mặc định báo lỗi dropout của
  `scaled_dot_product_attention`; phải nạp mô hình với
  `attention_probs_dropout_prob=0.0` (đã đặt sẵn trong `ml/scripts/smoke_mps.py`).
- Không giới hạn thì vùng nhớ MPS lên khoảng 9,7 GB và swap tăng khoảng 6 GB.
  Đặt `PYTORCH_MPS_HIGH_WATERMARK_RATIO=0.6` giữ ở khoảng 7,4 GB, chậm hơn
  khoảng 9% (6,1 giây/bước).

</details>

<details><summary>Ghi chú tuần 2</summary>

- Thư viện đọc PDF: `pypdfium2` (pypdf chỉ còn kiểm tra mật khẩu, số trang). Đo
  trên 51 PDF: pypdf tách rời 9,07% số từ ở CV tiếng Việt (tối đa 30%),
  pypdfium2 tách 0%; NFC không sửa được lỗi của pypdf
  (`ml/reports/extract_check.md`).
- `apps/matching/services/extraction/` gồm `text`, `facts`, `profile`,
  `cv_builder`, `cv_upload`, `job`; nhận diện kỹ năng ở `services/skills.py`.
  Phiên bản trích xuất `extract-v1`.
- Đối chiếu với nhãn (`ml/reports/extraction_check.md`):

  | Nguồn | Recall kỹ năng | Kinh nghiệm ±3 tháng | Học vấn | Ngôn ngữ | Bằng chứng ngoài CV |
  | --- | ---: | ---: | ---: | ---: | ---: |
  | CV builder (100) | 100% | 100% | 100% | 100% | 0 |
  | PDF hệ thống (15) | 95,6% | 93% | 60% | 100% | 0 |
  | PDF TopCV (36) | 78,7% | 72% | 36% | 75% | 0 |

  Học vấn của PDF thấp chủ yếu do CV tổng hợp tự mâu thuẫn: chữ ghi "Bachelor
  of Science" nhưng trường `degree_level` là `college` (6/6 ca lệch ở PDF hệ
  thống). Bộ trích xuất đọc theo chữ trên CV; cổng chất lượng ở tuần 5 thêm kiểm
  tra bằng cấp khớp `degree_level`. PDF TopCV hai cột bị đảo thứ tự đọc; những
  ca đó có `experience.basis = whole_text` để bước chấm hạ độ tin cậy, và hệ
  thống không bao giờ kết luận "0 tháng" khi bố cục không gọn.
- 100 tin: trích xuất được cả 100, ngôn ngữ nhận diện khớp ngôn ngữ ghi lúc nhập
  ở cả 100; trung bình 6,03 kỹ năng được đếm và 18,7 chunk mỗi tin; 39 kỹ năng
  nhóm "Phẩm chất cá nhân" bị loại khỏi điểm. Câu yêu cầu về giới tính, tuổi
  không thành chunk.
- Kiểm tay 20 tin và 20 CV (10 CV builder, 10 PDF): sửa thêm chức danh "Thư ký
  Tổng Giám đốc" bị nhận là Giám đốc, mức ngoại ngữ "Giao tiếp" bị nhận là kỹ
  năng, tiêu đề con trong mục yêu cầu bị coi là yêu cầu.
- Tập vàng: 150 cặp (15 JD × 10 CV, 75 CV khác nhau; 60 cặp từ top-4 BM25, 60
  từ top-4 e5 zero-shot, 30 ngẫu nhiên; 38/60 CV top BM25 cũng nằm trong top e5).
  Validation: JD-02, 35, 60, 66, 75; còn lại là test. Phiếu chấm
  `ml/labeling/gold_pairs.xlsx` (tab Chấm, kèm nội dung JD và CV), nguồn ghép cặp
  ở `ml/data/labels/gold_pool.json`, không xem khi chấm.
- Baseline trên nhãn yếu (chỉ kiểm tra hợp lý, 11 JD có ≥ 2 CV neo): TF-IDF
  NDCG@5 0,535, BM25 0,531 (`ml/reports/baseline_weak_labels.md`).
- Nợ còn lại: danh mục kỹ năng gộp quá rộng ở vài chỗ ("PyTorch" là alias của
  "Deep Learning"); một số "kỹ năng" là tên vị trí (Fullstack, Telesales, Kế toán).

</details>

<details><summary>Ghi chú tuần 3</summary>

- Luồng: `encoder` → `documents` → `scoring/` (công thức `hybrid-v1`) →
  `explain` → `analyses`; API `/api/candidate/matching/analyses/`, task ở queue
  `ai-matching` do service `ml-worker` chạy (Dockerfile target `ml`, torch CPU;
  image web không có torch). Mô hình zero-shot lưu ở
  `ml/models/multilingual-e5-base/zs-v1` bằng `ml/scripts/export_model.py`.
- Phát hiện khi hiệu chuẩn (`ml/reports/calibration_e5-base-zs-v1.md`, nhãn
  yếu, 40 cặp khớp mạnh / 300 cặp khác ngành): MaxSim từng câu yêu cầu gần như
  không phân biệt được (AUC 0,588), cosine toàn văn 0,899, cosine chức danh
  0,935. Vì vậy mức liên quan R trong tiêu chí kinh nghiệm dùng toàn văn +
  chức danh; MaxSim chỉ để chỉ câu bằng chứng của từng yêu cầu. Điểm số năm
  được nhân R/100 (năm làm việc khác nghề không được tính), và tin có kỹ năng
  mà CV không thể hiện là 0 điểm chứ không bị loại khỏi điểm. Cả hai sửa sau
  khi test golden cho CV kế toán 64 điểm với tin Frontend.
- Tiêu đề tin chỉ giữ phần tên vị trí khi so ("Kế Toán Quản Trị - Tuyển Nữ (Thu
  Nhập 15-20 Triệu)…" → "Kế Toán Quản Trị"), nên không so theo giới tính, lương.
- Chạy thật (e5-base, CPU trong container): khớp mạnh 85–89, khớp một phần
  57–63, vị trí gần 56, khác ngành 23–29 điểm. 50 lượt liên tiếp không lỗi;
  đã có vector: p50 23 ms, p95 25 ms; CV vừa sửa 0,46–0,66 s; RAM ml-worker
  1,67 GB; backfill 101 tin + 126 CV mất khoảng 2 phút.
- TC-14: dừng ml-worker, gửi yêu cầu, bật lại → hoàn tất sau 7 giây. Lỗi ngoài
  dự kiến khi chấm chuyển `failed` (`internal_error`) thay vì để vòng phục hồi
  chạy lại mãi.
- Test (HashingEncoder): từng tiêu chí, trần 64 khi thiếu ngoại ngữ bắt buộc,
  không bịa (mọi bằng chứng là câu có thật trong CV), nhiễu (đảo thứ tự và thêm
  câu thừa lệch ≤ 3 điểm), golden ba cặp, API TC-01/06–13.
- Còn để tuần 4–6: giao diện; hiệu chuẩn lại và chọn trọng số trên nhãn người
  chấm; độ tin cậy của học vấn/cấp bậc khi CV khác ngành (hai tiêu chí này vẫn
  cho 100 nếu bậc khớp, làm cặp khác ngành còn 23–29 điểm thay vì gần 0).

</details>

<details><summary>Tập vàng: cách gán nhãn (18/11)</summary>

- Người làm đồ án quyết định để Claude gán 150 nhãn theo rubric và tự mình kiểm
  chứng, thay vì tự chấm cả 150 cặp. Báo cáo ghi đúng như vậy.
- Năm người gán dùng chung một hướng dẫn, chỉ đọc nội dung tin và CV (không xem
  điểm hệ thống hay nguồn ghép cặp). Các chỗ mơ hồ (kỹ năng cốt lõi, đúng nghề mà
  ít kỹ năng, điểm trừ có xuống 0 không, ngoại ngữ thấp hơn mức yêu cầu, suy ra
  kỹ năng, cộng dồn thiếu hụt, Telesales, thẻ kỹ năng thay thế nhau) được hỏi lại
  người làm đồ án hai đợt, ghi thành quy tắc A–D trong `ml/labeling/rubric.md`,
  rồi chấm lại toàn bộ. Kết quả: 0: 38, 1: 61, 2: 29, 3: 14, 4: 8 cặp, không còn
  cặp "không chắc"; nhãn ở `ml/labeling/gold_pairs_claude.xlsx`.
- Kiểm chứng: dự kiến người làm đồ án chấm mù 30 cặp cố định (2 cặp mỗi tin,
  `ml/labeling/audit_pairs.json`) để tính kappa. Thực tế chấm được 5 cặp rồi dừng: trùng 4/5, lệch không quá 1 mức 5/5
  (`ml/reports/label_agreement.md`), chưa đủ tính kappa. Báo cáo ghi là kiểm tra
  sơ bộ và là giới hạn. Công cụ chấm trên trình duyệt đã gỡ khi dừng chấm
  (khôi phục từ lịch sử git nếu cần bổ sung).

</details>

<details><summary>Ghi chú tuần 4</summary>

- Feature `features/main/application/analyze-job-fit`: thẻ "Xem độ phù hợp" (mascot vẫy tay, viền
  chuyển màu) ở cột phải trang chi tiết tin, dưới thông tin công ty (từ 1024 px);
  dưới 1024 px thẻ nằm ngay dưới thông tin chính của tin, cạnh nút ứng tuyển; hộp thoại
  chọn CV → màn hình "AI đang phân tích CV" (tờ CV có tia quét, trạng thái lấy
  đúng `queued`/`processing` của backend) → kết quả: mascot theo mức, điểm đếm
  tăng, thước bốn mức 50/65/80, tiêu chí, kỹ năng có/thiếu kèm câu trích từ CV,
  yêu cầu đạt/chưa thấy, gợi ý, câu "không phải quyết định tuyển dụng". Mở lại
  thì hiện kết quả lần trước của tin; lỗi (CV scan, quá lượt) có câu hướng dẫn.
- Hộp thoại tải trễ, CSS riêng ngoài CSS khởi tạo (đo: JS khởi tạo 320,8/328,5
  KiB, CSS 38,0/38,5 KiB). Chuyển động tắt theo "giảm chuyển động".
- `CvChoice` chuyển xuống `entities/cv/cv`. Trang lưu CV thành công bỏ "x% phù hợp"
  của đối sánh theo luật, chỉ giữ nhãn (hết hai con số mâu thuẫn).
- Kiểm thử: 13 unit test của feature, E2E `job-fit.spec.js` (TC-01 luồng chính,
  TC-06 xem lại kết quả, TC-08 khách không mở được, TC-15 không tràn ngang ở
  desktop/tablet/mobile; mỗi màn hình đúng một thẻ hiện ra).

</details>

## Trang chi tiết tin: thẻ công ty gọn và bố cục mobile (2026-11-18)

- Thẻ công ty (cột phải desktop): logo 80px, tên công ty, "Quy mô: … nhân viên",
  "Địa điểm: …", nút viền "Xem trang công ty" mở tab mới. Bỏ ảnh bìa (đè lên
  tên), lĩnh vực, đoạn mô tả và link website — đã có ở trang công ty.
- Hero: bỏ dải gradient đầu thẻ, ô lương bỏ gradient/bóng.
- Mobile (< 768px): ẩn thanh tìm kiếm 4 hàng; hero gọn (lương cả hàng, địa điểm
  + kinh nghiệm chia đôi, ẩn lượt xem); bỏ nút ứng tuyển/lưu/so sánh trong hero
  và cuối phần chi tiết vì thanh dưới màn hình đã có; khối đánh giá thành 5 biểu
  tượng một hàng + nhãn mức đã chọn; ẩn "Danh mục nghề liên quan" (trùng tag
  Chuyên môn); "Thông tin chung" 2 cột. Trang mobile ngắn từ ~6.100 xuống
  ~4.900px. Style ở `pages/main/jobs/ui/job-detail/job-detail.css` (CSS khởi tạo
  37,9/38,5 KiB).
- Smoke `candidate.spec.js` bấm nút ứng tuyển đang hiển thị (mobile là thanh
  dưới) và đóng banner cookie sau khi reload.
- Còn mở: khối "Tìm kiếm phổ biến" ở cuối mọi trang (MainLayout) rất dài trên
  mobile; cụm nút nổi tim/Góp ý đè nội dung góc trái dưới.

## Trang danh sách việc làm trên mobile (2026-11-18)

- Lỗi: thanh tìm kiếm 4 hàng (danh mục, từ khóa, địa điểm, nút) dính đầu màn
  hình, cộng header chiếm gần nửa màn hình mobile và che kết quả khi cuộn.
- Mobile (< 768px): thanh tìm kiếm cuộn theo trang, gọn 2 hàng (từ khóa + nút
  kính lúp; danh mục | địa điểm chia đôi); dropdown gợi ý neo vào cả thanh. Tiêu
  đề xuống dòng thay vì bị cắt; hàng lối tắt, chip nhanh, "Tìm kiếm theo" cuộn
  ngang; nút "Lọc nâng cao" về cùng hàng với sắp xếp (bên phải, tránh cụm nút
  nổi). Card việc: logo 56px, lương dưới tiêu đề, ẩn dòng yêu cầu bị cắt, nút so
  sánh tròn cùng cỡ nút lưu. Drawer lọc bỏ tiêu đề lặp.
- Tablet (768–1023px): thu hẹp danh mục/địa điểm để ô từ khóa không bị bóp, ẩn
  nhãn "Sắp xếp theo:". Desktop không đổi.
- Style đặt ở `pages/main/jobs/ui/job-list.css` và `job-card.css` (tải theo
  route; CSS khởi tạo vẫn 38,0/38,5 KiB). Smoke `public.spec.js` kiểm tra thanh
  tìm kiếm không dính trên mobile, cao < 140px và không tràn ngang ở 3 viewport.
- Còn mở: `tests/e2e/jobs.spec.js` (ngoài smoke) đang lỗi sẵn, kể cả test trang
  chủ; ít nhất test bộ lọc tìm nút "Từ xa" đã bỏ khỏi sidebar.

## CV tải lên: tệp gốc, tiêu chuẩn upload, giới hạn CV, NTD tìm kiếm (2026-11-15)

- Lỗi tìm thấy: `backend/.env` bật `*_UPLOAD_SESSION_REQUIRED=True` khi quarantine
  tắt nên mọi upload bị 409; local đã đưa về `False` (bật lại phải kèm
  `UPLOAD_QUARANTINE_ENABLED=True` + ClamAV). CV tải lên hiện trống vì mọi màn
  hình dựng từ `content_json` rỗng.
- Xem tệp gốc: `GET /api/candidate/cvs/<id>/source/` (chủ CV) và
  `GET /api/public/cvs/shares/<token>/source/` (link chia sẻ, không ghi thêm lượt
  truy cập); DOCX đổi sang PDF bằng LibreOffice. Hàm đổi chuyển từ `employers`
  sang `common/files/office_preview.py`. Trang xem và link chia sẻ của CV tải lên hiện
  tệp gốc (ẩn thanh công cụ PDF); thẻ CV tải lên là biểu tượng thư mục, không
  có nút sửa.
- Tiêu chuẩn upload + nhận dạng CV (`apps/cvs/services/cv_document.py`, dùng
  chung cho upload trực tiếp, phiên upload và job import AI): PDF/DOCX đúng chữ
  ký, ≤ 5 MB, ≤ 20 trang, PDF có lớp chữ và không mật khẩu; phải có email/số
  điện thoại và ≥ 2 nhóm mục CV, trong đó có kinh nghiệm/học vấn/kỹ năng. Từ khóa
  chỉ tính ở dòng ngắn dạng tiêu đề (≤ 40 ký tự, hoặc phần trước dấu ":") để báo
  cáo/thư nhắc "kinh nghiệm" trong câu không lọt; so khớp bỏ dấu, bỏ khoảng trắng
  vì PDF hay tách chữ; văn bản > 30.000 ký tự bị loại. Lỗi trả `CV_REJECTED` kèm
  `reason`.
- Giới hạn số CV theo site setting `candidate_max_cvs` (mặc định 6, tính cả CV
  lưu trữ) áp ở mọi đường tạo CV; lỗi `CV_LIMIT_REACHED` "Hiện tại tài khoản của
  bạn chỉ hỗ trợ tạo 6 CV!".
- Cho NTD tìm kiếm theo từng CV: cột `UserCv.recruiter_searchable` (migration
  `cvs.0017`), chỉ bật được khi hồ sơ đã đồng ý `RECRUITER_VISIBILITY`. Công tắc
  trên mọi thẻ CV, popup "Quản lý danh sách" (bật/tắt nhiều CV + đồng ý một lần)
  và khối "Bật tìm việc cho CV" đầu trang CV của tôi; sidebar đếm số CV đang bật.
  Chưa có màn hình NTD tìm ứng viên đọc cờ này (thuộc hạng mục đối sánh CV–JD);
  tắt đồng ý thì mọi CV về `recruiter_searchable=False` (GĐ6 đợt thống nhất luồng).
- Trang xem CV `/cvs/<id>/view` và `/cv/share/<token>`: layout riêng không header
  site, thanh mảnh với Tải CV PDF / Sửa CV / Copy CV (nhân bản); bỏ khối chọn
  phiên bản + xuất PDF (`CvPdfExportControl` đã xóa).
- Editor CV bỏ tự động lưu: chỉ lưu khi bấm Lưu CV (hoặc trước khi đổi mẫu/áp
  nội dung mẫu); rời trang khi còn thay đổi thì hỏi xác nhận.
- Trang `/tai-cv-len` (kéo thả, tiêu chuẩn, lợi ích) và màn hình tải lên thành
  công gợi ý mẫu CV online (`?nguon=tai-len`).
- Đã đóng 18/11: CV tải lên nguyên tệp nay ứng tuyển được, NTD xem tệp gốc —
  xem [mục riêng](#ứng-tuyển-bằng-cv-tải-lên-và-form-ứng-tuyển-mới-2026-11-18).

## Việc làm tốt nhất xếp theo chất lượng tin (2026-11-15)

- Lỗi tìm thấy: box "Việc làm tốt nhất" ở trang chủ chỉ nhận tin hạng TOP (dịch
  vụ trả phí đã gỡ), còn 100 tin thật nhập ngày 15/11 đều là tin thường nên box
  trống.
- Nay mọi tin đang hoạt động đều đủ điều kiện, xếp theo điểm chất lượng
  (`apps/jobs/selectors/homepage.py`): công khai lương +3, nhãn HOT/GẤP +2, đăng
  trong 7 ngày +2 (trong 30 ngày +1), từ 5 lượt ứng tuyển +1. Tin cùng điểm vẫn
  luân phiên theo seed (F5 ra lượt khác, phân trang ổn định).
- Feed `/viec-lam` mặc định vẫn xếp theo hạng tin rồi độ mới; không ảnh hưởng vì
  mọi tin hiện là tin thường.

## Xử lý hồ sơ ứng tuyển — giai đoạn 1 (2026-11-15)

Lộ trình 6 giai đoạn của workspace `/tuyendung/app/applications`; mỗi giai
đoạn một PR.

| GĐ | Hạng mục | Trạng thái |
| --- | --- | --- |
| 1 | Quy trình 6 trạng thái (bỏ `considering`), thông báo ứng viên (chuông + email) có cửa sổ hoàn tác, tải PDF CV kèm nhật ký truy cập, chặn nộp CV rỗng, làm lại giao diện | ✅ Đã gộp vào dev (#195, #199) |
| 2 | Điểm phù hợp CV–JD có giải thích, xếp hạng danh sách | ⬜ |
| 3 | Chia sẻ CV bằng link bảo mật + phiếu đánh giá nội bộ | ✅ Đã gộp vào dev (#196) |
| 4 | Danh sách đen + phát hiện ứng tuyển hàng loạt | ✅ Đã gộp vào dev (#197) |
| 5 | Kho ứng viên tiềm năng + gợi ý lại khi đăng tin mới | ✅ Đã gộp vào dev (#198) |
| 6 | Gợi ý kỹ năng còn thiếu cho ứng viên bị từ chối | ⬜ |
| Sau | Nhắn tin ứng viên (nút đã đặt sẵn), hẹn lịch phỏng vấn | ⬜ |

<details><summary>Ghi chú giai đoạn 1</summary>

- Trạng thái: `submitted`/`viewed` do hệ thống đặt; NTD chọn Phù hợp, Phỏng
  vấn, Trúng tuyển, Không phù hợp (không cần lý do). Trạng thái cuối có xác
  nhận.
- `CandidateNotification` (app `candidates`) vừa là hộp thư vừa là outbox
  email. Quyết định hẹn giao sau 5 phút; quyết định mới hơn trên cùng hồ sơ
  thay thế thông báo chưa giao; hoàn tác hủy thông báo. Giao và hủy là hai
  UPDATE có điều kiện nên không tranh chấp. Beat `dispatch-candidate-notifications`
  60s. Ứng viên chỉ thấy trạng thái đã được báo.
- NTD tải PDF qua `CvExport` của snapshot (`cv=NULL`, còn sau khi ứng viên xóa
  CV); mọi lần xem/tải ghi `CvAccessLog` (trước đây không nơi nào ghi).
- Lỗi tìm thấy: form ứng tuyển nộp CV DOCX/PDF trước khi phân tích xong nên NTD
  nhận CV rỗng. Nay chờ `waitForCvImport` và server chặn CV thiếu họ tên /
  liên hệ / nội dung.
- Sửa thêm: GET snapshot của ứng viên bị hạn chế trả 500.
- Xác nhận nộp hồ sơ (chuông + email có việc làm tương tự) và trang "Cài đặt
  nhận thông báo" theo kênh Email/Web; xóa 9 công tắc không có tác dụng.
- Sidebar NTD: "Quản lý CV" → "CV ứng tuyển" (mọi tin, badge CV chưa xem);
  "Kho ứng viên tiềm năng" và "Danh sách đen" hiện "Sắp mở" theo GĐ 4–5.

</details>

## Thiết kế lại quản lý tin tuyển dụng của NTD (2026-11-15)

| Hạng mục | Trạng thái |
| --- | --- |
| Danh sách `/tuyendung/app/jobs`: tab trạng thái có số đếm, tìm kiếm tự động, cột hồ sơ/hiệu quả/hạn nộp | ✅ |
| Chi tiết `/tuyendung/app/jobs/:id`: header gọn, 4 chỉ số bấm được, giữ 4 tab | ✅ |
| Tab CV ứng tuyển lọc/phân trang phía server, chip trạng thái kèm số | ✅ |
| API: `status_counts`, `unviewed_application_count`, `application_summary`, `impression_count` | ✅ |

<details><summary>Ghi chú chi tiết</summary>

- Danh sách: tab Tất cả/Đang tuyển/Nháp/Hết hạn/Đã đóng đọc `status_counts`
  của `GET /api/employer/jobs/` (một aggregate, đếm theo cùng `q`); tìm kiếm debounce
  400 ms, giữ `status|q|page` trên URL. Mỗi tin hiện số ứng viên, badge "N mới"
  dẫn tới `/applications?job=…&scope=unread`, lượt xem + tỉ lệ ứng tuyển, hạn
  nộp có đếm ngược, màu cảnh báo và thanh thời gian đã trôi. Từ 1280px dòng là
  bảng; hẹp hơn là thẻ xếp chồng. Trạng thái rỗng dùng `MascotEmpty`.
- Chi tiết: bỏ thông tin lặp (lượt xem xuất hiện ba lần, hai thẻ CV luôn bằng
  nhau vì chỉ có nguồn `applied`). Header gồm tiêu đề, trạng thái, dòng meta bằng
  icon, "Xem tin đăng" khi tin đang công khai; "Đóng tin" nằm trong menu và có
  xác nhận. Bốn chỉ số Lượt xem/Ứng viên/CV chưa xem/Chưa phản hồi; hai chỉ số
  sau mở tab CV với bộ lọc tương ứng (`cv_filter` trên URL). Mobile dùng
  `Segmented` thay cho Select chọn tab.
- Tab CV trước đây tải trang đầu (20 CV) rồi tự tính số liệu, nên sai khi tin
  có nhiều hồ sơ. Nay số liệu lấy từ `application_summary` của chi tiết tin và
  danh sách gọi `/api/employer/applications/?job=…&latest=1` có phân trang,
  sắp xếp, tìm kiếm, lọc phía server; gỡ `getRecruiterApplications` không còn
  nơi dùng. Tab "Ứng viên đã xem tin" thành phễu Hiển thị → Xem → Ứng tuyển.
- `Application.UNANSWERED_STATUSES` là định nghĩa duy nhất cho "chưa phản hồi"
  (scope API, báo cáo chiến dịch, summary tin). Budget query danh sách 5 → 6.
- Style riêng của hai trang nằm trong `employer-jobs.css` đi theo chunk lazy;
  CSS khởi tạo giảm từ 38,3 xuống 38,0 KiB gzip.

</details>

## Gỡ widget Trợ lý ProCV ở cổng ứng viên (2026-11-14)

Xóa toàn bộ `frontend/src/widgets/candidate-assistant` (nút nổi góc phải dưới,
panel chat, kịch bản keyword tĩnh, CSS, unit test) và điểm mount trong
`MainLayout`. Widget không gọi API nên backend không đổi; khóa
`sessionStorage` `procv-assistant-greeting-seen` không còn được ghi. Smoke E2E
bỏ luồng hỏi trợ lý, test tablet chỉ còn kiểm tra nút nổi hỗ trợ. Mascot,
`use-progressive-reply` và `use-visual-viewport-bottom-inset` giữ lại vì
onboarding, hero và nút hỗ trợ còn dùng. Đặc tả chatbot (CB) ghi chú tạm dừng:
mở lại CB-P2 phải dựng UI mới.

## Gỡ phòng ban, chức danh, nhân viên quản trị (ADR-0018, 2026-11-14)

Quyết định: [`adr-0018-remove-admin-rbac.md`](02-tong-quan/adr-0018-remove-admin-rbac.md).
Còn hai cấp quản trị: superuser và admin thường. Xóa phòng ban, chức danh, gán
nhân viên, phạm vi cấp tài khoản và danh mục 56 mã quyền (backend, frontend,
docs); trang `/access-control` và bước CI đồng bộ quyền bị gỡ. Superuser mời
admin qua email (không chọn chức danh), đăng nhập/đặt lại mật khẩu giữ nguyên.
Migration `accounts.0034` (xóa dữ liệu RBAC — cần `pg_dump` trước khi chạy) và
`sitecontent.0023` (xóa nhóm settings `admin_roles`).

Kiểm chứng:

- Backend: ruff, import-linter, layering, `makemigrations --check` sạch. Test
  theo nhóm: accounts/knowledgebase/sitecontent 264 passed, employers 468
  passed, applications/blog/cv_templates/cvs/jobs 463 passed (3 test
  `test_pdf_renderer` lỗi do venv local thiếu `playwright`, không liên quan).
  `accounts.0034` chạy tới → lùi `0033` → tới lại trên DB riêng. Suite đầy đủ
  kèm ngưỡng coverage 84% chưa chạy xong cục bộ, để CI xác nhận.
- Frontend: lint, kiến trúc, build, bundle budget đạt; vitest 1389 test, ratchet
  coverage đạt. E2E smoke 284 passed; spec `admin-company.spec.js` vốn fail trên
  mobile ở CI của `dev` từ khi gộp trang công ty (6 tab tràn khung, antd mobile
  bỏ menu "…" nên tab ngoài khung không bấm được) — test nay chọn tab bằng bàn
  phím (focus + Enter), pass cả desktop/tablet/mobile.
- Chạy thật trên DB riêng `rbac_verify`: superuser đăng nhập → mời admin (không
  có ô chức danh) → link `/invitation` đặt mật khẩu → admin thường đăng nhập,
  thấy 11 khu vực, không có nhóm "Hệ thống"; `/settings` → trang từ chối,
  `/access-control` → 404; API lời mời/settings/audit toàn hệ thống trả 403.

## Trang công ty và quyền biên tập (CP, 2026-11-14)

Kế hoạch: [`ke-hoach-trang-cong-ty.md`](01-phan-tich/ke-hoach-trang-cong-ty.md).
Quyết định: [ADR-0017](02-tong-quan/adr-0017-company-page.md), ER-D58 đến ER-D64.

| Giai đoạn | Nội dung | Trạng thái |
| --- | --- | --- |
| CP-0 | Nền móng: predicate người đại diện chuyển xuống `employers/models/representation.py`; `GET /api/public/jobs/?company=<public_id>` (0 query phát sinh) và `company_slug` trên DTO tin; slug `tim-kiem` dành riêng; `Company.public_headquarters` dùng chung cho danh bạ và chi tiết tin (hộ kinh doanh không lộ địa chỉ); frontend chuyển `CompanyLogo` + helper tên công ty vào `entities/company/company`, `RichContent` và `ShareButtons` vào `shared/ui` | ✅ Xong trên nhánh, chưa gộp |
| CP-1 | `GET /api/public/companies/<slug>/` dạng khối có kiểu (một builder), công ty tương tự, facets tỉnh/thành; admin tạm ẩn trang (`company_page.moderate`, 404 thật, loại khỏi danh bạ/sitemap/gợi ý); SEO shell `/cong-ty/<slug>` + `Organization`/`BreadcrumbList`, `sitemaps/companies.xml`; seed tạo owner đã xác thực | ✅ Xong trên nhánh, chưa gộp |
| CP-2 | Trang `/cong-ty/:slug` (Tổng quan / Việc làm qua URL, lọc từ khoá + tỉnh), thay mọi liên kết công ty theo tên bằng slug, tab admin "Trang công khai" | ✅ Xong trên nhánh, chưa gộp |
| CP-3 | Theo dõi công ty (idempotent, `follower_count` qua `F()`), trang `/tai-khoan/cong-ty-dang-theo-doi` | ✅ Xong trên nhánh, chưa gộp |
| CP-4 | Báo cáo thông tin sai, hàng chờ admin "Báo cáo công ty" (`company_report.*`), xử lý kèm tạm ẩn trang | ✅ Xong trên nhánh, chưa gộp |
| CP-5 | Chính sách quyền ở tầng models, uỷ quyền biên tập, bố cục áp dụng ngay (khoá lạc quan), tin ghim; workspace `/tuyendung/app/company-page` có xem trước | ✅ Xong trên nhánh, chưa gộp |
| CP-6 | Khẩu hiệu, văn hoá, video, mạng xã hội, phúc lợi dạng thẻ, văn phòng qua `CompanyUpdateRequest` (gộp theo khối), tab "Nội dung", độ hoàn thiện (từ 19/11 đăng ngay và hậu kiểm, xem [Hậu kiểm nội dung trang công ty](#hậu-kiểm-nội-dung-trang-công-ty-2026-11-19)) | ✅ Xong trên nhánh, chưa gộp |
| CP-7 | Nguồn digest email thứ ba "công ty đang theo dõi", tuỳ chọn `followed_company_jobs` | ✅ Xong trên nhánh, chưa gộp |

## Làm lại Template CV (CVT-v3, 2026-11-13)

Kế hoạch: [`ke-hoach-cv-template-v3.md`](01-phan-tich/ke-hoach-cv-template-v3.md)
(gồm mục 5.6 — dữ liệu CV cùng từ vựng với JD để làm matching sau này).

| Giai đoạn | Nội dung | Trạng thái |
| --- | --- | --- |
| CVT-0 | Sửa preview kẹt khi mở trang chi tiết mẫu; bỏ "Khôi phục bản chưa lưu" (UI + `GET /api/candidate/cvs/latest-recoverable-draft/`); đồng bộ H1/breadcrumb/`<title>` và query `nguon`, `vi-tri`, `ngon-ngu`, `mau`; chỉ còn tiếng Việt/Anh (`SUPPORTED_LOCALE_CODES`, redirect 301 kho Nhật/Trung) | ✅ Gộp vào `dev` (PR #176, 2026-11-13). pytest 1155 passed (87,48%), vitest 1196/1198 (2 test nhà tuyển dụng timeout khi chạy song song, chạy riêng pass), E2E smoke 257 passed + 1 flaky (announcement strip mobile, chạy lại 3/3 pass) |
| CVT-1a | Ngôn ngữ CV thành enum `CvLanguage`; tên/mô tả/SEO mẫu thành trường `*_vi`/`*_en` (data migration giữ dữ liệu); gỡ `sitecontent.Locale`, API locale, `locale_ref`, tab admin "Ngôn ngữ", entity FE `locale`; xóa dữ liệu tiếng Nhật/Trung | ✅ Gộp vào `dev` (PR #178 frontend, #179 backend + docs, 2026-11-14). pytest 1151 passed (87,48%), vitest 1198/1198, E2E smoke 258 passed |
| CVT-1b | `CvPositionProfile` (1-1 vị trí chuyên môn, `section_preset`), `ExperienceBand`, nội dung mẫu theo vị trí × ngôn ngữ × nhóm kinh nghiệm, bỏ `CvContentBlueprint` (data migration giữ nội dung), resolver ưu tiên đúng nhóm kinh nghiệm, seed mới; gỡ tab/menu Blueprint và menu "Ngôn ngữ" sót từ CVT-1a | ✅ Gộp (PR #180, 2026-11-14). pytest 1155 passed (87,60%), vitest 1198/1198, E2E smoke 258 passed |
| CVT-1c | `UserCv.experience_years` (enum JD, tính từ mục kinh nghiệm) dùng cho gợi ý việc làm; gỡ cột legacy của `UserCv`/`CvTemplate`, adapter V1, `theme_color`/`color_variants` trên card, `sample_content_public_id` khi tạo CV và endpoint chi tiết nội dung mẫu | ✅ Gộp (PR #181, 2026-11-14) |
| CVT-2 | Registry 8 layout dùng chung BE/FE (`layouts.json`, test so khớp); một renderer chung theo hàng/vùng (tone plain/tint/band, xếp dọc/ngang, biến thể timeline/compact), bỏ header cứng — tên/liên hệ/ảnh là section đặt theo vùng; PDF và ảnh catalogue in bằng Chromium (Playwright) từ trang `cv-print.html` của frontend, chặn mọi request ngoài origin; 4 font OFL tự host (Inter, Roboto, Be Vietnam Pro, Lora), font cũ map sang font mới; seed publish version mới cho 10 mẫu; migration đổi khóa layout cũ; danh tính minh họa chỉ cho ảnh catalogue và khách chưa đăng nhập | ✅ Gộp (PR #182, 2026-11-14). Thiết kế 8 layout đã duyệt. pytest 1161 passed (87,63%), vitest 1203/1203, E2E smoke 267 passed |
| CVT-3 | Trường riêng theo vị trí (`CvPositionField`, section `position_details` chụp định nghĩa vào CV), từ khóa vị trí; section `portfolio`, `publications`; matching: `education_level` từ `degree_level`, `position_level` chọn trong panel "Hồ sơ ứng tuyển" của editor, `CvSkill` đồng bộ theo taxonomy kỹ năng; sinh nội dung mẫu bằng AI qua runtime `ai_core` (queue `ai-generation`, ≤ 16 tổ hợp, chặn dữ liệu cá nhân, trạng thái chờ duyệt); một bản xuất bản mỗi tổ hợp; API admin vị trí/trường riêng/độ phủ/import-export JSON; seed trường riêng cho 9 vị trí | 🟨 Xong code trên nhánh `feat/cvt-3-positions` |
| CVT-4 | Cổng quản trị Mẫu CV: tổng quan, danh sách mẫu (kéo thả thứ tự, nhân bản, ẩn/hiện), **trang chỉnh sửa một màn hình** thay wizard 6 bước (thiết lập trái, xem trước phải, tự lưu, bản nháp tạo tự động; tạo mẫu chỉ cần tên VI/EN + bố cục, backend xếp sẵn mục theo `section_plans` và gán bảng màu khởi đầu), hộp xuất bản có checklist + PDF thử; vị trí & nội dung gợi ý (ma trận kinh nghiệm × ngôn ngữ, hàng đợi duyệt AI); thư viện; CV ứng viên có audit. Sửa: preview admin giật (vòng lặp thanh cuộn ↔ tỉ lệ thu phóng), lỗi "locale, experience_band must make a unique set" khi lưu nội dung gợi ý, lỗi "≤ 90" khi lưu độ rộng cột; kho mẫu công khai đổi sang `Cache-Control: public, no-cache` + ETag/304 (ẩn/xuất bản có hiệu lực ngay), ảnh mẫu cũ xóa trễ 30 phút và frontend thay ảnh lỗi bằng khung minh họa | 🟨 Xong code trên nhánh `feat/cvt-4-admin-portal` |
| CVT-5 | Trang chi tiết mẫu: lựa chọn (nguồn, vị trí, kinh nghiệm, ngôn ngữ, màu) có một nguồn sự thật là query string; `useCvSource` dùng TanStack Query (preview cũ giữ khi tải bản mới, màu áp phía client); vị trí mặc định không ghi lên URL, trang có query `noindex`; chưa đăng nhập → đăng nhập ngay tại trang rồi tự tạo CV một lần; `POST /api/candidate/cvs/` nhận `Idempotency-Key`; mobile có thanh "Tạo CV" cố định + bottom sheet (nút nổi tự nâng qua `--page-bottom-bar-height`); kho mẫu `useInfiniteQuery` 24 mẫu/trang, lọc có ảnh / một-hai cột | 🟨 Xong code trên nhánh `feat/cvt-5-template-detail` |
| CVT-6…CVT-7 | Upload, hoàn thiện | ⬜ Planned |

## Gỡ xác thực hai bước (ADR-0016, 2026-11-13)

Quyết định: [`adr-0016-remove-two-factor-auth.md`](02-tong-quan/adr-0016-remove-two-factor-auth.md).
Gỡ 2FA/MFA ở cả ba cổng (backend, frontend, docs); `bootstrap_admin_mfa` thay
bằng `verify_admin_email`. Migration `accounts.0030` và `knowledgebase.0004` đã
chạy trên DB local (có bản `pg_dump` trước khi chạy). Cổng `check_all.sh` xanh:
pytest 1155 passed (87,48%), vitest 1190, E2E smoke 258 passed.

## Epic hậu kiểm tin, gỡ dịch vụ thương mại và dọn docs (PM, 2026-11-13)

Quyết định:
[`adr-0014-job-post-moderation.md`](02-tong-quan/adr-0014-job-post-moderation.md),
[`adr-0015-remove-commercial-services.md`](02-tong-quan/adr-0015-remove-commercial-services.md).

Các nhánh nối tiếp nhau, chưa push; gộp theo thứ tự:

| PR | Nhánh | Phase | Cổng kiểm tra |
| --- | --- | --- | --- |
| 1–2 | `refactor/remove-job-approval-workflow` | PM-1 → PM-3b | pytest 1268 passed (87,70%); vitest 1247, E2E 270 passed |
| 3 | `refactor/remove-commercial-services` | PM-4a | pytest 1175 passed (87,47%); vitest 1208, E2E 258 passed |
| 4 | `chore/drop-services-app` | PM-4b | pytest 1176 passed (87,47%) |
| 5 | `docs/restructure-docs` | PM-6 | link check |
| 6 | `docs/sync-progress-and-changelog` | PM-7 | link check |

PR 4 chỉ được triển khai ở môi trường đã chạy `services.0012` (PR 3). DB local
đã áp dụng `services.0012` trước khi kịp sao lưu, vì container backend chạy
`manage.py migrate` khi khởi động; bản sao lưu sau đó nằm ở
`~/Documents/ai-recruitment-platform-backups/`.

> Lưu ý khi chạy E2E local: nếu container frontend Docker đang giữ cổng 5173,
> Playwright sẽ dùng lại server đó và nhiều test lỗi giả. Chạy
> `PLAYWRIGHT_PORT=4317 PLAYWRIGHT_WEB_SERVER=preview npm run test:e2e:smoke`.

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| PM-0 | Tag `pre-post-moderation`, nhánh làm việc | ✅ Hoàn tất |
| PM-1 | ADR-0014, ADR-0015, đánh dấu ADR-0012 thay thế một phần | ✅ Hoàn tất |
| PM-2 | Backend: đăng tin là công khai, gỡ duyệt tin, migration dữ liệu | ✅ Hoàn tất — đạt cổng backend |
| PM-3 | Frontend: cổng nhà tuyển dụng và quản trị theo hợp đồng API mới | ✅ Hoàn tất — đạt cổng frontend kể cả E2E |
| PM-3b | Lưu cam kết chịu trách nhiệm khi đăng và mở lại tin; nhà tuyển dụng thấy tin bị tạm ẩn kèm nhóm lý do | ✅ Hoàn tất — đạt cổng backend và frontend |
| PM-4a | Gỡ mọi chỗ dùng `services`, giao diện, quyền admin; migration xóa bảng | ✅ Hoàn tất — đạt cổng, migration đã chạy trên DB local |
| PM-4b | Xóa thư mục app `services` và cấu hình còn lại | ✅ Hoàn tất — pytest 1176 passed, coverage 87,47% |
| PM-5 | Kiểm thử tích hợp ba cổng | ⬜ Chưa bắt đầu |
| PM-6 | Dọn docs, xóa `99-tien-do`, dựng lại mục lục | ✅ Hoàn tất — 88 → 46 file, link check đạt |
| PM-7 | Bổ sung changelog còn thiếu, rút gọn tiến độ, đồng bộ phân tích yêu cầu với báo cáo ĐATN | 🟨 Changelog, tiến độ và sơ đồ use case tổng quát (cập nhật 2026-11-16) xong; chờ báo cáo ĐATN |

Đã chốt (2026-11-13): nhà tuyển dụng không sửa được tin đang bị tạm ẩn; muốn
khắc phục nội dung phải liên hệ quản trị viên.

## Epic tái cấu trúc ProCV (P0–P10, 2026-09)

Mục tiêu: tổ chức lại repo, CI, env và docs mà không đổi UI, URL, API, dữ liệu,
quyền hay lịch tác vụ. Baseline: `dev` tại `dddf4455` (23/09/2026).

| Giai đoạn | Đầu ra | Trạng thái |
| --- | --- | --- |
| P0 | Kiểm kê repo, hợp đồng hành vi, số đo CI | ✅ Verified |
| P1 | Chẩn đoán và sửa test lỗi hoặc treo | 🟨 Implemented |
| P2 | Dọn artifact, media test và ignore; đợt 2 (2026-11-13, `chore/repo-cleanup`): test media vào thư mục tạm, siết `backend/.dockerignore`, xóa code/asset/lệnh one-off chết | 🟨 Implemented |
| P3 | Bỏ cấu hình deploy production, giữ Compose local | 🟨 Implemented |
| P4 | Mỗi service một cặp `.env`/`.env.example` (backend, frontend), bỏ env root, gỡ biến chết, `sync_local_env.py` | 🟨 Implemented |
| P5 | Chuẩn hóa backend theo app | ⬜ Planned |
| P6 | Chuẩn hóa ownership frontend | ⬜ Planned |
| P7 | Hợp nhất docs và tiến độ | Thay bằng PM-6, PM-7 của epic hậu kiểm |
| P8–P9 | Tối ưu thời gian CI: pytest song song, shard unit/E2E | 🟨 Implemented — lượt đo thứ hai chưa có |
| P10 | Nghiệm thu và hồ sơ bàn giao | ⬜ Planned |

Việc còn mở:

- P1–P4, P8–P9 chỉ chuyển Verified sau khi gộp vào `dev` và full CI đạt trên
  cùng SHA.
- E2E CI còn lỗi không ổn định ở một viewport mỗi lượt, chưa rõ nguyên nhân gốc;
  CI cho phép một lần retry và báo `flaky`.
- `npm audit fix` cần chạy trên máy có kết nối npm registry.
- Env cá nhân còn key `SPEECH_*` của TTS đã gỡ và hai key lặp
  (`EMPLOYER_DOMAIN_DNS_TIMEOUT_SECONDS`, `EMPLOYER_DOMAIN_RECHECK_BATCH_SIZE`);
  chủ máy tự xóa, không xóa theo wildcard.

## Epic rà soát và hardening cổng Nhà tuyển dụng (ER, 2026-08-10)

Đặc tả canonical:
[`dac-ta-nha-tuyen-dung.md`](01-phan-tich/dac-ta-nha-tuyen-dung.md).
Decision log:
[`employer-remediation-decision-log.md`](02-tong-quan/employer-remediation-decision-log.md).

Code đã hoàn tất cho ER-0 đến ER-8. Còn lại là việc kích hoạt: upload strict
mode và Chrome QA (ER-3), DPA cần bản pháp lý chính xác, SMS cần gateway
production, staging và soak (ER-8). Lệnh kiểm tra chỉ đọc:
`check_upload_scanner_readiness`, `check_employer_sms_readiness`.

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| ER-0 | Audit baseline, permission/state matrix và khóa quyết định | ✅ Hoàn tất |
| ER-1 | Empty/error state, document IDOR và job approval guard | ✅ Hoàn tất |
| ER-2 | Readiness/permission contract và frontend guards | ✅ Hoàn tất |
| ER-3 | Upload session, quarantine, malware scan và retention | 🟨 Đang làm — Docker/ClamAV local đạt; còn Chrome + staging/strict rollout |
| ER-4 | Company update request V2, revision và conflict handling | ✅ Hoàn tất |
| ER-5 | Verification final decision, blockers và compliance holds | ✅ Hoàn tất |
| ER-6 | SMS provider adapter và DPA evidence/version/grace | ✅ Hoàn tất code — production SMS activation thuộc ER-8 |
| ER-7 | Company unlink, notification center và activity | ✅ Hoàn tất code |
| ER-8 | Rollout, reconciliation, compatibility cleanup và audit closure | 🟨 Code complete — chờ staging/production activation và soak |

## Các epic đã hoàn tất

| Epic | Thời gian | Kết quả chính | Tài liệu |
| --- | --- | --- | --- |
| FAQ và hướng dẫn sử dụng (KB-P0…P6) | 2026-08 | Trung tâm trợ giúp public, workspace quản trị có revision | [đặc tả](01-phan-tich/dac-ta-trung-tam-tro-giup.md) |
| Thông báo đa cổng (AN-P0…P5) và visual theme (AN-V0…V3) | 2026-07 → 08 | Dải thông báo ba cổng, targeting, analytics, theme và ảnh nền | [đặc tả](01-phan-tich/dac-ta-thong-bao-da-cong.md) |
| Hoàn thiện CV Builder (CVB-P0…P6, CVB-8) | 2026-07 | Canonical document, catalogue, import PDF/DOCX, editor WYSIWYG A4 | [kiến trúc](02-tong-quan/cv-builder-architecture-foundation.md) |
| Dọn dẹp frontend (FE-P1…P6) | 2026-07 | Enforcement FSD, TanStack Query, tách file lớn, tối ưu asset | [`frontend/ARCHITECTURE.md`](../frontend/ARCHITECTURE.md) |
| Audit và refactor toàn dự án (AR-P0…P8) | 2026-07 | Layout ADR-0010, import-linter, coverage gate 84%, xóa API v1 | [audit](02-tong-quan/flow-audit-2026-07.md) |
| Onboarding ứng viên dạng hội thoại | 2026-08 | Một trang hội thoại năm câu hỏi | [đặc tả](01-phan-tich/dac-ta-onboarding-ung-vien.md) |
| Account status enforcement, vá xác thực admin và OAuth | 2026-07 | Khóa, tạm khóa, hold tài nguyên; MFA admin | [database](03-database/thiet-ke-database.md) |
| Trang chủ, cổng marketing nhà tuyển dụng | 2026-07 | Trang chủ ứng viên, 4 trang marketing VI/EN | [tổng quan](02-tong-quan/tong-quan-he-thong.md) |

## Lộ trình theo PRD

| Giai đoạn | Trạng thái | Ghi chú |
| --- | --- | --- |
| 0 — Khởi tạo dự án | ✅ | |
| 1 — MVP lõi | ✅ | Ba cổng, việc làm, CV builder, ứng tuyển, workspace chiến dịch và tin |
| 2 — AI cơ bản | 🟨 | Đã có: import CV qua AI, đối sánh rule-based (`match_score`), runtime `ai_core` với `AiInvocation` và `AiUsageDaily`. Chưa có: bảng `cv_analysis`, `match_results`, `ai_suggestions`; trích xuất kỹ năng; mô hình phân loại kỹ năng |
| 3 — Tối ưu tìm kiếm / matching | 🟨 | Embedding (pgvector) và semantic matching CV–JD: nền tảng đã có, xem [đối sánh ngữ nghĩa CV–JD chạy local](#đối-sánh-ngữ-nghĩa-cvjd-chạy-local-2026-11-15) |
| 4 — CV nâng cao | 🟨 | Còn import LinkedIn, AI writer, review CV bằng AI |
| 5 — Tuyển dụng nâng cao | ✅ | Việc đã lưu, lịch sử trạng thái hồ sơ, notification center của nhà tuyển dụng |
| 6 — Thương mại & quản trị | ✅ | Quản trị (hai cấp superuser/admin theo ADR-0018), blog, marketing. Gói đăng ký và quota trả phí (6.1, 6.2) bỏ khỏi phạm vi theo ADR-0015 |
| 7 — Deployment | 🟨 | Docker Compose local có; cấu hình production đã bỏ ở P3, chưa triển khai |

## Việc còn mở

AI lõi của đồ án (phạm vi chốt 2026-11-15, xem
[sơ đồ use case](01-phan-tich/phan-tich-yeu-cau.md#sơ-đồ-use-case-tổng-quát-cập-nhật-2026-11-16)):

- 🟨 Đối sánh ngữ nghĩa CV–JD chạy và fine-tune local (bi-encoder mã nguồn mở +
  pgvector, pipeline tự xây), không gọi API ngoài: xem
  [lộ trình 8 tuần](#đối-sánh-ngữ-nghĩa-cvjd-chạy-local-2026-11-15).
- ⬜ Ứng viên: Phân tích mức độ phù hợp CV–JD (điểm tổng và theo tiêu chí, kỹ
  năng khớp/thiếu, gợi ý cải thiện CV); chuyển Việc làm gợi ý sang module ngữ
  nghĩa.
- ⬜ Nhà tuyển dụng: Sàng lọc và xếp hạng hồ sơ ứng tuyển bằng AI; Tìm kiếm hồ
  sơ ứng viên xếp theo độ phù hợp với một tin (chỉ ứng viên đã bật
  `recruiter_visibility`).
- Giai đoạn 2–3: lưu kết quả phân tích CV và đối sánh, trích xuất kỹ năng
  ([thuật toán AI](07-algorithms/thuat-toan-ai.md)).
- Import CV gọi thẳng REST của Gemini, OpenAI hoặc Anthropic trong
  `apps/ai_core/services/cv_import.py`, không qua runtime `ai_core`: không bị
  `AI_RUNTIME_ENABLED` chặn, không ghi `AiInvocation`, không quota.
- Site setting `ai_cv_review_enabled`, `ai_job_match_enabled`,
  `ai_daily_request_limit` được seed nhưng không có chỗ nào đọc.

Dọn phần còn sót của ADR-0014 và ADR-0015:

- Site setting nhóm `payment` và `email_notify_job_approved` không còn consumer.
- `RecruitmentNeed.consultation_topics` còn lựa chọn `service_packages`.

Kích hoạt và rollout:

- ER-3, ER-8, DPA và SMS như mục ER ở trên; AN-P6 (xóa compatibility legacy sau
  một release ổn định); AN-V4 (runbook và seed ví dụ cho visual theme).
- P1–P4, P8–P9 chờ full CI trên `dev` để chuyển Verified.

Sản phẩm:

- Cảnh báo domain công ty ở `Register.jsx` hứa giới hạn mua hoặc đăng tin không
  tồn tại.
- `POST /api/employer/jobs/` bị chặn ở bước đăng vẫn giữ bản nháp vừa tạo.
