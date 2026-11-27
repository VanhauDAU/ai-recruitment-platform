# Tiến độ dự án

Ảnh chụp trạng thái hiện tại, đối chiếu với `dev` ngày **26/11/2026** (commit
`a3ea5d5d`, PR mới nhất #397). File này trả lời câu hỏi "cái gì đã chạy, cái gì còn
mở". Nó không phải nhật ký:

- chi tiết từng thay đổi nằm ở [`CHANGELOG.md`](../CHANGELOG.md);
- lý do thiết kế nằm ở [ADR](adr/README.md) và đặc tả trong `01-phan-tich/`;
- bản tiến độ cũ (nhật ký theo tính năng, gồm nhật ký thực nghiệm AI) được lưu ở
  [archive](archive/snapshot/tien-do-den-2026-11-26.md).

Ký hiệu: ✅ chạy trên `dev` · 🟨 một phần (ghi rõ phần còn thiếu) · ⬜ chưa làm ·
➖ đã gỡ có chủ đích.

## Cổng ứng viên

| Module | Trạng thái | Nguồn |
| --- | --- | --- |
| Đăng ký, đăng nhập email và mạng xã hội (popup trên desktop), hạn phiên theo cổng | ✅ | [ADR-0033](adr/adr-0033-portal-session-policy.md), [đăng nhập MXH](05-huong-dan/dang-nhap-mang-xa-hoi.md) |
| Onboarding hội thoại, nhu cầu việc làm | ✅ | [đặc tả](01-phan-tich/dac-ta-onboarding-ung-vien.md) |
| Tìm việc, bộ lọc, so sánh tin, việc đã lưu, thứ tự và nhãn công bằng | ✅ | [ADR-0030](adr/adr-0030-fair-job-listing.md) |
| Việc làm gần tôi (bản đồ, bán kính) | ✅ | [ADR-0029](adr/adr-0029-nearby-jobs-geo.md), [đặc tả](01-phan-tich/dac-ta-tim-viec-gan-day.md) |
| Danh bạ và trang công ty, theo dõi công ty | ✅ | [ADR-0013](adr/adr-0013-public-companies-api.md), [ADR-0017](adr/adr-0017-company-page.md) |
| CV builder: mẫu, editor A4, import PDF/DOCX, xuất PDF, chia sẻ | ✅ | [kiến trúc CV Builder](02-tong-quan/kien-truc-cv-builder.md) |
| Ứng tuyển bằng CV tạo trên web hoặc tải lên, theo dõi, rút, nhắc | ✅ | [đặc tả tin và pipeline](01-phan-tich/dac-ta-chien-dich-va-tin-tuyen-dung.md) |
| Việc làm gợi ý theo ngữ nghĩa, ẩn gợi ý | ✅ | [gợi ý việc làm](07-algorithms/goi-y-viec-lam-ung-vien.md) |
| Xem độ phù hợp CV–tin (AI local) | 🟨 | Chạy với mô hình gốc và `hybrid-v2` phần luật; mô hình fine-tune chưa xong, xem [AI/ML](#aiml-chạy-local) |
| Thông báo realtime, hoàn tác 15 giây, tab bar và thông báo trên mobile | ✅ | [ADR-0028](adr/adr-0028-realtime-notifications.md) |
| ProCV Connect: lời mời kết nối, nhắn tin, lịch phỏng vấn | ✅ | [ADR-0032](adr/adr-0032-procv-connect-messaging.md), [đặc tả](01-phan-tich/dac-ta-procv-connect.md) |
| Trung tâm trợ giúp, blog cẩm nang (có đọc bằng giọng nói) | ✅ | [đặc tả trợ giúp](01-phan-tich/dac-ta-trung-tam-tro-giup.md) |
| Đồng ý cookie: chỉ đo lường và lưu tùy chọn khi được phép, trang chính sách cookie, mở lại cài đặt ở cả hai cổng | ✅ | [cookie consent và lượt xem](04-api/dong-y-cookie-va-luot-xem-tin.md) |
| Yêu cầu xóa tài khoản và dữ liệu cá nhân | 🟨 | Gửi yêu cầu vào hàng chờ admin; tự phục vụ xuất/xóa để sau go-live |
| Song ngữ vi/en | 🟨 | Nền tảng xong; còn 1.694 dòng chữ viết cứng ở `pages/main`, `features/main`, `widgets/main` (`frontend/scripts/i18n-baseline.json`) |
| Chatbot FAQ | ⬜ | [đặc tả](07-algorithms/chatbot-ung-vien-faq.md), chưa xếp lịch |

## Cổng nhà tuyển dụng

| Module | Trạng thái | Nguồn |
| --- | --- | --- |
| Đăng ký, công ty, thành viên, owner duyệt tham gia, chuyển quyền owner, tiếp quản tin | ✅ | [đặc tả NTD](01-phan-tich/dac-ta-nha-tuyen-dung.md) |
| Xác thực doanh nghiệp, DPA, xác thực SĐT | 🟨 | Code xong. Chưa kích hoạt: ranh giới lưu trữ upload (ER-3), bằng chứng DPA, gateway SMS production ([vận hành](06-deployment/van-hanh-va-kill-switch.md)) |
| Tin tuyển dụng: đăng, hậu kiểm, một trạng thái hiệu lực, mã tin dễ đọc | ✅ | [ADR-0014](adr/adr-0014-job-post-moderation.md), [ADR-0019](adr/adr-0019-job-effective-state.md) |
| AI tạo tin tuyển dụng (Gemini hoặc Claude) | ✅ | [AI tạo tin](07-algorithms/ai-tao-tin-tuyen-dung.md) |
| Chiến dịch: vòng đời, đa kênh, nguồn ứng viên, tự đăng Facebook/Instagram/Threads/LinkedIn, sức khỏe | ✅ | [ADR-0020](adr/adr-0020-campaign-lifecycle-and-distribution.md), [ADR-0025](adr/adr-0025-campaign-social-networks.md), [sức khỏe](07-algorithms/suc-khoe-chien-dich.md) |
| Hồ sơ ứng tuyển, kho ứng viên, chặn ứng viên, phễu trên trang chủ NTD | ✅ | [đặc tả tin và pipeline](01-phan-tich/dac-ta-chien-dich-va-tin-tuyen-dung.md) |
| AI xếp hạng hồ sơ ứng tuyển, hồ sơ trích xuất | ✅ | Chỉ chấm hồ sơ ứng viên đồng ý; không tự loại theo điểm ([thuật toán AI](07-algorithms/thuat-toan-ai.md)) |
| Tìm CV ẩn danh theo tin, mời ứng tuyển | ✅ | [đặc tả ProCV Connect](01-phan-tich/dac-ta-procv-connect.md) |
| Thông báo hệ thống, lịch sử hoạt động, huy hiệu Sấm Chớp | ✅ | [ADR-0027](adr/adr-0027-flash-badge-responsiveness.md) |
| Song ngữ vi/en | ✅ | [ADR-0023](adr/adr-0023-i18n-vi-en.md) |
| Gói dịch vụ trả phí, quota mua tin | ➖ | Gỡ theo [ADR-0015](adr/adr-0015-remove-commercial-services.md) |

## Cổng quản trị

| Module | Trạng thái | Nguồn |
| --- | --- | --- |
| Bảng điều khiển, hàng chờ cập nhật realtime | ✅ | |
| Người dùng, nhà tuyển dụng, công ty, duyệt xác thực | ✅ | |
| Hậu kiểm tin, báo cáo tin, hậu kiểm nội dung trang công ty | ✅ | [quản lý tin](08-frontend/quan-ly-tin-cong-quan-tri.md) |
| Danh mục dữ liệu: kỹ năng, ngành nghề, phúc lợi, lĩnh vực, ngôn ngữ | ✅ | |
| Cấu hình hệ thống | ✅ | [ADR-0026](adr/adr-0026-settings-contract.md), [danh mục key](05-huong-dan/cau-hinh-site-settings.md) |
| Nội dung: FAQ, hướng dẫn, blog, banner, thông báo đa cổng | ✅ | [ADR-0024](adr/adr-0024-content-publish-without-review.md), [thông báo đa cổng](01-phan-tich/dac-ta-thong-bao-da-cong.md) |
| Mẫu CV và CV người dùng | ✅ | |
| Bảo vệ đăng nhập admin | 🟨 | Cloudflare Access trước `quantri.procv.site` (và `procv.site/quan-tri*`, `/admin*` cũ); MFA trong ứng dụng để sau go-live. 2FA cũ ➖ theo [ADR-0016](adr/adr-0016-remove-two-factor-auth.md) |
| Phòng ban, chức danh, nhân viên quản trị | ➖ | Còn hai cấp superuser/admin theo [ADR-0018](adr/adr-0018-remove-admin-rbac.md) |
| Song ngữ vi/en | 🟨 | Còn 2.650 dòng chữ viết cứng ở `features/admin`, `widgets/admin`, `pages/admin` |

## AI/ML chạy local

Phạm vi đã chốt: đối sánh ngữ nghĩa CV–tin tự xây và fine-tune trên máy, không gọi
API ngoài ([phân tích yêu cầu](01-phan-tich/phan-tich-yeu-cau.md#phạm-vi-ai-đã-chốt),
[thuật toán AI mục 7](07-algorithms/thuat-toan-ai.md)). Dữ liệu và script huấn
luyện ở [`ml/`](../ml/README.md).

| Giai đoạn | Trạng thái | Ghi chú |
| --- | --- | --- |
| Nền tảng `apps/matching`, pgvector, 100 tin thật, 100 CV tổng hợp | ✅ | |
| Trích xuất hồ sơ `extract-v4` (PDF hai cột, chức danh CV tải lên, nội dung từng mục) | ✅ | |
| Đo lường trên tập vàng 30 tin / 300 cặp (`matching_evaluate`) | ✅ | Số đo ở [`ml/reports/eval_validation.md`](../ml/reports/eval_validation.md) |
| Gợi ý việc làm theo ngữ nghĩa | ✅ | |
| `hybrid-v2` phần không cần huấn luyện | ✅ | Bỏ địa điểm, trần theo mức liên quan |
| NTD xếp hạng hồ sơ, hồ sơ trích xuất, Tìm CV | ✅ | |
| Dữ liệu huấn luyện, bi-encoder `e5-base-wise-v1`, cross-encoder `req-ce-v1` | ✅ | Validation: Spearman 0,705 → 0,822, NDCG@5 0,870 → 0,921 ([mục 7](07-algorithms/thuat-toan-ai.md)) |
| Công thức `hybrid-v3`, cross-encoder trong `ml-worker`, `result_json` bản 3 | ✅ | |
| Cấu hình production dùng hai mô hình mới | ✅ | Từ 27/11; [quy trình và quay lui](06-deployment/van-hanh-va-kill-switch.md#bật-mô-hình-đã-huấn-luyện-e5-base-wise-v1--req-ce-v1) |
| Chạy tập test một lần, nghiệm thu | ⬜ | 27/12/2026, chỉ chạy một lần; người đã chấm mù 50 cặp (kappa 0,915) |
| Tìm ứng viên bằng câu tự do | ⬜ | Web không có torch; hiện tìm theo tin đang tuyển |

## Hạ tầng và vận hành

| Hạng mục | Trạng thái | Nguồn |
| --- | --- | --- |
| Docker Compose dev, CI (backend, frontend, docs, security) | ✅ | [Docker Compose](06-deployment/docker-compose.md), [tiêu chuẩn kiểm thử](05-huong-dan/tieu-chuan-kiem-thu.md) |
| Bộ file production procv.site, hardening bảo mật, giám sát, chịu tải, pháp lý | ✅ | [runbook](06-deployment/huong-dan-deployment.md) |
| Sao lưu mã hóa và khôi phục | ✅ | [sao lưu và khôi phục](06-deployment/sao-luu-va-khoi-phuc.md) |
| Lên VPS, đo k6 thật, diễn tập khôi phục | 🟨 | Đang chạy demo trên VPS Azure 16 GB (26/11); k6 và diễn tập khôi phục hẹn 2/12/2026 theo [go-live](06-deployment/go-live.md) |

## Việc đang mở

Sắp theo hạn. Khi xong một việc, xóa dòng ở đây và sửa trạng thái ở bảng trên.

| Việc | Hạn hoặc điều kiện | Ghi chú |
| --- | --- | --- |
| Go-live procv.site | 2/12/2026 | Tài khoản ngoài và các bước trong ngày ở [go-live](06-deployment/go-live.md) |
| Chạy tập test của mô hình đối sánh | 27/12/2026 | Chỉ chạy một lần (`evaluate.py --split test --final`) |
| Báo cáo đồ án, slide, diễn tập demo | Nộp 12/2026 | Sau khi sửa nguồn sơ đồ, vẽ lại hình bằng `sh docs/01-phan-tich/mo-hinh-hoa-yeu-cau/cong-cu/build.sh` |
| Kích hoạt ER-3, bằng chứng DPA, gateway SMS | Khi có nhà cung cấp production | [vận hành](06-deployment/van-hanh-va-kill-switch.md) |
| Sửa lời cảnh báo email tên miền ở trang đăng ký NTD | Không chặn | Câu `employer_account_register_domain_warning` hứa giới hạn "mua hoặc sử dụng" không tồn tại |
| Thông báo nộp lại hồ sơ theo cấu hình | Không chặn | Câu báo lỗi ghi cứng "5 phút", "2 lượt" ở `apps/applications/services/applications.py`, trong khi giới hạn thật đọc từ cấu hình (`policy.reapply_cooldown`, `max_applications_per_job`) |
| Bộ lọc việc làm đã lưu và đánh giá chất lượng tin | Không chặn | "Lưu bộ lọc" ghi `saved_job_filter` nhưng không nơi nào đọc lại; đánh giá chất lượng tin chỉ nằm trong localStorage, không gửi về máy chủ |
| Song ngữ cổng ứng viên và quản trị | Không chặn | Giảm dần số trong `i18n-baseline.json`, CI chặn tăng |

## Quy tắc cập nhật

- Mỗi PR thêm một mục vào `CHANGELOG.md` (Added / Changed / Removed / Fixed / Security).
- Chỉ sửa file này khi trạng thái một module đổi, hoặc khi thêm/xong một việc đang mở.
  Không chép mô tả tính năng hay danh sách commit vào đây.
- Kế hoạch nhiều giai đoạn viết thành file riêng (hoặc ADR). Khi xong, chuyển vào
  [`archive/ke-hoach/`](archive/README.md).
